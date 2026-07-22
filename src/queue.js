/**
 * Bounded serial task queue with explicit drop policy.
 */

/**
 * @typedef {'drop_oldest' | 'reject'} DropPolicy
 */

/**
 * @typedef {object} QueueMetrics
 * @property {number} depth
 * @property {number} enqueued
 * @property {number} dropped
 * @property {number} processed
 * @property {number} errors
 * @property {number} maxDepth
 * @property {boolean} running
 * @property {boolean} accepting
 */

export class BoundedQueue {
  /**
   * @param {object} [options]
   * @param {number} [options.maxSize]
   * @param {DropPolicy} [options.dropPolicy]
   */
  constructor(options = {}) {
    this.maxSize = Math.max(1, options.maxSize ?? 100);
    this.dropPolicy = options.dropPolicy === 'reject' ? 'reject' : 'drop_oldest';
    /** @type {Array<{ taskFn: () => Promise<unknown>, resolve: (v: unknown) => void, reject: (e: unknown) => void }>} */
    this.queue = [];
    this.running = false;
    this.accepting = true;
    /** @type {Array<() => void>} */
    this.idleResolvers = [];
    this.stats = {
      enqueued: 0,
      dropped: 0,
      processed: 0,
      errors: 0,
      maxDepth: 0,
    };
  }

  /**
   * @param {() => Promise<unknown>} taskFn
   * @returns {Promise<unknown>}
   */
  enqueue(taskFn) {
    if (!this.accepting) {
      this.stats.dropped += 1;
      return Promise.reject(new Error('queue_not_accepting'));
    }

    if (this.queue.length >= this.maxSize) {
      if (this.dropPolicy === 'reject') {
        this.stats.dropped += 1;
        return Promise.reject(new Error('queue_full'));
      }
      const dropped = this.queue.shift();
      this.stats.dropped += 1;
      dropped?.reject(new Error('queue_dropped_oldest'));
    }

    return new Promise((resolve, reject) => {
      this.queue.push({ taskFn, resolve, reject });
      this.stats.enqueued += 1;
      this.stats.maxDepth = Math.max(this.stats.maxDepth, this.queue.length);
      this.ensureDrain();
    });
  }

  stopAccepting() {
    this.accepting = false;
  }

  /**
   * @returns {Promise<void>}
   */
  whenIdle() {
    if (!this.running && this.queue.length === 0) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this.idleResolvers.push(resolve);
    });
  }

  /**
   * @returns {QueueMetrics}
   */
  metrics() {
    return {
      depth: this.queue.length,
      enqueued: this.stats.enqueued,
      dropped: this.stats.dropped,
      processed: this.stats.processed,
      errors: this.stats.errors,
      maxDepth: this.stats.maxDepth,
      running: this.running,
      accepting: this.accepting,
    };
  }

  ensureDrain() {
    if (this.running) return;
    this.running = true;
    void this.drain();
  }

  async drain() {
    try {
      while (this.queue.length) {
        const item = this.queue.shift();
        if (!item) break;
        try {
          const result = await item.taskFn();
          this.stats.processed += 1;
          item.resolve(result);
        } catch (error) {
          this.stats.errors += 1;
          item.reject(error);
        }
      }
    } finally {
      this.running = false;
      const resolvers = this.idleResolvers.splice(0);
      for (const resolve of resolvers) resolve();
      if (this.queue.length) this.ensureDrain();
    }
  }
}
