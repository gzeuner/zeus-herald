import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractChatsFromUpdates,
  formatChatList,
  getTelegramChats,
  parseTelegramChatIdArgs,
} from '../src/telegram-chat-id-cli.js';

test('parseTelegramChatIdArgs reads token and limit', () => {
  const args = parseTelegramChatIdArgs(['--limit', '5'], {
    TELEGRAM_BOT_TOKEN: ' tok ',
  });
  assert.equal(args.botToken, 'tok');
  assert.equal(args.limit, 5);
});

test('extractChatsFromUpdates returns unique chats', () => {
  const chats = extractChatsFromUpdates([
    { update_id: 1, message: { chat: { id: 123, type: 'private', first_name: 'A' } } },
    { update_id: 2, message: { chat: { id: -1001, type: 'supergroup', title: 'Home' } } },
    { update_id: 3, edited_message: { chat: { id: -1001, type: 'supergroup', title: 'Home' } } },
  ]);

  assert.deepEqual(chats, [
    { id: '123', type: 'private', name: 'A', username: '' },
    { id: '-1001', type: 'supergroup', name: 'Home', username: '' },
  ]);
});

test('getTelegramChats calls getUpdates without exposing token', async () => {
  const fetchImpl = async (url, init) => {
    assert.match(String(url), /getUpdates\?limit=2$/);
    assert.match(String(url), /botSECRET_TOKEN/);
    assert.equal(init.method, 'GET');
    return {
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        result: [
          { update_id: 1, message: { chat: { id: -100, type: 'group', title: 'Family' } } },
        ],
      }),
    };
  };

  const chats = await getTelegramChats({
    botToken: 'SECRET_TOKEN',
    limit: 2,
    fetchImpl,
  });

  assert.equal(chats[0].id, '-100');
  assert.equal(chats[0].name, 'Family');
});

test('formatChatList explains empty and populated results', () => {
  assert.match(formatChatList({ chats: [] }), /No Telegram chats found/);
  assert.match(
    formatChatList({ chats: [{ id: '-100', type: 'group', name: 'Family', username: '' }] }),
    /TELEGRAM_CHAT_ID/,
  );
});
