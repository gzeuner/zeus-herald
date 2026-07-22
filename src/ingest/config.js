/**
 * Env-first ingest configuration (ADR-005).
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
 * @param {NodeJS.ProcessEnv} [env]
 */
export function loadIngestConfig(env = process.env) {
  const cameraType = String(env.CAMERA_TYPE || 'reolink').trim().toLowerCase();
  if (cameraType !== 'reolink' && cameraType !== 'upcam') {
    throw new Error(`unknown_camera_type:${cameraType}`);
  }

  const modeRaw = String(env.INGEST_MODE || 'files_only').trim().toLowerCase();
  const mode =
    modeRaw === 'direct_notify' || modeRaw === 'notify' ? 'direct_notify' : 'files_only';

  const reolinkHost = (env.REOLINK_HOST || '').trim().replace(/\/$/, '');
  const reolinkSnapshotUrl = (env.REOLINK_SNAPSHOT_URL || '').trim();
  const reolinkUser = (env.REOLINK_USER || env.REOLINK_USERNAME || '').trim();
  const reolinkPassword = (env.REOLINK_PASSWORD || '').trim();
  const reolinkChannel = (env.REOLINK_CHANNEL || '0').trim();

  const upcamSnapshotUrl = (env.UPCAM_SNAPSHOT_URL || '').trim();
  const upcamHost = (env.UPCAM_HOST || '').trim().replace(/\/$/, '');
  const upcamUser = (env.UPCAM_USER || env.UPCAM_USERNAME || '').trim();
  const upcamPassword = (env.UPCAM_PASSWORD || '').trim();

  return {
    cameraType,
    cameraId: (env.CAMERA_ID || cameraType || 'camera').trim() || 'camera',
    mode,
    targetDir: (env.INGEST_TARGET_DIR || 'images/received').trim() || 'images/received',
    intervalMs: parsePositiveInt(env.INGEST_INTERVAL_MS, 5000),
    timeoutMs: parsePositiveInt(env.INGEST_TIMEOUT_MS, 15000),
    writeMetadata: parseBool(env.INGEST_WRITE_METADATA, true),
    once: parseBool(env.INGEST_ONCE, false),
    reolink: {
      snapshotUrl: reolinkSnapshotUrl,
      host: reolinkHost,
      user: reolinkUser,
      password: reolinkPassword,
      channel: reolinkChannel,
    },
    upcam: {
      snapshotUrl: upcamSnapshotUrl,
      host: upcamHost,
      user: upcamUser,
      password: upcamPassword,
    },
  };
}

/**
 * Values that must never appear in logs.
 * @param {ReturnType<typeof loadIngestConfig>} config
 * @returns {string[]}
 */
export function ingestSecretValues(config) {
  return [config.reolink.password, config.upcam.password].filter((s) => s && s.length > 0);
}
