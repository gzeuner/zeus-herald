import {
  createTimeout,
  loadImageFile,
  safeErrorMessage,
  sendResult,
  truncateCaption,
} from './base.js';

const TELEGRAM_API = 'https://api.telegram.org';

/**
 * @param {object} options
 * @param {string} options.botToken
 * @param {string} options.chatId
 * @param {number} [options.timeoutMs]
 * @param {typeof fetch} [options.fetchImpl]
 */
export function createTelegramNotifier(options) {
  const {
    botToken,
    chatId,
    timeoutMs = 30000,
    fetchImpl = globalThis.fetch,
  } = options;

  if (!botToken || !chatId) {
    throw new Error('telegram_missing_credentials');
  }

  const name = 'telegram';

  /**
   * @param {import('./base.js').NotifyPayload} payload
   * @returns {Promise<import('./base.js').SendResult>}
   */
  async function send(payload) {
    const started = Date.now();
    const timeout = createTimeout(timeoutMs);
    try {
      const { buffer, filename, contentType } = await loadImageFile(payload.imagePath);
      const form = new FormData();
      form.append('chat_id', chatId);
      const caption = truncateCaption(payload.caption);
      if (caption) form.append('caption', caption);
      const blob = new Blob([buffer], { type: contentType });
      form.append('photo', blob, filename);

      const url = `${TELEGRAM_API}/bot${botToken}/sendPhoto`;
      const res = await fetchImpl(url, {
        method: 'POST',
        body: form,
        signal: timeout.signal,
      });

      const durationMs = Date.now() - started;
      /** @type {any} */
      let body = null;
      try {
        body = await res.json();
      } catch {
        body = null;
      }

      if (!res.ok || !body?.ok) {
        const apiDesc =
          body?.description ||
          body?.error_code ||
          `http_${res.status}`;
        return sendResult(name, {
          ok: false,
          error: String(apiDesc).slice(0, 500),
          durationMs,
        });
      }

      const remoteId =
        body.result?.message_id != null
          ? String(body.result.message_id)
          : undefined;

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
    const timeout = createTimeout(timeoutMs);
    try {
      const url = `${TELEGRAM_API}/bot${botToken}/getMe`;
      const res = await fetchImpl(url, { method: 'GET', signal: timeout.signal });
      /** @type {any} */
      let body = null;
      try {
        body = await res.json();
      } catch {
        body = null;
      }
      if (res.ok && body?.ok) {
        const username = body.result?.username;
        return { ok: true, detail: username ? `bot:@${username}` : 'bot_ok' };
      }
      return {
        ok: false,
        detail: String(body?.description || `http_${res.status}`).slice(0, 200),
      };
    } catch (err) {
      return { ok: false, detail: safeErrorMessage(err) };
    } finally {
      timeout.clear();
    }
  }

  return { name, send, health };
}
