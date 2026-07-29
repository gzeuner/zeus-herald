/**
 * CLI: node --env-file=.env src/motion-cli.js
 * Single scan: MOTION_ONCE=1
 */

import { createMotion } from './motion/index.js';
import { installGracefulShutdown } from './shutdown.js';
import { logger } from './logger.js';
import { acquireProcessLock } from './processLock.js';
import { startCleanup } from './cleanup.js';

const lock = await acquireProcessLock('motion');
const motion = createMotion({ createAppIfNeeded: true });
const cleanup = startCleanup();

installGracefulShutdown({
  timeoutMs: Number.parseInt(process.env.SHUTDOWN_TIMEOUT_MS || '15000', 10) || 15000,
  onShutdown: async () => {
    await motion.stop();
    cleanup.stop();
    await lock.release();
  },
});

try {
  await motion.start();
  if (motion.config.once) {
    await motion.stop();
    cleanup.stop();
    await lock.release();
    process.exit(0);
  }
} catch (err) {
  logger.error('motion_cli_fatal', {
    error: err instanceof Error ? err.message : String(err),
  });
  cleanup.stop();
  await lock.release();
  process.exit(1);
}
