import { createTimeout, safeErrorMessage } from '../notifiers/base.js';

/**
 * @param {{ host: string, user: string, password: string, snapshotUrl: string }} cfg
 * @returns {string}
 */
export function buildUpcamSnapshotUrl(cfg) {
  if (cfg.snapshotUrl) return cfg.snapshotUrl;
  if (!cfg.host) {
    throw new Error('upcam_missing_host_or_snapshot_url');
  }
  const base = cfg.host.startsWith('http') ? cfg.host : `http://${cfg.host}`;
  // Common IP-camera still-image path; override via UPCAM_SNAPSHOT_URL when needed.
  const u = new URL('/snapshot.jpg', base.endsWith('/') ? base : `${base}/`);
  return u.toString();
}

/**
 * @param {object} options
 * @param {ReturnType<import('./config.js').loadIngestConfig>['upcam']} options.config
 * @param {number} [options.timeoutMs]
 * @param {typeof fetch} [options.fetchImpl]
 * @returns {Promise<{ buffer: Buffer, contentType: string }>}
 */
export async function fetchUpcamSnapshot(options) {
  const { config, timeoutMs = 15000, fetchImpl = globalThis.fetch } = options;
  const url = buildUpcamSnapshotUrl(config);
  const timeout = createTimeout(timeoutMs);
  try {
    /** @type {Record<string, string>} */
    const headers = { Accept: 'image/jpeg,image/*,*/*' };
    if (config.user && config.password) {
      const token = Buffer.from(`${config.user}:${config.password}`, 'utf8').toString('base64');
      headers.Authorization = `Basic ${token}`;
    }

    const res = await fetchImpl(url, {
      method: 'GET',
      headers,
      signal: timeout.signal,
    });

    if (!res.ok) {
      throw new Error(`upcam_http_${res.status}`);
    }

    const ab = await res.arrayBuffer();
    const buffer = Buffer.from(ab);
    if (buffer.length < 100) {
      throw new Error('upcam_empty_or_tiny_body');
    }

    const contentType =
      (typeof res.headers?.get === 'function' ? res.headers.get('content-type') : null) ||
      'image/jpeg';

    return { buffer, contentType: String(contentType).split(';')[0].trim() || 'image/jpeg' };
  } catch (err) {
    throw new Error(safeErrorMessage(err));
  } finally {
    timeout.clear();
  }
}
