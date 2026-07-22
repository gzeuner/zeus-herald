/**
 * Motion processor: received/ → Decision → filtered/ | sent/ + notify (ADR-006).
 */

import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { loadMotionConfig } from './config.js';
import { MotionEventState } from './state.js';
import { createProcessor } from './processor.js';
import { createApp } from '../app.js';
import { logger, setRedactions } from '../logger.js';

export { loadMotionConfig } from './config.js';
export { MotionEventState } from './state.js';
export { decideFrame } from './decide.js';
export { createProcessor } from './processor.js';

/**
 * @param {object} [options]
 * @param {NodeJS.ProcessEnv} [options.env]
 * @param {typeof fetch} [options.fetchImpl]
 * @param {ReturnType<typeof createApp> | null} [options.app]
 * @param {boolean} [options.createAppIfNeeded]
 */
export function createMotion(options = {}) {
  const env = options.env || process.env;
  const config = loadMotionConfig(env);
  setRedactions(
    [(env.TELEGRAM_BOT_TOKEN || '').trim(), (env.NTFY_TOKEN || '').trim()].filter(Boolean),
  );

  const eventState = new MotionEventState({
    confirmCount: config.confirmCount,
    cooldownMs: config.cooldownMs,
    maxSendsPerEvent: config.maxSendsPerEvent,
    eventIdleMs: config.eventIdleMs,
  });

  let app = options.app ?? null;
  /** @type {ReturnType<typeof createProcessor> | null} */
  let processor = null;
  let stopped = false;
  /** @type {ReturnType<typeof setTimeout> | null} */
  let timer = null;
  /** @type {Set<string>} */
  const inFlight = new Set();

  function rebuildProcessor() {
    processor = createProcessor({
      config,
      eventState,
      app: config.notifyEnabled ? app : null,
      previousSamples: processor?.getPreviousSamples() ?? null,
    });
  }

  rebuildProcessor();

  async function ensureApp() {
    if (!config.notifyEnabled) return null;
    if (app) return app;
    if (options.createAppIfNeeded === false) return null;
    app = createApp({
      env,
      fetchImpl: options.fetchImpl,
      installSignals: false,
    });
    await app.start();
    rebuildProcessor();
    return app;
  }

  /**
   * Push API: process a single image path.
   * @param {string} imagePath
   * @param {Record<string, unknown>} [metadata]
   */
  async function processPath(imagePath, metadata) {
    await ensureApp();
    if (!processor) rebuildProcessor();
    return processor.processFile(path.resolve(imagePath), metadata);
  }

  function isImageFile(name) {
    const lower = name.toLowerCase();
    return config.extensions.some((ext) => lower.endsWith(ext));
  }

  async function scanOnce() {
    const dir = path.resolve(config.receivedDir);
    let names = [];
    try {
      names = await readdir(dir);
    } catch (err) {
      if (/** @type {NodeJS.ErrnoException} */ (err).code === 'ENOENT') {
        return [];
      }
      throw err;
    }

    const files = [];
    for (const name of names) {
      if (!isImageFile(name)) continue;
      const full = path.join(dir, name);
      if (inFlight.has(full)) continue;
      try {
        const st = await stat(full);
        if (!st.isFile()) continue;
        files.push({ full, mtime: st.mtimeMs });
      } catch {
        // skip vanished files
      }
    }
    files.sort((a, b) => a.mtime - b.mtime);
    return files;
  }

  async function tick() {
    if (stopped) return;
    const files = await scanOnce();
    for (const f of files) {
      if (stopped) break;
      inFlight.add(f.full);
      try {
        await processPath(f.full);
      } catch (err) {
        logger.warn('motion_process_failed', {
          path: f.full,
          error: err instanceof Error ? err.message : String(err),
        });
      } finally {
        inFlight.delete(f.full);
      }
    }
    if (!stopped && !config.once) {
      timer = setTimeout(() => {
        void tick();
      }, config.pollMs);
    }
  }

  async function start() {
    stopped = false;
    if (config.notifyEnabled) {
      await ensureApp();
    }
    logger.info('motion_start', {
      receivedDir: config.receivedDir,
      filteredDir: config.filteredDir,
      sentDir: config.sentDir,
      notifyEnabled: config.notifyEnabled,
      confirmCount: config.confirmCount,
      cooldownMs: config.cooldownMs,
      once: config.once,
    });
    await tick();
  }

  async function stop() {
    stopped = true;
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (app && options.app == null) {
      await app.stop();
      app.unregisterSignals?.();
      app = null;
    }
    logger.info('motion_stopped');
  }

  return {
    config,
    eventState,
    processPath,
    start,
    stop,
    scanOnce,
  };
}
