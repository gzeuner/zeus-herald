/**
 * zeus-herald entrypoint.
 */

import { loadConfig, secretValues } from './config.js';
import { logger, setRedactions } from './logger.js';
import { createNotifiers, createNotifierHub } from './notifiers/index.js';

export const version = '0.1.0';

export { loadConfig, secretValues } from './config.js';
export { createNotifiers, createNotifierHub } from './notifiers/index.js';
export { logger, setRedactions } from './logger.js';

/**
 * Build a ready-to-use hub from the current environment.
 */
export function createAppHub(env = process.env) {
  const config = loadConfig(env);
  setRedactions(secretValues(config));
  const notifiers = createNotifiers(config);
  const hub = createNotifierHub(notifiers);
  return { config, hub, notifiers };
}

const isMain =
  process.argv[1] &&
  (process.argv[1].endsWith('src/index.js') ||
    process.argv[1].endsWith('src\\index.js') ||
    process.argv[1].endsWith('index.js'));

if (isMain) {
  const { config, notifiers } = createAppHub();
  logger.info('zeus_herald_ready', {
    version,
    notifiers: notifiers.map((n) => n.name),
    telegramEnabled: config.telegram.enabled,
    ntfyEnabled: config.ntfy.enabled,
  });

  if (!notifiers.length) {
    logger.warn('no_notifiers_enabled', {
      hint: 'Set TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID and/or NTFY_URL (see .env.example)',
    });
  }
}
