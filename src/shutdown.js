import { logger } from './logger.js';

/**
 * Register SIGINT/SIGTERM once; coordinate graceful stop.
 *
 * @param {object} options
 * @param {() => Promise<void> | void} options.onShutdown
 * @param {number} [options.timeoutMs]
 * @param {NodeJS.Process} [options.proc]
 * @returns {() => void} unregister
 */
export function installGracefulShutdown(options) {
  const {
    onShutdown,
    timeoutMs = 15000,
    proc = process,
  } = options;

  let stopping = false;

  const handler = (signal) => {
    if (stopping) {
      logger.warn('shutdown_forced', { signal });
      proc.exit(1);
      return;
    }
    stopping = true;
    logger.info('shutdown_begin', { signal, timeoutMs });

    const forceTimer = setTimeout(() => {
      logger.error('shutdown_timeout');
      proc.exit(1);
    }, timeoutMs);
    if (typeof forceTimer.unref === 'function') forceTimer.unref();

    Promise.resolve()
      .then(() => onShutdown())
      .then(() => {
        clearTimeout(forceTimer);
        logger.info('shutdown_complete');
        proc.exit(0);
      })
      .catch((err) => {
        clearTimeout(forceTimer);
        logger.error('shutdown_error', {
          error: err instanceof Error ? err.message : String(err),
        });
        proc.exit(1);
      });
  };

  proc.on('SIGINT', handler);
  proc.on('SIGTERM', handler);

  return () => {
    proc.off('SIGINT', handler);
    proc.off('SIGTERM', handler);
  };
}
