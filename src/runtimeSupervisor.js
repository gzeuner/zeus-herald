import { mkdir, writeFile, rename, appendFile } from 'node:fs/promises';
import path from 'node:path';
import { logger } from './logger.js';

/**
 * Lightweight runtime supervisor: health file + counters + optional decision log.
 */
export class RuntimeSupervisor {
  /**
   * @param {object} [options]
   * @param {string} [options.healthFile]
   * @param {string} [options.decisionLogFile]
   * @param {boolean} [options.decisionLogEnabled]
   */
  constructor(options = {}) {
    this.healthFile = path.resolve(options.healthFile || 'state/health.json');
    this.decisionLogFile = path.resolve(
      options.decisionLogFile || 'logs/decisions.ndjson',
    );
    this.decisionLogEnabled = Boolean(options.decisionLogEnabled);
    this.startedAt = Date.now();
    /** @type {'starting'|'running'|'stopping'|'stopped'} */
    this.status = 'starting';
    this.lastHeartbeatAt = 0;
    this.lastSendOkAt = 0;
    this.lastSendFailAt = 0;
    this.sendOkCount = 0;
    this.sendFailCount = 0;
    this.rssBytes = 0;
    this.heapUsedBytes = 0;
    /** @type {object | null} */
    this.lastNotifierHealth = null;
    /** @type {object | null} */
    this.lastQueueMetrics = null;
    this.lastError = null;
  }

  markRunning() {
    this.status = 'running';
  }

  markStopping() {
    this.status = 'stopping';
  }

  markStopped() {
    this.status = 'stopped';
  }

  /**
   * @param {NodeJS.MemoryUsage} [mem]
   */
  sampleMemory(mem = process.memoryUsage()) {
    this.rssBytes = mem.rss;
    this.heapUsedBytes = mem.heapUsed;
  }

  /**
   * @param {object} metrics
   */
  recordQueueMetrics(metrics) {
    this.lastQueueMetrics = metrics;
  }

  /**
   * @param {object} health
   */
  recordNotifierHealth(health) {
    this.lastNotifierHealth = health;
    this.lastHeartbeatAt = Date.now();
  }

  /**
   * @param {boolean} ok
   */
  recordSend(ok) {
    const at = Date.now();
    if (ok) {
      this.sendOkCount += 1;
      this.lastSendOkAt = at;
    } else {
      this.sendFailCount += 1;
      this.lastSendFailAt = at;
    }
  }

  /**
   * @param {string} message
   */
  recordError(message) {
    this.lastError = { at: new Date().toISOString(), message: String(message).slice(0, 500) };
  }

  /**
   * @returns {object}
   */
  snapshot() {
    return {
      status: this.status,
      startedAt: new Date(this.startedAt).toISOString(),
      uptimeMs: Date.now() - this.startedAt,
      lastHeartbeatAt: this.lastHeartbeatAt
        ? new Date(this.lastHeartbeatAt).toISOString()
        : null,
      lastSendOkAt: this.lastSendOkAt
        ? new Date(this.lastSendOkAt).toISOString()
        : null,
      lastSendFailAt: this.lastSendFailAt
        ? new Date(this.lastSendFailAt).toISOString()
        : null,
      sendOkCount: this.sendOkCount,
      sendFailCount: this.sendFailCount,
      memory: {
        rssBytes: this.rssBytes,
        heapUsedBytes: this.heapUsedBytes,
      },
      queue: this.lastQueueMetrics,
      notifiers: this.lastNotifierHealth,
      lastError: this.lastError,
    };
  }

  async writeHealth() {
    const payload = `${JSON.stringify(this.snapshot(), null, 2)}\n`;
    await mkdir(path.dirname(this.healthFile), { recursive: true });
    const tmp = `${this.healthFile}.${process.pid}.tmp`;
    await writeFile(tmp, payload, 'utf8');
    await rename(tmp, this.healthFile);
  }

  /**
   * @param {object} decision
   */
  async appendDecision(decision) {
    if (!this.decisionLogEnabled) return;
    const line = `${JSON.stringify({ at: new Date().toISOString(), ...decision })}\n`;
    await mkdir(path.dirname(this.decisionLogFile), { recursive: true });
    await appendFile(this.decisionLogFile, line, 'utf8');
  }

  /**
   * Heartbeat tick: memory + optional notifier health + health file.
   * @param {{ hub?: { health: () => Promise<object> }, queue?: { metrics: () => object } }} [deps]
   */
  async heartbeat(deps = {}) {
    try {
      this.sampleMemory();
      if (deps.queue) {
        this.recordQueueMetrics(deps.queue.metrics());
      }
      if (deps.hub) {
        const h = await deps.hub.health();
        this.recordNotifierHealth(h);
      } else {
        this.lastHeartbeatAt = Date.now();
      }
      await this.writeHealth();
      logger.debug('heartbeat_ok', {
        rssBytes: this.rssBytes,
        queueDepth: this.lastQueueMetrics?.depth,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.recordError(msg);
      logger.warn('heartbeat_failed', { error: msg });
    }
  }
}
