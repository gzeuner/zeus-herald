import { createTelegramNotifier } from './telegram.js';
import { createNtfyNotifier } from './ntfy.js';
import { logger } from '../logger.js';

/**
 * @typedef {object} Notifier
 * @property {string} name
 * @property {(payload: import('./base.js').NotifyPayload) => Promise<import('./base.js').SendResult>} send
 * @property {() => Promise<import('./base.js').HealthResult>} health
 */

/**
 * @typedef {object} HubSendOutcome
 * @property {boolean} ok
 * @property {import('./base.js').SendResult[]} results
 * @property {string} [error]
 */

/**
 * Build enabled notifiers from config (env-first).
 * @param {ReturnType<import('../config.js').loadConfig>} config
 * @param {{ fetchImpl?: typeof fetch }} [deps]
 * @returns {Notifier[]}
 */
export function createNotifiers(config, deps = {}) {
  /** @type {Notifier[]} */
  const list = [];
  const fetchImpl = deps.fetchImpl;
  const timeoutMs = config.notifier.timeoutMs;

  if (config.telegram.enabled) {
    list.push(
      createTelegramNotifier({
        botToken: config.telegram.botToken,
        chatId: config.telegram.chatId,
        timeoutMs,
        fetchImpl,
      }),
    );
  }

  if (config.ntfy.enabled) {
    list.push(
      createNtfyNotifier({
        url: config.ntfy.url,
        token: config.ntfy.token,
        timeoutMs,
        fetchImpl,
      }),
    );
  }

  return list;
}

/**
 * @param {Notifier[]} notifiers
 */
export function createNotifierHub(notifiers) {
  /**
   * Fan-out send: isolated failures, overall ok if ≥1 success.
   * @param {string} imagePath
   * @param {string} [caption]
   * @param {Record<string, unknown>} [metadata]
   * @returns {Promise<HubSendOutcome>}
   */
  async function sendAcceptedFrame(imagePath, caption, metadata) {
    if (!notifiers.length) {
      logger.error('send_accepted_frame_no_notifiers');
      return { ok: false, results: [], error: 'no_notifiers_enabled' };
    }

    const payload = { imagePath, caption, metadata };
    const settled = await Promise.allSettled(
      notifiers.map((n) => n.send(payload)),
    );

    /** @type {import('./base.js').SendResult[]} */
    const results = settled.map((item, i) => {
      if (item.status === 'fulfilled') return item.value;
      return {
        ok: false,
        notifier: notifiers[i]?.name || 'unknown',
        error: item.reason instanceof Error ? item.reason.message : 'rejected',
      };
    });

    for (const r of results) {
      if (r.ok) {
        logger.info('notifier_send_ok', {
          notifier: r.notifier,
          remoteId: r.remoteId,
          durationMs: r.durationMs,
        });
      } else {
        logger.warn('notifier_send_fail', {
          notifier: r.notifier,
          error: r.error,
          durationMs: r.durationMs,
        });
      }
    }

    const ok = results.some((r) => r.ok);
    return { ok, results };
  }

  /**
   * @returns {Promise<{ ok: boolean, checks: Array<{ name: string } & import('./base.js').HealthResult> }>}
   */
  async function health() {
    const checks = await Promise.all(
      notifiers.map(async (n) => {
        try {
          const h = await n.health();
          return { name: n.name, ...h };
        } catch (err) {
          return {
            name: n.name,
            ok: false,
            detail: err instanceof Error ? err.message : 'health_failed',
          };
        }
      }),
    );
    const ok = checks.length > 0 && checks.every((c) => c.ok);
    return { ok, checks };
  }

  return {
    notifiers,
    sendAcceptedFrame,
    health,
  };
}
