/**
 * Long-running application wiring: hub + bounded queue + supervisor + heartbeat.
 */

import { loadConfig, secretValues } from './config.js';
import { logger, setRedactions } from './logger.js';
import { createNotifiers, createNotifierHub } from './notifiers/index.js';
import { BoundedQueue } from './queue.js';
import { RuntimeSupervisor } from './runtimeSupervisor.js';
import { installGracefulShutdown } from './shutdown.js';

/**
 * @param {NodeJS.ProcessEnv} [env]
 */
export function loadRuntimeOptions(env = process.env) {
  const maxSize = Number.parseInt(env.QUEUE_MAX_SIZE || '100', 10);
  const heartbeatMs = Number.parseInt(env.HEARTBEAT_MS || '60000', 10);
  const shutdownTimeoutMs = Number.parseInt(env.SHUTDOWN_TIMEOUT_MS || '15000', 10);
  const dropPolicy = env.QUEUE_DROP_POLICY === 'reject' ? 'reject' : 'drop_oldest';

  return {
    queueMaxSize: Number.isFinite(maxSize) && maxSize > 0 ? maxSize : 100,
    dropPolicy,
    heartbeatMs: Number.isFinite(heartbeatMs) && heartbeatMs > 0 ? heartbeatMs : 60000,
    shutdownTimeoutMs:
      Number.isFinite(shutdownTimeoutMs) && shutdownTimeoutMs > 0
        ? shutdownTimeoutMs
        : 15000,
    healthFile: env.HEALTH_FILE || 'state/health.json',
    decisionLogEnabled:
      env.DECISION_LOG === '1' || String(env.DECISION_LOG).toLowerCase() === 'true',
    decisionLogFile: env.DECISION_LOG_FILE || 'logs/decisions.ndjson',
  };
}

/**
 * @param {object} [options]
 * @param {NodeJS.ProcessEnv} [options.env]
 * @param {typeof fetch} [options.fetchImpl]
 * @param {boolean} [options.installSignals]
 */
export function createApp(options = {}) {
  const env = options.env || process.env;
  const config = loadConfig(env);
  setRedactions(secretValues(config));
  const runtime = loadRuntimeOptions(env);

  const notifiers = createNotifiers(config, { fetchImpl: options.fetchImpl });
  const hub = createNotifierHub(notifiers);
  const queue = new BoundedQueue({
    maxSize: runtime.queueMaxSize,
    dropPolicy: runtime.dropPolicy,
  });
  const supervisor = new RuntimeSupervisor({
    healthFile: runtime.healthFile,
    decisionLogEnabled: runtime.decisionLogEnabled,
    decisionLogFile: runtime.decisionLogFile,
  });

  /** @type {ReturnType<typeof setInterval> | null} */
  let heartbeatTimer = null;

  /**
   * Enqueue a notify job (path only — no image buffers in the queue).
   * @param {string} imagePath
   * @param {string} [caption]
   * @param {Record<string, unknown>} [metadata]
   */
  function enqueueNotify(imagePath, caption, metadata) {
    return queue.enqueue(async () => {
      const outcome = await hub.sendAcceptedFrame(imagePath, caption, metadata);
      supervisor.recordSend(outcome.ok);
      await supervisor.appendDecision({
        type: 'notify',
        imagePath,
        ok: outcome.ok,
        results: outcome.results?.map((r) => ({
          notifier: r.notifier,
          ok: r.ok,
          error: r.error,
        })),
      });
      return outcome;
    });
  }

  async function tickHeartbeat() {
    await supervisor.heartbeat({ hub, queue });
  }

  function startHeartbeat() {
    if (heartbeatTimer) return;
    heartbeatTimer = setInterval(() => {
      void tickHeartbeat();
    }, runtime.heartbeatMs);
    // Keep the event loop alive for long-running mode.
    // Callers that only need a one-shot app can stop() / clear via stopHeartbeat.
  }

  function stopHeartbeat() {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  }

  async function start() {
    supervisor.markRunning();
    startHeartbeat();
    await tickHeartbeat();
    logger.info('app_started', {
      notifiers: notifiers.map((n) => n.name),
      queueMaxSize: runtime.queueMaxSize,
      dropPolicy: runtime.dropPolicy,
      heartbeatMs: runtime.heartbeatMs,
    });
  }

  async function stop() {
    supervisor.markStopping();
    stopHeartbeat();
    queue.stopAccepting();
    await queue.whenIdle();
    supervisor.recordQueueMetrics(queue.metrics());
    supervisor.markStopped();
    await supervisor.writeHealth();
  }

  let unregisterSignals = () => {};
  if (options.installSignals !== false) {
    unregisterSignals = installGracefulShutdown({
      timeoutMs: runtime.shutdownTimeoutMs,
      onShutdown: stop,
    });
  }

  return {
    config,
    runtime,
    notifiers,
    hub,
    queue,
    supervisor,
    enqueueNotify,
    start,
    stop,
    tickHeartbeat,
    unregisterSignals,
  };
}
