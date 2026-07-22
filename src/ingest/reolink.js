import { createTimeout, safeErrorMessage } from '../notifiers/base.js';

/**
 * Build Reolink Snap CGI URL when host + credentials are set.
 * @param {{ host: string, user: string, password: string, channel: string, snapshotUrl: string }} cfg
 * @returns {string}
 */
export function buildReolinkSnapshotUrl(cfg) {
  if (cfg.snapshotUrl) return cfg.snapshotUrl;
  if (!cfg.host) {
    throw new Error('reolink_missing_host_or_snapshot_url');
  }
  const base = cfg.host.startsWith('http') ? cfg.host : `http://${cfg.host}`;
  const u = new URL('/cgi-bin/api.cgi', base.endsWith('/') ? base : `${base}/`);
  u.searchParams.set('cmd', 'Snap');
  u.searchParams.set('channel', cfg.channel || '0');
  u.searchParams.set('rs', 'zeusHerald');
  if (cfg.user) u.searchParams.set('user', cfg.user);
  if (cfg.password) u.searchParams.set('password', cfg.password);
  return u.toString();
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
    // Prefer query auth (Reolink common); optional Basic if user set and no password in query path
    if (config.user && config.password && !config.snapshotUrl) {
      // password already in query via buildReolinkSnapshotUrl
    } else if (config.user && config.password && config.snapshotUrl) {
      const token = Buffer.from(`${config.user}:${config.password}`, 'utf8').toString('base64');
      headers.Authorization = `Basic ${token}`;
    }

    const res = await fetchImpl(url, {
      method: 'GET',
      headers,
      signal: timeout.signal,
    });

    if (!res.ok) {
      throw new Error(`reolink_http_${res.status}`);
    }

    const ab = await res.arrayBuffer();
    const buffer = Buffer.from(ab);
    if (buffer.length < 100) {
      throw new Error('reolink_empty_or_tiny_body');
    }

    const contentType =
      res.headers?.get?.('content-type') ||
      (typeof res.headers?.get === 'function' ? res.headers.get('content-type') : null) ||
      'image/jpeg';

    return { buffer, contentType: String(contentType).split(';')[0].trim() || 'image/jpeg' };
  } catch (err) {
    throw new Error(safeErrorMessage(err));
  } finally {
    timeout.clear();
  }
}
