/**
 * Env-first motion configuration (ADR-006).
 */

/**
 * @param {string | undefined} value
 * @param {boolean} defaultValue
 */
function parseBool(value, defaultValue) {
  if (value === undefined || value === null || value === '') return defaultValue;
  const v = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(v)) return true;
  if (['0', 'false', 'no', 'off'].includes(v)) return false;
  return defaultValue;
}

/**
 * @param {string | undefined} raw
 * @param {number} fallback
 */
function parsePositiveInt(raw, fallback) {
  const n = Number.parseInt(raw || '', 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/**
 * @param {string | undefined} raw
 * @param {number} fallback
 */
function parseNumber(raw, fallback) {
  const n = Number.parseFloat(raw || '');
  return Number.isFinite(n) ? n : fallback;
}

/**
 * ROI as normalized fractions of the 1D sample stream (0..1).
 * Full frame: start=0 end=1.
 * @param {NodeJS.ProcessEnv} env
 */
function parseRoi(env) {
  const start = Math.min(1, Math.max(0, parseNumber(env.MOTION_ROI_START, 0)));
  const end = Math.min(1, Math.max(0, parseNumber(env.MOTION_ROI_END, 1)));
  return {
    start: Math.min(start, end),
    end: Math.max(start, end),
  };
}

/**
 * Optional zone list: JSON array of { name, start, end, weight? }
 * @param {NodeJS.ProcessEnv} env
 */
function parseZones(env) {
  const raw = (env.MOTION_ZONES_JSON || '').trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((z, i) => ({
        name: String(z.name || `zone_${i}`),
        start: Math.min(1, Math.max(0, Number(z.start) || 0)),
        end: Math.min(1, Math.max(0, Number(z.end) || 1)),
        weight: Number.isFinite(Number(z.weight)) ? Number(z.weight) : 1,
      }))
      .filter((z) => z.end > z.start);
  } catch {
    return [];
  }
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 */
export function loadMotionConfig(env = process.env) {
  return {
    receivedDir: (env.MOTION_RECEIVED_DIR || 'images/received').trim(),
    filteredDir: (env.MOTION_FILTERED_DIR || 'images/filtered').trim(),
    sentDir: (env.MOTION_SENT_DIR || 'images/sent').trim(),
    pollMs: parsePositiveInt(env.MOTION_POLL_MS, 1000),
    once: parseBool(env.MOTION_ONCE, false),
    // delta: fraction of sampled bytes that differ beyond pixel threshold
    pixelDiffThreshold: parsePositiveInt(env.MOTION_PIXEL_DIFF_THRESHOLD, 12),
    motionScoreThreshold: parseNumber(env.MOTION_SCORE_THRESHOLD, 0.02),
    sampleStride: parsePositiveInt(env.MOTION_SAMPLE_STRIDE, 16),
    roi: parseRoi(env),
    zones: parseZones(env),
    // brightness gate on mean sample intensity (0-255 for byte data)
    brightnessMin: parseNumber(env.MOTION_BRIGHTNESS_MIN, 8),
    brightnessMax: parseNumber(env.MOTION_BRIGHTNESS_MAX, 248),
    confirmCount: parsePositiveInt(env.MOTION_CONFIRM_COUNT, 1),
    cooldownMs: parsePositiveInt(env.MOTION_COOLDOWN_MS, 9000),
    maxSendsPerEvent: parsePositiveInt(env.MOTION_MAX_SENDS, 3),
    eventIdleMs: parsePositiveInt(env.MOTION_EVENT_IDLE_MS, 30000),
    notifyEnabled: parseBool(env.MOTION_NOTIFY, true),
    extensions: (env.MOTION_EXTENSIONS || '.jpg,.jpeg,.png,.webp')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  };
}
