import { readFile } from 'node:fs/promises';
import path from 'node:path';
import jpeg from 'jpeg-js';

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
 * @typedef {object} ImageCompressionOptions
 * @property {boolean} [enabled]
 * @property {number} [maxWidth]
 * @property {number} [jpegQuality]
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
  // Avoid keeping the event loop alive solely for the timer in tests.
  if (typeof timer.unref === 'function') timer.unref();
  return {
    signal: controller.signal,
    clear: () => clearTimeout(timer),
  };
}

/**
 * @param {string} imagePath
 * @param {ImageCompressionOptions} [compression]
 * @returns {Promise<{ buffer: Buffer, filename: string, contentType: string, originalBytes: number, compressed: boolean }>}
 */
export async function loadImageFile(imagePath, compression = {}) {
  const resolved = path.resolve(imagePath);
  const original = await readFile(resolved);
  const parsed = path.parse(resolved);
  const ext = parsed.ext.toLowerCase();
  const originalContentType = contentTypeFromExtension(ext);

  if (compression.enabled !== false && (ext === '.jpg' || ext === '.jpeg')) {
    const compressed = compressJpeg(original, compression);
    if (compressed && compressed.length < original.length) {
      return {
        buffer: compressed,
        filename: `${parsed.name}.jpg`,
        contentType: 'image/jpeg',
        originalBytes: original.length,
        compressed: true,
      };
    }
  }

  return {
    buffer: original,
    filename: path.basename(resolved),
    contentType: originalContentType,
    originalBytes: original.length,
    compressed: false,
  };
}

/**
 * @param {string} ext
 */
function contentTypeFromExtension(ext) {
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  return 'image/jpeg';
}

/**
 * @param {Buffer} input
 * @param {ImageCompressionOptions} compression
 * @returns {Buffer | null}
 */
export function compressJpeg(input, compression = {}) {
  const maxWidth = Math.max(1, Number(compression.maxWidth) || 1920);
  const quality = Math.min(100, Math.max(1, Number(compression.jpegQuality) || 88));
  let decoded;
  try {
    decoded = jpeg.decode(input, { useTArray: true, maxMemoryUsageInMB: 512 });
  } catch {
    return null;
  }
  if (!decoded?.width || !decoded?.height || !decoded?.data) return null;

  const targetWidth = Math.min(decoded.width, maxWidth);
  const targetHeight = Math.max(1, Math.round((decoded.height * targetWidth) / decoded.width));
  const data = targetWidth === decoded.width
    ? decoded.data
    : resizeRgbaNearest(decoded.data, decoded.width, decoded.height, targetWidth, targetHeight);

  return jpeg.encode({ data, width: targetWidth, height: targetHeight }, quality).data;
}

/**
 * @param {Uint8Array | Buffer} src
 * @param {number} srcWidth
 * @param {number} srcHeight
 * @param {number} dstWidth
 * @param {number} dstHeight
 */
function resizeRgbaNearest(src, srcWidth, srcHeight, dstWidth, dstHeight) {
  const out = Buffer.alloc(dstWidth * dstHeight * 4);
  for (let y = 0; y < dstHeight; y += 1) {
    const sy = Math.min(srcHeight - 1, Math.floor((y * srcHeight) / dstHeight));
    for (let x = 0; x < dstWidth; x += 1) {
      const sx = Math.min(srcWidth - 1, Math.floor((x * srcWidth) / dstWidth));
      const si = (sy * srcWidth + sx) * 4;
      const di = (y * dstWidth + x) * 4;
      out[di] = src[si];
      out[di + 1] = src[si + 1];
      out[di + 2] = src[si + 2];
      out[di + 3] = src[si + 3] ?? 255;
    }
  }
  return out;
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
  return `${caption.slice(0, max - 1)}.`;
}

