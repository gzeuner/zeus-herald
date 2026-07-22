import {
  createTimeout,
  loadImageFile,
  safeErrorMessage,
  sendResult,
  truncateCaption,
} from './base.js';

/**
 * @param {object} options
 * @param {string} options.url - full ntfy topic URL
 * @param {string} [options.token] - optional bearer token for self-hosted auth
 * @param {number} [options.timeoutMs]
 * @param {typeof fetch} [options.fetchImpl]
 */
export function createNtfyNotifier(options) {
  const {
    url,
    token = '',
    timeoutMs = 30000,
    fetchImpl = globalThis.fetch,
  } = options;

  if (!url) {
    throw new Error('ntfy_missing_url');
  }

  const name = 'ntfy';

  /**
   * @param {Record<string, string>} base
   * @returns {Record<string, string>}
   */
  function withAuth(base) {
    if (token) {
      return { ...base, Authorization: `Bearer ${token}` };
    }
    return base;
  }

  /**
   * @param {import('./base.js').NotifyPayload} payload
   * @returns {Promise<import('./base.js').SendResult>}
   */
  async function send(payload) {
    const started = Date.now();
    const timeout = createTimeout(timeoutMs);
    try {
      const { buffer, filename, contentType } = await loadImageFile(payload.imagePath);
      const caption = truncateCaption(payload.caption, 4096);
      const title =
        (payload.metadata && typeof payload.metadata.title === 'string'
          ? payload.metadata.title
          : 'zeus-herald') || 'zeus-herald';

      const headers = withAuth({
        'Content-Type': contentType,
        Filename: filename,
        Title: truncateCaption(title, 250),
        Message: caption || 'Event',
      });

      const res = await fetchImpl(url, {
        method: 'PUT',
        headers,
        body: buffer,
        signal: timeout.signal,
      });

      const durationMs = Date.now() - started;
      if (!res.ok) {
        let detail = `http_${res.status}`;
        try {
          const text = await res.text();
          if (text) detail = `${detail}:${text.slice(0, 200)}`;
        } catch {
          // ignore body read errors
        }
        return sendResult(name, { ok: false, error: detail, durationMs });
      }

      let remoteId;
      try {
        const body = await res.json();
        if (body?.id != null) remoteId = String(body.id);
      } catch {
        // ntfy may return empty body depending on server
      }

      return sendResult(name, { ok: true, remoteId, durationMs });
    } catch (err) {
      return sendResult(name, {
        ok: false,
        error: safeErrorMessage(err),
        durationMs: Date.now() - started,
      });
    } finally {
      timeout.clear();
    }
  }

  /**
   * @returns {Promise<import('./base.js').HealthResult>}
   */
  async function health() {
    const timeout = createTimeout(Math.min(timeoutMs, 10000));
    try {
      // HEAD may be unsupported; GET with short timeout is acceptable for health.
      const res = await fetchImpl(url, {
        method: 'GET',
        headers: withAuth({}),
        signal: timeout.signal,
      });
      // 2xx/4xx means host is reachable; 401/403 still "up" but auth issue.
      if (res.status >= 500) {
        return { ok: false, detail: `http_${res.status}` };
      }
      if (res.status === 401 || res.status === 403) {
        return { ok: false, detail: `auth_${res.status}` };
      }
      return { ok: true, detail: `http_${res.status}` };
    } catch (err) {
      return { ok: false, detail: safeErrorMessage(err) };
    } finally {
      timeout.clear();
    }
  }

  return { name, send, health };
}
