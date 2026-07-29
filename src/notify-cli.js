import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { createApp } from './app.js';
import { logger } from './logger.js';

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

/**
 * @param {string} name
 */
function isImageName(name) {
  const lower = name.toLowerCase();
  return IMAGE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

/**
 * @param {string} dir
 * @returns {Promise<string>}
 */
export async function findLatestImage(dir) {
  const resolved = path.resolve(dir);
  const names = await readdir(resolved);
  /** @type {Array<{ full: string, mtime: number }>} */
  const candidates = [];

  for (const name of names) {
    if (!isImageName(name)) continue;
    const full = path.join(resolved, name);
    const s = await stat(full);
    if (s.isFile()) candidates.push({ full, mtime: s.mtimeMs });
  }

  candidates.sort((a, b) => b.mtime - a.mtime);
  if (!candidates.length) {
    throw new Error(`no_images_found:${resolved}`);
  }
  return candidates[0].full;
}

/**
 * @param {string[]} argv
 * @param {NodeJS.ProcessEnv} [env]
 */
export function parseNotifyArgs(argv, env = process.env) {
  /** @type {{ imagePath: string, latestDir: string, caption: string }} */
  const parsed = {
    imagePath: env.NOTIFY_IMAGE_PATH || '',
    latestDir: env.NOTIFY_LATEST_DIR || env.MOTION_SENT_DIR || env.INGEST_TARGET_DIR || 'images/received',
    caption: env.NOTIFY_CAPTION || 'zeus-herald camera image',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--image') {
      parsed.imagePath = argv[i + 1] || '';
      i += 1;
    } else if (arg === '--latest') {
      parsed.imagePath = '';
    } else if (arg === '--dir') {
      parsed.latestDir = argv[i + 1] || parsed.latestDir;
      i += 1;
    } else if (arg === '--caption') {
      parsed.caption = argv[i + 1] || parsed.caption;
      i += 1;
    }
  }

  return parsed;
}

/**
 * @param {object} options
 * @param {NodeJS.ProcessEnv} [options.env]
 * @param {typeof fetch} [options.fetchImpl]
 * @param {string} [options.imagePath]
 * @param {string} [options.latestDir]
 * @param {string} [options.caption]
 */
export async function notifyImage(options = {}) {
  const env = options.env || process.env;
  const imagePath = options.imagePath || await findLatestImage(options.latestDir || env.NOTIFY_LATEST_DIR || 'images/received');
  const app = createApp({ env, fetchImpl: options.fetchImpl, installSignals: false });

  try {
    await app.start();
    if (!app.notifiers.length) {
      throw new Error('no_notifiers_enabled');
    }

    const caption = options.caption || env.NOTIFY_CAPTION || 'zeus-herald camera image';
    const outcome = await app.enqueueNotify(imagePath, caption, {
      title: 'zeus-herald mobile transfer',
      source: 'notify-cli',
    });
    if (!outcome.ok) {
      const detail = outcome.error || outcome.results?.map((r) => r.error).filter(Boolean).join(';') || 'notify_failed';
      throw new Error(detail);
    }
    return { imagePath, outcome };
  } finally {
    await app.stop();
    app.unregisterSignals?.();
  }
}

const isMain = process.argv[1] && (
  process.argv[1].endsWith(`${'src'}/notify-cli.js`) ||
  process.argv[1].endsWith(`${'src'}\\notify-cli.js`)
);

if (isMain) {
  try {
    const args = parseNotifyArgs(process.argv.slice(2));
    const result = await notifyImage(args);
    logger.info('notify_cli_sent', {
      path: result.imagePath,
      notifiers: result.outcome.results?.map((r) => ({ notifier: r.notifier, ok: r.ok })),
    });
  } catch (err) {
    logger.error('notify_cli_failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    process.exitCode = 1;
  }
}
