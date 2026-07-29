const TELEGRAM_API = 'https://api.telegram.org';

/**
 * @param {string[]} argv
 * @param {NodeJS.ProcessEnv} [env]
 */
export function parseTelegramChatIdArgs(argv, env = process.env) {
  const parsed = {
    botToken: (env.TELEGRAM_BOT_TOKEN || '').trim(),
    limit: parsePositiveInt(env.TELEGRAM_UPDATES_LIMIT, 20),
    timeoutMs: parsePositiveInt(env.NOTIFIER_TIMEOUT_MS, 30000),
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--limit') {
      parsed.limit = parsePositiveInt(argv[i + 1], parsed.limit);
      i += 1;
    }
  }

  return parsed;
}

/**
 * @param {string | undefined} value
 * @param {number} fallback
 */
function parsePositiveInt(value, fallback) {
  const n = Number.parseInt(value || '', 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/**
 * @param {number} timeoutMs
 */
function createTimeout(timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return {
    signal: controller.signal,
    clear: () => clearTimeout(timer),
  };
}

/**
 * @param {any} update
 */
function extractMessage(update) {
  return update?.message || update?.edited_message || update?.channel_post || update?.my_chat_member || update?.chat_member;
}

/**
 * @param {any} chat
 */
function formatChat(chat) {
  const name = chat.title || [chat.first_name, chat.last_name].filter(Boolean).join(' ') || chat.username || '';
  return {
    id: String(chat.id),
    type: String(chat.type || 'unknown'),
    name,
    username: chat.username ? `@${chat.username}` : '',
  };
}

/**
 * @param {any[]} updates
 */
export function extractChatsFromUpdates(updates) {
  const byId = new Map();
  for (const update of updates) {
    const message = extractMessage(update);
    const chat = message?.chat;
    if (!chat?.id) continue;
    const formatted = formatChat(chat);
    byId.set(formatted.id, formatted);
  }
  return [...byId.values()];
}

/**
 * @param {object} options
 * @param {string} options.botToken
 * @param {number} [options.limit]
 * @param {number} [options.timeoutMs]
 * @param {typeof fetch} [options.fetchImpl]
 */
export async function getTelegramChats(options) {
  const { botToken, limit = 20, timeoutMs = 30000, fetchImpl = globalThis.fetch } = options;
  if (!botToken) throw new Error('telegram_missing_bot_token');

  const timeout = createTimeout(timeoutMs);
  try {
    const url = `${TELEGRAM_API}/bot${botToken}/getUpdates?limit=${encodeURIComponent(String(limit))}`;
    const res = await fetchImpl(url, { method: 'GET', signal: timeout.signal });
    let body = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }

    if (!res.ok || !body?.ok) {
      const detail = body?.description || body?.error_code || `http_${res.status}`;
      throw new Error(String(detail).slice(0, 300));
    }

    return extractChatsFromUpdates(Array.isArray(body.result) ? body.result : []);
  } finally {
    timeout.clear();
  }
}

/**
 * @param {{ chats: Array<{ id: string, type: string, name: string, username: string }> }} result
 */
export function formatChatList(result) {
  if (!result.chats.length) {
    return [
      'No Telegram chats found in getUpdates.',
      'Send a message in the bot chat or group, then run `npm run telegram:chat-id` again.',
    ].join('\n');
  }

  const lines = ['Telegram chats seen by this bot:'];
  for (const chat of result.chats) {
    const label = [chat.type, chat.name, chat.username].filter(Boolean).join(' | ');
    lines.push(`${chat.id}    ${label}`);
  }
  lines.push('Use the desired value as TELEGRAM_CHAT_ID in local .env. For a private group this is usually a negative id.');
  return lines.join('\n');
}

const isMain = process.argv[1] && (
  process.argv[1].endsWith(`${'src'}/telegram-chat-id-cli.js`) ||
  process.argv[1].endsWith(`${'src'}\\telegram-chat-id-cli.js`)
);

if (isMain) {
  try {
    const args = parseTelegramChatIdArgs(process.argv.slice(2));
    const chats = await getTelegramChats(args);
    console.log(formatChatList({ chats }));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`telegram_chat_id_failed: ${message}`);
    process.exitCode = 1;
  }
}
