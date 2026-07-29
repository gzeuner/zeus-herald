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
 * @param {string | undefined} raw
 * @param {number} fallback
 */
function parsePositiveInt(raw, fallback) {
  const n = Number.parseInt(raw || '', 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/**
 * @param {string | undefined} value
 * @param {boolean} defaultValue
 */
function parseBool(value, defaultValue) {
  if (value === undefined || value === null || value === '') return defaultValue;
  const v = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(v)) return true;
  if (['0', 'false', 'no', 'off'].includes(v)) return false;
  return defaultValue;
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 */
export function loadConfig(env = process.env) {
  const timeoutMs = parsePositiveInt(env.NOTIFIER_TIMEOUT_MS, 30000);
  const imageMaxWidth = parsePositiveInt(env.NOTIFIER_IMAGE_MAX_WIDTH, 1920);
  const imageJpegQuality = Math.min(100, Math.max(1, parsePositiveInt(env.NOTIFIER_IMAGE_JPEG_QUALITY, 88)));
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
      timeoutMs,
      imageCompression: {
        enabled: parseBool(env.NOTIFIER_IMAGE_COMPRESSION_ENABLED, true),
        maxWidth: imageMaxWidth,
        jpegQuality: imageJpegQuality,
      },
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


