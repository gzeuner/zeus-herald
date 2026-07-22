/**
 * Env-first configuration for zeus-herald.
 * Load secrets via `node --env-file=.env` (see package.json scripts).
 */

/**
 * @param {string | undefined} value
 * @returns {boolean}
 */
function isExplicitlyDisabled(value) {
  if (value === undefined || value === null || value === '') return false;
  const v = String(value).trim().toLowerCase();
  return v === '0' || v === 'false' || v === 'no' || v === 'off';
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 */
export function loadConfig(env = process.env) {
  const timeoutMs = Number.parseInt(env.NOTIFIER_TIMEOUT_MS || '30000', 10);
  const telegramToken = (env.TELEGRAM_BOT_TOKEN || '').trim();
  const telegramChatId = (env.TELEGRAM_CHAT_ID || '').trim();
  const ntfyUrl = (env.NTFY_URL || '').trim();

  const telegramEnabled =
    !isExplicitlyDisabled(env.TELEGRAM_ENABLED) &&
    telegramToken.length > 0 &&
    telegramChatId.length > 0;

  const ntfyEnabled =
    !isExplicitlyDisabled(env.NTFY_ENABLED) && ntfyUrl.length > 0;

  return {
    telegram: {
      enabled: telegramEnabled,
      botToken: telegramToken,
      chatId: telegramChatId,
    },
    ntfy: {
      enabled: ntfyEnabled,
      url: ntfyUrl,
      token: (env.NTFY_TOKEN || '').trim(),
    },
    notifier: {
      timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 30000,
    },
  };
}

/**
 * Values that must never appear in logs.
 * @param {ReturnType<typeof loadConfig>} config
 * @returns {string[]}
 */
export function secretValues(config) {
  return [config.telegram.botToken, config.ntfy.token].filter((s) => s && s.length > 0);
}
