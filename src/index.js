/**
 * zeus-herald entrypoint.
 */

import { createApp } from './app.js';
import { logger } from './logger.js';

export const version = '0.1.0';

export { loadConfig, secretValues } from './config.js';
export { createNotifiers, createNotifierHub } from './notifiers/index.js';
export { logger, setRedactions } from './logger.js';
export { createApp, loadRuntimeOptions } from './app.js';
export { BoundedQueue } from './queue.js';
export { RuntimeSupervisor } from './runtimeSupervisor.js';
export { createIngest, loadIngestConfig } from './ingest/index.js';
export { createMotion, loadMotionConfig } from './motion/index.js';

const isMain =
  process.argv[1] &&
  (process.argv[1].endsWith(`${'src'}/index.js`) ||
    process.argv[1].endsWith(`${'src'}\\index.js`));

if (isMain) {
  const app = createApp({ installSignals: true });
  logger.info('zeus_herald_boot', {
    version,
    telegramEnabled: app.config.telegram.enabled,
    ntfyEnabled: app.config.ntfy.enabled,
  });

  if (!app.notifiers.length) {
    logger.warn('no_notifiers_enabled', {
      hint: 'Set TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID and/or NTFY_URL (see .env.example)',
    });
  }

  await app.start();

  // Idle long-running process: heartbeat keeps health fresh until signal.
  // Work is pushed via enqueueNotify from future ingest/watchers.
}
