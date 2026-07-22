import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createTelegramNotifier } from '../src/notifiers/telegram.js';
import { createNtfyNotifier } from '../src/notifiers/ntfy.js';
import { createNotifiers, createNotifierHub } from '../src/notifiers/hub.js';
import { loadConfig } from '../src/config.js';
import { redact, setRedactions } from '../src/logger.js';
import { truncateCaption } from '../src/notifiers/base.js';

/** minimal JPEG-ish bytes (not a real image, but file present for upload path) */
const FAKE_JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xd9, 0x00, 0x01, 0x02, 0x03]);

async function withTempImage(fn) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'zeus-herald-'));
  const imagePath = path.join(dir, 'shot.jpg');
  await writeFile(imagePath, FAKE_JPEG);
  try {
    return await fn(imagePath);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

describe('telegram adapter', () => {
  test('send success returns remoteId', async () => {
    await withTempImage(async (imagePath) => {
      const fetchImpl = async (url, init) => {
        assert.match(String(url), /sendPhoto$/);
        assert.equal(init.method, 'POST');
        assert.ok(init.body instanceof FormData);
        return {
          ok: true,
          status: 200,
          json: async () => ({ ok: true, result: { message_id: 42 } }),
        };
      };

      const n = createTelegramNotifier({
        botToken: 'SECRET_TOKEN',
        chatId: '99',
        fetchImpl,
      });
      const result = await n.send({ imagePath, caption: 'hello' });
      assert.equal(result.ok, true);
      assert.equal(result.notifier, 'telegram');
      assert.equal(result.remoteId, '42');
    });
  });

  test('send maps API failure', async () => {
    await withTempImage(async (imagePath) => {
      const fetchImpl = async () => ({
        ok: false,
        status: 401,
        json: async () => ({ ok: false, description: 'Unauthorized' }),
      });
      const n = createTelegramNotifier({
        botToken: 'SECRET_TOKEN',
        chatId: '99',
        fetchImpl,
      });
      const result = await n.send({ imagePath });
      assert.equal(result.ok, false);
      assert.match(result.error, /Unauthorized/);
    });
  });

  test('health ok via getMe', async () => {
    const fetchImpl = async (url) => {
      assert.match(String(url), /getMe$/);
      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true, result: { username: 'zeus_bot' } }),
      };
    };
    const n = createTelegramNotifier({
      botToken: 'SECRET_TOKEN',
      chatId: '99',
      fetchImpl,
    });
    const h = await n.health();
    assert.equal(h.ok, true);
    assert.match(h.detail, /zeus_bot/);
  });
});

describe('ntfy adapter', () => {
  test('send success', async () => {
    await withTempImage(async (imagePath) => {
      const fetchImpl = async (url, init) => {
        assert.equal(url, 'https://ntfy.sh/zeus-test');
        assert.equal(init.method, 'PUT');
        assert.ok(Buffer.isBuffer(init.body) || init.body instanceof Uint8Array);
        return {
          ok: true,
          status: 200,
          json: async () => ({ id: 'abc' }),
        };
      };
      const n = createNtfyNotifier({
        url: 'https://ntfy.sh/zeus-test',
        fetchImpl,
      });
      const result = await n.send({ imagePath, caption: 'motion' });
      assert.equal(result.ok, true);
      assert.equal(result.remoteId, 'abc');
    });
  });

  test('send HTTP failure isolated', async () => {
    await withTempImage(async (imagePath) => {
      const fetchImpl = async () => ({
        ok: false,
        status: 500,
        text: async () => 'boom',
      });
      const n = createNtfyNotifier({
        url: 'https://ntfy.sh/zeus-test',
        fetchImpl,
      });
      const result = await n.send({ imagePath });
      assert.equal(result.ok, false);
      assert.match(result.error, /http_500/);
    });
  });
});

describe('hub', () => {
  test('overall ok if one notifier succeeds', async () => {
    await withTempImage(async (imagePath) => {
      const config = loadConfig({
        TELEGRAM_BOT_TOKEN: 'tok',
        TELEGRAM_CHAT_ID: '1',
        NTFY_URL: 'https://ntfy.sh/t',
      });
      let call = 0;
      const fetchImpl = async (url) => {
        call += 1;
        if (String(url).includes('api.telegram.org')) {
          return {
            ok: false,
            status: 500,
            json: async () => ({ ok: false, description: 'down' }),
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ id: 'n1' }),
        };
      };
      const notifiers = createNotifiers(config, { fetchImpl });
      assert.equal(notifiers.length, 2);
      const hub = createNotifierHub(notifiers);
      const outcome = await hub.sendAcceptedFrame(imagePath, 'cap');
      assert.equal(outcome.ok, true);
      assert.equal(outcome.results.length, 2);
      assert.ok(outcome.results.some((r) => r.ok));
      assert.ok(outcome.results.some((r) => !r.ok));
      assert.ok(call >= 2);
    });
  });

  test('no notifiers → not ok', async () => {
    const hub = createNotifierHub([]);
    const outcome = await hub.sendAcceptedFrame('/tmp/x.jpg');
    assert.equal(outcome.ok, false);
    assert.equal(outcome.error, 'no_notifiers_enabled');
  });

  test('disabled via env', () => {
    const config = loadConfig({
      TELEGRAM_BOT_TOKEN: 'tok',
      TELEGRAM_CHAT_ID: '1',
      TELEGRAM_ENABLED: '0',
      NTFY_URL: 'https://ntfy.sh/t',
      NTFY_ENABLED: 'false',
    });
    const notifiers = createNotifiers(config);
    assert.equal(notifiers.length, 0);
  });
});

describe('security helpers', () => {
  test('redact removes secrets from logs', () => {
    setRedactions(['SUPER_SECRET_TOKEN_VALUE']);
    assert.equal(
      redact('token=SUPER_SECRET_TOKEN_VALUE ok'),
      'token=[REDACTED] ok',
    );
  });

  test('truncateCaption respects limit', () => {
    const long = 'x'.repeat(2000);
    assert.equal(truncateCaption(long, 10).length, 10);
  });
});
