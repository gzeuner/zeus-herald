/**
 * Event state: confirm, cooldown, max sends (ADR-006).
 */

export class MotionEventState {
  /**
   * @param {object} options
   * @param {number} options.confirmCount
   * @param {number} options.cooldownMs
   * @param {number} options.maxSendsPerEvent
   * @param {number} options.eventIdleMs
   */
  constructor(options) {
    this.confirmCount = Math.max(1, options.confirmCount);
    this.cooldownMs = Math.max(0, options.cooldownMs);
    this.maxSendsPerEvent = Math.max(1, options.maxSendsPerEvent);
    this.eventIdleMs = Math.max(0, options.eventIdleMs);

    this.positiveStreak = 0;
    this.sendsThisEvent = 0;
    this.cooldownUntil = 0;
    this.lastPositiveAt = 0;
    this.lastSendAt = 0;
  }

  /**
   * @param {boolean} motionPositive
   * @param {number} now
   * @returns {{ allowSend: boolean, reasonGate: string | null, metrics: Record<string, unknown> }}
   */
  evaluate(motionPositive, now = Date.now()) {
    if (
      this.lastPositiveAt &&
      this.eventIdleMs > 0 &&
      now - this.lastPositiveAt > this.eventIdleMs &&
      !motionPositive
    ) {
      this.resetEvent();
    }

    if (motionPositive) {
      this.positiveStreak += 1;
      this.lastPositiveAt = now;
    } else {
      this.positiveStreak = 0;
    }

    const confirmed = this.positiveStreak >= this.confirmCount;
    const inCooldown = now < this.cooldownUntil;
    const maxed = this.sendsThisEvent >= this.maxSendsPerEvent;

    /** @type {string | null} */
    let reasonGate = null;
    let allowSend = false;

    if (!motionPositive) {
      reasonGate = 'no_delta';
    } else if (!confirmed) {
      reasonGate = 'confirming';
    } else if (inCooldown) {
      reasonGate = 'cooldown';
    } else if (maxed) {
      reasonGate = 'max_sends';
    } else {
      allowSend = true;
    }

    return {
      allowSend,
      reasonGate,
      metrics: {
        positiveStreak: this.positiveStreak,
        confirmCount: this.confirmCount,
        confirmed,
        inCooldown,
        cooldownRemainingMs: Math.max(0, this.cooldownUntil - now),
        sendsThisEvent: this.sendsThisEvent,
        maxSendsPerEvent: this.maxSendsPerEvent,
      },
    };
  }

  /**
   * @param {number} now
   */
  recordSend(now = Date.now()) {
    this.sendsThisEvent += 1;
    this.lastSendAt = now;
    this.cooldownUntil = now + this.cooldownMs;
  }

  resetEvent() {
    this.positiveStreak = 0;
    this.sendsThisEvent = 0;
    this.cooldownUntil = 0;
  }
}
