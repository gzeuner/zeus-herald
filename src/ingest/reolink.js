import { createTimeout, readResponseArrayBufferLimited, releaseResponseBody, safeErrorMessage } from '../notifiers/base.js';

/**
 * @param {string} template
 * @param {{ timestamp: string, channel: string, user: string, password: string }} values
 */
function expandSnapshotTemplate(template, values) {
  return template
    .replaceAll('{timestamp}', values.timestamp)
    .replaceAll('{channel}', encodeURIComponent(values.channel || '0'))
    .replaceAll('{username}', values.user)
    .replaceAll('{password}', values.password)
    .replaceAll('{usernameEncoded}', encodeURIComponent(values.user))
    .replaceAll('{passwordEncoded}', encodeURIComponent(values.password));
}

/**
 * @param {{ host: string, httpPort?: number }} cfg
 */
/**
 * @param {Buffer} buffer
 * @param {string} contentType
 */
function assertImageResponse(buffer, contentType) {
  const normalizedType = String(contentType || '').toLowerCase();
  const looksLikeJson = normalizedType.includes('json') || /^[\s\r\n]*[\[{]/.test(buffer.toString('utf8', 0, Math.min(buffer.length, 16)));
  if (looksLikeJson) {
    let detail = 'json_response';
    try {
      const parsed = JSON.parse(buffer.toString('utf8'));
      const first = Array.isArray(parsed) ? parsed[0] : parsed;
      detail = first?.error?.detail || first?.error?.rspCode || first?.code || detail;
    } catch {
      // Keep the generic JSON marker when the body is not parseable.
    }
    throw new Error(`reolink_non_image_response:${detail}`);
  }

  const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8;
  const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
  const isWebp = buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';
  if (!isJpeg && !isPng && !isWebp && !normalizedType.startsWith('image/')) {
    throw new Error('reolink_non_image_response:unknown_body');
  }
}
function buildBaseUrl(cfg) {
  if (!cfg.host) {
    throw new Error('reolink_missing_host_or_snapshot_url');
  }

  const base = cfg.host.startsWith('http') ? cfg.host : `http://${cfg.host}`;
  const u = new URL(base.endsWith('/') ? base : `${base}/`);
  if (!cfg.host.startsWith('http') && cfg.httpPort && cfg.httpPort !== 80) {
    u.port = String(cfg.httpPort);
  }
  return u;
}

/**
 * Build Reolink Snap CGI URL when host + credentials are set.
 * @param {{ host: string, httpPort?: number, user: string, password: string, channel: string, snapshotUrl: string, snapshotPath?: string }} cfg
 * @param {{ timestamp?: string }} [options]
 * @returns {string}
 */
export function buildReolinkSnapshotUrl(cfg, options = {}) {
  const timestamp = options.timestamp || String(Date.now());
  const values = {
    timestamp,
    channel: cfg.channel || '0',
    user: cfg.user || '',
    password: cfg.password || '',
  };

  if (cfg.snapshotUrl) {
    return expandSnapshotTemplate(cfg.snapshotUrl, values);
  }

  const base = buildBaseUrl(cfg);
  const rawPath = cfg.snapshotPath ||
    '/cgi-bin/api.cgi?cmd=Snap&channel={channel}&rs={timestamp}&user={usernameEncoded}&password={passwordEncoded}';
  const expandedPath = expandSnapshotTemplate(rawPath, values);
  const url = new URL(expandedPath, base);
  return url.toString();
}
/**
 * Build Reolink motion-state CGI URL when host + credentials are set.
 * This is configurable because Reolink exposes motion state unevenly across models/firmware.
 * @param {{ host: string, httpPort?: number, user: string, password: string, channel: string, motionStateUrl?: string, motionStatePath?: string }} cfg
 * @param {{ timestamp?: string }} [options]
 * @returns {string}
 */
export function buildReolinkMotionStateUrl(cfg, options = {}) {
  const timestamp = options.timestamp || String(Date.now());
  const values = {
    timestamp,
    channel: cfg.channel || '0',
    user: cfg.user || '',
    password: cfg.password || '',
  };

  if (cfg.motionStateUrl) {
    return expandSnapshotTemplate(cfg.motionStateUrl, values);
  }

  const base = buildBaseUrl(cfg);
  const rawPath = cfg.motionStatePath ||
    '/cgi-bin/api.cgi?cmd=GetMdState&channel={channel}&rs={timestamp}&user={usernameEncoded}&password={passwordEncoded}';
  const expandedPath = expandSnapshotTemplate(rawPath, values);
  const url = new URL(expandedPath, base);
  return url.toString();
}
/**
 * @param {unknown} payload
 * @returns {{ active: boolean, rawState: unknown }}
 */
export function parseReolinkMotionState(payload) {
  const first = Array.isArray(payload) ? payload[0] : payload;
  if (!first || typeof first !== 'object') return { active: false, rawState: payload };
  const item = /** @type {Record<string, unknown>} */ (first);
  if (Number(item.code) !== 0 && item.error) {
    const error = /** @type {{ detail?: unknown, rspCode?: unknown }} */ (item.error);
    throw new Error(`reolink_motion_state_error:${error.detail || error.rspCode || item.code}`);
  }

  const value = item.value && typeof item.value === 'object'
    ? /** @type {Record<string, unknown>} */ (item.value)
    : item;
  const rawState = value.state ?? value.State ?? value.status ?? value.alarm ?? value.motion ?? value.detect;
  if (typeof rawState === 'number') return { active: rawState > 0, rawState };
  if (typeof rawState === 'boolean') return { active: rawState, rawState };
  if (typeof rawState === 'string') {
    const normalized = rawState.trim().toLowerCase();
    return {
      active: ['1', 'true', 'yes', 'on', 'active', 'alarm', 'motion', 'detected'].includes(normalized),
      rawState,
    };
  }
  return { active: false, rawState };
}

/**
 * @param {object} options
 * @param {ReturnType<import('./config.js').loadIngestConfig>['reolink']} options.config
 * @param {number} [options.timeoutMs]
 * @param {typeof fetch} [options.fetchImpl]
 * @returns {Promise<{ active: boolean, rawState: unknown, payload: unknown }>}
 */
export async function fetchReolinkMotionState(options) {
  const { config, timeoutMs = 15000, fetchImpl = globalThis.fetch } = options;
  const url = buildReolinkMotionStateUrl(config);
  const timeout = createTimeout(timeoutMs);
  try {
    /** @type {Record<string, string>} */
    const headers = { Accept: 'application/json,*/*' };
    if (config.user && config.password && config.motionStateUrl) {
      const token = Buffer.from(`${config.user}:${config.password}`, 'utf8').toString('base64');
      headers.Authorization = `Basic ${token}`;
    }

    const res = await fetchImpl(url, {
      method: 'GET',
      headers,
      signal: timeout.signal,
    });

    if (!res.ok) {
      await releaseResponseBody(res);
      throw new Error(`reolink_motion_state_http_${res.status}`);
    }

    const text = await res.text();
    const payload = JSON.parse(text);
    return { ...parseReolinkMotionState(payload), payload };
  } catch (err) {
    throw new Error(safeErrorMessage(err));
  } finally {
    timeout.clear();
  }
}
/**
 * @param {object} options
 * @param {ReturnType<import('./config.js').loadIngestConfig>['reolink']} options.config
 * @param {number} [options.timeoutMs]
 * @param {typeof fetch} [options.fetchImpl]
 * @returns {Promise<{ buffer: Buffer, contentType: string }>}
 */
export async function fetchReolinkSnapshot(options) {
  const { config, timeoutMs = 15000, fetchImpl = globalThis.fetch } = options;
  const url = buildReolinkSnapshotUrl(config);
  const timeout = createTimeout(timeoutMs);
  try {
    /** @type {Record<string, string>} */
    const headers = { Accept: 'image/jpeg,image/*,*/*' };
    // Prefer query auth (Reolink common); optional Basic for explicit custom URLs.
    if (config.user && config.password && config.snapshotUrl) {
      const token = Buffer.from(`${config.user}:${config.password}`, 'utf8').toString('base64');
      headers.Authorization = `Basic ${token}`;
    }

    const res = await fetchImpl(url, {
      method: 'GET',
      headers,
      signal: timeout.signal,
    });

    if (!res.ok) {
      await releaseResponseBody(res);
      throw new Error(`reolink_http_${res.status}`);
    }

    const ab = await readResponseArrayBufferLimited(res, config.maxImageBytes || 10 * 1024 * 1024);
    const buffer = Buffer.from(ab);
    if (buffer.length < 100) {
      throw new Error('reolink_empty_or_tiny_body');
    }

    const contentType =
      res.headers?.get?.('content-type') ||
      (typeof res.headers?.get === 'function' ? res.headers.get('content-type') : null) ||
      'image/jpeg';
    const normalizedContentType = String(contentType).split(';')[0].trim() || 'image/jpeg';
    assertImageResponse(buffer, normalizedContentType);

    return { buffer, contentType: normalizedContentType };
  } catch (err) {
    throw new Error(safeErrorMessage(err));
  } finally {
    timeout.clear();
  }
}

/**
 * Capture a single snapshot or a short burst from Reolink.
 * @param {object} options
 * @param {ReturnType<import('./config.js').loadIngestConfig>['reolink']} options.config
 * @param {number} [options.timeoutMs]
 * @param {typeof fetch} [options.fetchImpl]
 * @returns {Promise<Array<{ buffer: Buffer, contentType: string, burstIndex: number, burstCount: number }>>}
 */
export async function fetchReolinkSnapshots(options) {
  const { config } = options;
  let motionSignal = null;
  if (config.burst?.requireSignal) {
    motionSignal = await fetchReolinkMotionState(options);
    if (!motionSignal.active) return [];
  }

  const burstCount = config.burst?.enabled ? Math.max(1, config.burst.count || 1) : 1;
  /** @type {Array<{ buffer: Buffer, contentType: string, burstIndex: number, burstCount: number }>} */
  const frames = [];

  for (let i = 0; i < burstCount; i += 1) {
    const snapshot = await fetchReolinkSnapshot(options);
    frames.push({ ...snapshot, burstIndex: i + 1, burstCount, motionSignal });
    if (i < burstCount - 1) {
      await delay(config.burst?.intervalMs || 350);
    }
  }

  return frames;
}

/**
 * @param {number} ms
 */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
