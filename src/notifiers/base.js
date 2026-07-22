import { readFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * @typedef {object} NotifyPayload
 * @property {string} imagePath
 * @property {string} [caption]
 * @property {Record<string, unknown>} [metadata]
 */

/**
 * @typedef {object} SendResult
 * @property {boolean} ok
 * @property {string} notifier
 * @property {string} [remoteId]
 * @property {string} [error]
 * @property {number} [durationMs]
 */

/**
 * @typedef {object} HealthResult
 * @property {boolean} ok
 * @property {string} [detail]
 */

/**
 * @param {string} notifier
 * @param {Partial<SendResult> & { ok: boolean }} partial
 * @returns {SendResult}
 */
export function sendResult(notifier, partial) {
  return {
    ok: partial.ok,
    notifier,
    remoteId: partial.remoteId,
    error: partial.error,
    durationMs: partial.durationMs,
  };
}

/**
 * @param {unknown} err
 * @returns {string}
 */
export function safeErrorMessage(err) {
  if (err == null) return 'unknown_error';
  if (typeof err === 'string') return err.slice(0, 500);
  if (err instanceof Error) {
    if (err.name === 'AbortError' || err.message.includes('aborted')) {
      return 'timeout_or_aborted';
    }
    return (err.message || err.name || 'error').slice(0, 500);
  }
  return String(err).slice(0, 500);
}

/**
 * @param {number} timeoutMs
 * @returns {{ signal: AbortSignal, clear: () => void }}
 */
export function createTimeout(timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  // Avoid keeping the event loop alive solely for the timer in tests
  if (typeof timer.unref === 'function') timer.unref();
  return {
    signal: controller.signal,
    clear: () => clearTimeout(timer),
  };
}

/**
 * @param {string} imagePath
 * @returns {Promise<{ buffer: Buffer, filename: string, contentType: string }>}
 */
export async function loadImageFile(imagePath) {
  const resolved = path.resolve(imagePath);
  const buffer = await readFile(resolved);
  const filename = path.basename(resolved);
  const ext = path.extname(filename).toLowerCase();
  const contentType =
    ext === '.png'
      ? 'image/png'
      : ext === '.webp'
        ? 'image/webp'
        : ext === '.gif'
          ? 'image/gif'
          : 'image/jpeg';
  return { buffer, filename, contentType };
}

/**
 * Telegram caption hard limit is 1024 characters.
 * @param {string | undefined} caption
 * @param {number} [max]
 * @returns {string}
 */
export function truncateCaption(caption, max = 1024) {
  if (!caption) return '';
  if (caption.length <= max) return caption;
  return `${caption.slice(0, max - 1)}…`;
}
