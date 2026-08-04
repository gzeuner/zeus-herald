/**
 * Ingest module: capture camera snapshots → images/received/ (ADR-005).
 */

import { loadIngestConfig, ingestSecretValues } from './config.js';
import { fetchReolinkSnapshots } from './reolink.js';
import { fetchUpcamSnapshot } from './upcam.js';
import { writeReceivedFrame } from './writer.js';
import { logger, setRedactions } from '../logger.js';
import { createApp } from '../app.js';
import { createRequestGate } from '../http/requestGate.js';

export { loadIngestConfig, ingestSecretValues } from './config.js';
export { writeReceivedFrame } from './writer.js';
export { buildReolinkMotionStateUrl, buildReolinkSnapshotUrl, fetchReolinkMotionState, fetchReolinkSnapshot, fetchReolinkSnapshots, parseReolinkMotionState } from './reolink.js';
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
  const requestGate = createRequestGate({ maxConcurrent: 1 });
  let app = options.app ?? null;
  let stopped = false;
  let failureStreak = 0;
  /** @type {ReturnType<typeof setTimeout> | null} */
  let timer = null;

  /**
   * @param {string} [requestId]
   */
  async function captureOnce(requestId) {
    return requestGate.run(async () => {
      const source = config.cameraType;
      const frames = source === 'reolink'
        ? await fetchReolinkSnapshots({
            config: config.reolink,
            timeoutMs: config.timeoutMs,
            fetchImpl,
          })
        : [
            {
              ...(await fetchUpcamSnapshot({
                config: config.upcam,
                timeoutMs: config.timeoutMs,
                fetchImpl,
              })),
              burstIndex: 1,
              burstCount: 1,
            },
          ];

      const writtenFrames = [];
      for (const frame of frames) {
      const frameRequestId = frame.burstCount > 1 && requestId
        ? `${requestId}:${frame.burstIndex}`
        : requestId;
      const written = await writeReceivedFrame({
        targetDir: config.targetDir,
        cameraId: config.cameraId,
        source,
        buffer: frame.buffer,
        contentType: frame.contentType,
        writeMetadata: config.writeMetadata,
        requestId: frameRequestId,
        extraMetadata: {
          ...(frame.burstCount > 1
            ? { burstIndex: frame.burstIndex, burstCount: frame.burstCount }
            : {}),
          ...(frame.motionSignal
            ? { cameraMotionSignal: true, cameraMotionRawState: frame.motionSignal.rawState }
            : {}),
        },
      });

      logger.info('ingest_frame_written', {
        camera: config.cameraId,
        source,
        path: written.imagePath,
        bytes: frame.buffer.length,
        mode: config.mode,
        burstIndex: frame.burstIndex,
        burstCount: frame.burstCount,
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
        writtenFrames.push({ ...written, notify: outcome });
      } else {
        writtenFrames.push({ ...written, notify: null });
      }
      }

      if (writtenFrames.length === 1) return writtenFrames[0];
      return { frames: writtenFrames, notify: null };
    });
  }

  function scheduleNext() {
    if (stopped || config.once) return;
    const backoffMs = failureStreak > 0
      ? Math.min(config.intervalMs * (2 ** Math.min(failureStreak, 5)), 30000)
      : config.intervalMs;
    timer = setTimeout(() => {
      void tick();
    }, backoffMs);
  }

  async function tick() {
    if (stopped) return;
    try {
      await captureOnce();
      failureStreak = 0;
    } catch (err) {
      failureStreak += 1;
      const retryInMs = Math.min(config.intervalMs * (2 ** Math.min(failureStreak, 5)), 30000);
      logger.warn('ingest_capture_failed', {
        error: err instanceof Error ? err.message : String(err),
        camera: config.cameraId,
        source: config.cameraType,
        failureStreak,
        retryInMs,
        requests: requestGate.metrics(),
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
