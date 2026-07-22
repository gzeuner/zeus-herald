import { readFile, mkdir, rename, writeFile, copyFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { decideFrame } from './decide.js';
import { logger } from '../logger.js';

/**
 * @param {object} options
 * @param {ReturnType<import('./config.js').loadMotionConfig>} options.config
 * @param {import('./state.js').MotionEventState} options.eventState
 * @param {{ enqueueNotify: Function } | null} options.app
 * @param {Uint8Array | null} options.previousSamples
 */
export function createProcessor(options) {
  const { config, eventState, app } = options;
  let previousSamples = options.previousSamples ?? null;

  /**
   * @param {string} imagePath
   * @param {Record<string, unknown>} [extraMeta]
   */
  async function processFile(imagePath, extraMeta = {}) {
    const buffer = await readFile(imagePath);
    const now = Date.now();
    const { decision, samples } = decideFrame(
      buffer,
      config,
      previousSamples,
      eventState,
      now,
    );
    previousSamples = samples;

    const base = path.basename(imagePath);
    await mkdir(path.resolve(config.filteredDir), { recursive: true });
    await mkdir(path.resolve(config.sentDir), { recursive: true });

    if (decision.send) {
      eventState.recordSend(now);
      let notifyOutcome = null;
      if (config.notifyEnabled && app) {
        const caption = `motion ${decision.reason} score=${decision.metrics.score}`;
        notifyOutcome = await app.enqueueNotify(imagePath, caption, {
          ...extraMeta,
          decision,
          title: 'zeus-herald motion',
        });
      }

      const dest = path.join(path.resolve(config.sentDir), base);
      await moveFile(imagePath, dest);
      await writeDecisionSidecar(dest, decision, notifyOutcome);

      logger.info('motion_send', {
        reason: decision.reason,
        score: decision.metrics.score,
        path: dest,
        notifyOk: notifyOutcome?.ok ?? null,
      });

      return { decision, dest, notifyOutcome };
    }

    const dest = path.join(path.resolve(config.filteredDir), base);
    await moveFile(imagePath, dest);
    await writeDecisionSidecar(dest, decision, null);

    logger.info('motion_filter', {
      reason: decision.reason,
      score: decision.metrics.score,
      path: dest,
    });

    return { decision, dest, notifyOutcome: null };
  }

  return {
    processFile,
    getPreviousSamples: () => previousSamples,
    setPreviousSamples: (s) => {
      previousSamples = s;
    },
  };
}

/**
 * @param {string} from
 * @param {string} to
 */
async function moveFile(from, to) {
  try {
    await rename(from, to);
  } catch (err) {
    // Cross-device or Windows lock: copy + unlink
    if (err && /** @type {NodeJS.ErrnoException} */ (err).code === 'EXDEV') {
      await copyFile(from, to);
      await unlink(from);
      return;
    }
    // Destination exists or rename failed: copy overwrite path
    await copyFile(from, to);
    await unlink(from);
  }
}

/**
 * @param {string} imagePath
 * @param {import('./decide.js').MotionDecision} decision
 * @param {object | null} notifyOutcome
 */
async function writeDecisionSidecar(imagePath, decision, notifyOutcome) {
  const sidecar = `${imagePath}.decision.json`;
  const body = {
    at: new Date().toISOString(),
    send: decision.send,
    reason: decision.reason,
    metrics: decision.metrics,
    notifyOk: notifyOutcome?.ok ?? null,
  };
  await writeFile(sidecar, `${JSON.stringify(body, null, 2)}\n`, 'utf8');
}
