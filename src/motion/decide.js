import { computeFrameMetrics } from './metrics.js';

/**
 * @typedef {object} MotionDecision
 * @property {boolean} send
 * @property {string} reason
 * @property {Record<string, unknown>} metrics
 */

/**
 * Pure decision for one frame given state evaluation helpers.
 *
 * @param {Buffer} buffer
 * @param {ReturnType<import('./config.js').loadMotionConfig>} cfg
 * @param {Uint8Array | null} previousSamples
 * @param {import('./state.js').MotionEventState} eventState
 * @param {number} [now]
 * @returns {{ decision: MotionDecision, samples: Uint8Array }}
 */
export function decideFrame(buffer, cfg, previousSamples, eventState, now = Date.now()) {
  const m = computeFrameMetrics(buffer, cfg, previousSamples);

  if (!m.brightnessOk) {
    return {
      decision: {
        send: false,
        reason: 'brightness',
        metrics: baseMetrics(m, eventState, now),
      },
      samples: m.samples,
    };
  }

  if (!m.hasBaseline) {
    return {
      decision: {
        send: false,
        reason: 'baseline',
        metrics: baseMetrics(m, eventState, now),
      },
      samples: m.samples,
    };
  }

  const motionPositive =
    m.score >= cfg.motionScoreThreshold && m.zonePass;

  if (!motionPositive) {
    const gate = eventState.evaluate(false, now);
    return {
      decision: {
        send: false,
        reason: m.zonePass ? 'no_delta' : 'zone',
        metrics: {
          ...baseMetrics(m, eventState, now),
          ...gate.metrics,
        },
      },
      samples: m.samples,
    };
  }

  const gate = eventState.evaluate(true, now);
  if (!gate.allowSend) {
    return {
      decision: {
        send: false,
        reason: gate.reasonGate || 'suppressed',
        metrics: {
          ...baseMetrics(m, eventState, now),
          ...gate.metrics,
        },
      },
      samples: m.samples,
    };
  }

  return {
    decision: {
      send: true,
      reason: 'motion',
      metrics: {
        ...baseMetrics(m, eventState, now),
        ...gate.metrics,
      },
    },
    samples: m.samples,
  };
}

/**
 * @param {ReturnType<typeof computeFrameMetrics>} m
 * @param {import('./state.js').MotionEventState} eventState
 * @param {number} now
 */
function baseMetrics(m, eventState, now) {
  return {
    brightness: Number(m.brightness.toFixed(2)),
    score: Number(m.score.toFixed(5)),
    changed: m.changed,
    compared: m.compared,
    hasBaseline: m.hasBaseline,
    zoneSummary: m.zoneSummary,
    zonePass: m.zonePass,
    positiveStreak: eventState.positiveStreak,
    sendsThisEvent: eventState.sendsThisEvent,
    at: new Date(now).toISOString(),
  };
}
