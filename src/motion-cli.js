/**
 * CLI: node --env-file=.env src/motion-cli.js
 * Single scan: MOTION_ONCE=1
 */

import { createMotion } from './motion/index.js';
import { installGracefulShutdown } from './shutdown.js';
import { logger } from './logger.js';

const motion = createMotion({ createAppIfNeeded: true });

installGracefulShutdown({
  timeoutMs: Number.parseInt(process.env.SHUTDOWN_TIMEOUT_MS || '15000', 10) || 15000,
  onShutdown: async () => {
    await motion.stop();
  },
});

try {
  await motion.start();
  if (motion.config.once) {
    await motion.stop();
    process.exit(0);
  }
} catch (err) {
  logger.error('motion_cli_fatal', {
    error: err instanceof Error ? err.message : String(err),
  });
  process.exit(1);
}
