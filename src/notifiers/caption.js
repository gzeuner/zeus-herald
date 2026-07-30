import { stat } from 'node:fs/promises';
import path from 'node:path';

/**
 * @typedef {object} CaptionOptions
 * @property {boolean} [debug]
 * @property {string} [locale]
 * @property {string} [timeZone]
 */

/**
 * @param {object} options
 * @param {string} options.imagePath
 * @param {string} [options.caption]
 * @param {Record<string, unknown>} [options.metadata]
 * @param {CaptionOptions} [options.captionOptions]
 */
export async function buildNotificationCaption(options) {
  const {
    imagePath,
    caption = '',
    metadata = {},
    captionOptions = {},
  } = options;

  const createdAt = await resolveCreatedAt(imagePath, metadata);
  const lines = [formatDateTime(createdAt, captionOptions)];

  if (captionOptions.debug) {
    lines.push(...buildDebugLines({ imagePath, caption, metadata }));
  }

  return lines.filter(Boolean).join('\n');
}

/**
 * @param {string} imagePath
 * @param {Record<string, unknown>} metadata
 */
async function resolveCreatedAt(imagePath, metadata) {
  const candidates = [
    metadata.capturedAt,
    metadata.createdAt,
    metadata.at,
    metadata.decision && typeof metadata.decision === 'object'
      ? /** @type {{ at?: unknown }} */ (metadata.decision).at
      : undefined,
  ];

  for (const value of candidates) {
    const date = parseDate(value);
    if (date) return date;
  }

  try {
    const s = await stat(imagePath);
    const birth = parseDate(s.birthtime);
    if (birth) return birth;
    const modified = parseDate(s.mtime);
    if (modified) return modified;
  } catch {
    // Keep notification delivery independent from optional file metadata.
  }

  return new Date();
}

/**
 * @param {unknown} value
 * @returns {Date | null}
 */
function parseDate(value) {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value;
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

/**
 * @param {Date} date
 * @param {CaptionOptions} options
 */
export function formatDateTime(date, options = {}) {
  const locale = options.locale || undefined;
  const timeZone = options.timeZone || undefined;
  const formatOptions = {
    dateStyle: 'medium',
    timeStyle: 'medium',
    ...(timeZone ? { timeZone } : {}),
  };

  try {
    return new Intl.DateTimeFormat(locale, formatOptions).format(date);
  } catch {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'medium',
    }).format(date);
  }
}

/**
 * @param {object} options
 * @param {string} options.imagePath
 * @param {string} options.caption
 * @param {Record<string, unknown>} options.metadata
 */
function buildDebugLines({ imagePath, caption, metadata }) {
  const decision = isRecord(metadata.decision) ? metadata.decision : {};
  const metrics = isRecord(decision.metrics) ? decision.metrics : {};
  const image = isRecord(metrics.image) ? metrics.image : null;
  const lines = [];

  const identity = joinParts([
    pair('camera', metadata.camera),
    pair('source', metadata.source),
    pair('file', path.basename(imagePath)),
  ]);
  if (identity) lines.push(identity);

  const event = joinParts([
    pair('reason', decision.reason),
    pair('score', formatNumber(metrics.score)),
    pair('changed', metrics.changed),
    pair('compared', metrics.compared),
    pair('brightness', formatNumber(metrics.brightness)),
    pair('zonePass', metrics.zonePass),
  ]);
  if (event) lines.push(event);

  const imageLine = joinParts([
    pair('mode', metrics.mode),
    image && image.width && image.height ? `work=${image.width}x${image.height}` : '',
    image && image.sourceWidth && image.sourceHeight ? `source=${image.sourceWidth}x${image.sourceHeight}` : '',
    pair('roiPixels', image?.roiPixels),
    pair('maskedOut', image?.maskedOut),
  ]);
  if (imageLine) lines.push(imageLine);

  const motion = joinParts([
    pair('cameraMotion', metadata.cameraMotionSignal ?? metrics.cameraMotionSignal),
    pair('rawState', metadata.cameraMotionRawState ?? metrics.cameraMotionRawState),
    pair('pixelReason', metrics.pixelReason),
  ]);
  if (motion) lines.push(motion);

  const capture = joinParts([
    metadata.burstIndex && metadata.burstCount
      ? `burst=${metadata.burstIndex}/${metadata.burstCount}`
      : '',
    pair('requestId', metadata.requestId),
    caption ? `caption=${caption}` : '',
  ]);
  if (capture) lines.push(capture);

  return lines;
}

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * @param {string} key
 * @param {unknown} value
 */
function pair(key, value) {
  if (value === undefined || value === null || value === '') return '';
  return `${key}=${value}`;
}

/**
 * @param {Array<string | false | null | undefined>} parts
 */
function joinParts(parts) {
  return parts.filter(Boolean).join(' ');
}

/**
 * @param {unknown} value
 */
function formatNumber(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return value;
  return Number.isInteger(value) ? value : Number(value.toFixed(6));
}
