/**
 * Ingest module: capture camera snapshots → images/received/ (ADR-005).
 */

import { loadIngestConfig, ingestSecretValues } from './config.js';
import { fetchReolinkSnapshot } from './reolink.js';
import { fetchUpcamSnapshot } from './upcam.js';
import { writeReceivedFrame } from './writer.js';
import { logger, setRedactions } from '../logger.js';
import { createApp } from '../app.js';

export { loadIngestConfig, ingestSecretValues } from './config.js';
export { writeReceivedFrame } from './writer.js';
export { buildReolinkSnapshotUrl, fetchReolinkSnapshot } from './reolink.js';
export { buildUpcamSnapshotUrl, fetchUpcamSnapshot } from './upcam.js';

/**
 * @param {NodeJS.ProcessEnv} env
 * @param {ReturnType<typeof loadIngestConfig>} config
 */
function applyRedactions(env, config) {
  const secrets = [
    ...ingestSecretValues(config),
    (env.TELEGRAM_BOT_TOKEN || '').trim(),
    (env.NTFY_TOKEN || '').trim(),
  ].filter(Boolean);
  setRedactions(secrets);
}

/**
 * @param {object} [options]
 * @param {NodeJS.ProcessEnv} [options.env]
 * @param {typeof fetch} [options.fetchImpl]
 * @param {ReturnType<typeof createApp> | null} [options.app]
 * @param {boolean} [options.installSignals]
 */
export function createIngest(options = {}) {
  const env = options.env || process.env;
  const config = loadIngestConfig(env);
  applyRedactions(env, config);

  const fetchImpl = options.fetchImpl || globalThis.fetch;
  let app = options.app ?? null;
  let stopped = false;
  /** @type {ReturnType<typeof setTimeout> | null} */
  let timer = null;

  /**
   * @param {string} [requestId]
   */
  async function captureOnce(requestId) {
    const source = config.cameraType;
    let buffer;
    let contentType;

    if (source === 'reolink') {
      ({ buffer, contentType } = await fetchReolinkSnapshot({
        config: config.reolink,
        timeoutMs: config.timeoutMs,
        fetchImpl,
      }));
    } else {
      ({ buffer, contentType } = await fetchUpcamSnapshot({
        config: config.upcam,
        timeoutMs: config.timeoutMs,
        fetchImpl,
      }));
    }

    const written = await writeReceivedFrame({
      targetDir: config.targetDir,
      cameraId: config.cameraId,
      source,
      buffer,
      contentType,
      writeMetadata: config.writeMetadata,
      requestId,
    });

    logger.info('ingest_frame_written', {
      camera: config.cameraId,
      source,
      path: written.imagePath,
      bytes: buffer.length,
      mode: config.mode,
    });

    if (config.mode === 'direct_notify') {
      if (!app) {
        app = createApp({
          env,
          fetchImpl,
          installSignals: options.installSignals === true,
        });
        await app.start();
      }
      const caption = `${config.cameraId} ${written.metadata.capturedAt}`;
      const outcome = await app.enqueueNotify(written.imagePath, caption, {
        ...written.metadata,
        title: config.cameraId,
      });
      logger.info('ingest_direct_notify', {
        ok: outcome.ok,
        path: written.imagePath,
      });
      return { ...written, notify: outcome };
    }

    return { ...written, notify: null };
  }

  function scheduleNext() {
    if (stopped || config.once) return;
    timer = setTimeout(() => {
      void tick();
    }, config.intervalMs);
  }

  async function tick() {
    if (stopped) return;
    try {
      await captureOnce();
    } catch (err) {
      logger.warn('ingest_capture_failed', {
        error: err instanceof Error ? err.message : String(err),
        camera: config.cameraId,
        source: config.cameraType,
      });
    }
    scheduleNext();
  }

  async function start() {
    stopped = false;
    logger.info('ingest_start', {
      cameraType: config.cameraType,
      cameraId: config.cameraId,
      mode: config.mode,
      targetDir: config.targetDir,
      intervalMs: config.intervalMs,
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
    }
    logger.info('ingest_stopped');
  }

  return {
    config,
    captureOnce,
    start,
    stop,
  };
}
