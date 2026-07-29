import { readdir, stat, unlink } from 'node:fs/promises';
import path from 'node:path';
import { logger } from './logger.js';

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
 * @param {string | undefined} value
 * @param {number} fallback
 */
function parsePositiveNumber(value, fallback) {
  const n = Number.parseFloat(value || '');
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/**
 * @param {string | undefined} value
 * @param {string[]} fallback
 */
function parseCsv(value, fallback) {
  const items = String(value || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return items.length ? items : fallback;
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 */
export function loadCleanupConfig(env = process.env) {
  const imageDirs = parseCsv(env.CLEANUP_IMAGE_DIRS, [
    env.INGEST_TARGET_DIR || env.MOTION_RECEIVED_DIR || 'images/received',
    env.MOTION_FILTERED_DIR || 'images/filtered',
    env.MOTION_SENT_DIR || 'images/sent',
  ]);

  return {
    enabled: parseBool(env.CLEANUP_ENABLED, true),
    intervalMs: Math.round(parsePositiveNumber(env.CLEANUP_INTERVAL_MS, 300000)),
    images: {
      enabled: parseBool(env.CLEANUP_IMAGES_ENABLED, true),
      dirs: [...new Set(imageDirs.map((d) => d.trim()).filter(Boolean))],
      maxAgeMs: Math.round(parsePositiveNumber(env.CLEANUP_IMAGES_MAX_AGE_HOURS, 36) * 60 * 60 * 1000),
      extensions: parseCsv(env.CLEANUP_IMAGE_EXTENSIONS, ['.jpg', '.jpeg', '.png', '.webp', '.json'])
        .map((ext) => ext.toLowerCase()),
    },
    logs: {
      enabled: parseBool(env.CLEANUP_LOGS_ENABLED, true),
      dirs: parseCsv(env.CLEANUP_LOG_DIRS || env.CLEANUP_LOGS_DIR, ['logs']),
      maxAgeMs: Math.round(parsePositiveNumber(env.CLEANUP_LOGS_MAX_AGE_HOURS, 48) * 60 * 60 * 1000),
      extensions: parseCsv(env.CLEANUP_LOG_EXTENSIONS, ['.log', '.ndjson', '.txt'])
        .map((ext) => ext.toLowerCase()),
    },
  };
}

/**
 * @param {string} filePath
 * @param {string[]} extensions
 */
function hasAllowedExtension(filePath, extensions) {
  const lower = filePath.toLowerCase();
  return extensions.some((ext) => lower.endsWith(ext));
}

/**
 * @param {string} dir
 * @returns {AsyncGenerator<string>}
 */
async function* walkFiles(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (err) {
    if (err && typeof err === 'object' && /** @type {{ code?: string }} */ (err).code === 'ENOENT') return;
    throw err;
  }

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkFiles(full);
    } else if (entry.isFile()) {
      yield full;
    }
  }
}

/**
 * @param {object} options
 * @param {string[]} options.dirs
 * @param {number} options.maxAgeMs
 * @param {string[]} options.extensions
 * @param {number} options.nowMs
 */
async function cleanupDirs(options) {
  let scanned = 0;
  let deleted = 0;
  let failed = 0;
  const cutoffMs = options.nowMs - options.maxAgeMs;

  for (const dir of options.dirs) {
    const resolved = path.resolve(dir);
    for await (const filePath of walkFiles(resolved)) {
      if (!hasAllowedExtension(filePath, options.extensions)) continue;
      scanned += 1;
      try {
        const s = await stat(filePath);
        if (s.mtimeMs >= cutoffMs) continue;
        await unlink(filePath);
        deleted += 1;
      } catch (err) {
        failed += 1;
        logger.warn('cleanup_file_failed', {
          path: filePath,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  return { scanned, deleted, failed };
}

/**
 * @param {object} [options]
 * @param {ReturnType<typeof loadCleanupConfig>} [options.config]
 * @param {number} [options.nowMs]
 */
export async function cleanupOnce(options = {}) {
  const config = options.config || loadCleanupConfig();
  if (!config.enabled) return { skipped: true, images: null, logs: null };

  const nowMs = options.nowMs || Date.now();
  const result = { skipped: false, images: null, logs: null };

  if (config.images.enabled) {
    result.images = await cleanupDirs({
      dirs: config.images.dirs,
      maxAgeMs: config.images.maxAgeMs,
      extensions: config.images.extensions,
      nowMs,
    });
  }

  if (config.logs.enabled) {
    result.logs = await cleanupDirs({
      dirs: config.logs.dirs,
      maxAgeMs: config.logs.maxAgeMs,
      extensions: config.logs.extensions,
      nowMs,
    });
  }

  logger.info('cleanup_complete', result);
  return result;
}

/**
 * @param {object} [options]
 * @param {ReturnType<typeof loadCleanupConfig>} [options.config]
 */
export function startCleanup(options = {}) {
  const config = options.config || loadCleanupConfig();
  let running = false;
  let stopped = false;
  let timer = null;

  async function run() {
    if (stopped || running || !config.enabled) return;
    running = true;
    try {
      await cleanupOnce({ config });
    } catch (err) {
      logger.warn('cleanup_failed', {
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      running = false;
    }
  }

  if (config.enabled) {
    void run();
    timer = setInterval(() => { void run(); }, config.intervalMs);
    timer.unref?.();
  }

  return {
    config,
    stop: () => {
      stopped = true;
      if (timer) clearInterval(timer);
    },
  };
}
