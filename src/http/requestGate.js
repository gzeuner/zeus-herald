/**
 * Small async gate for network calls.
 *
 * It intentionally limits concurrency instead of retrying failed requests.
 * This keeps short bursts fast while preventing overlapping calls from
 * consuming a growing number of sockets when a remote endpoint is unhealthy.
 */
export function createRequestGate(options = {}) {
  const maxConcurrent = Math.max(1, Number(options.maxConcurrent) || 1);
  let active = 0;
  /** @type {Array<() => void>} */
  const pending = [];

  function drain() {
    while (active < maxConcurrent && pending.length) {
      active += 1;
      pending.shift()();
    }
  }

  /**
   * @template T
   * @param {() => Promise<T>} operation
   * @returns {Promise<T>}
   */
  function run(operation) {
    return new Promise((resolve, reject) => {
      pending.push(() => {
        Promise.resolve()
          .then(operation)
          .then(resolve, reject)
          .finally(() => {
            active -= 1;
            drain();
          });
      });
      drain();
    });
  }

  return {
    run,
    metrics: () => ({ active, pending: pending.length, maxConcurrent }),
  };
}

