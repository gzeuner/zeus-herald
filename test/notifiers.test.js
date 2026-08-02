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
import { loadImageFile, truncateCaption } from '../src/notifiers/base.js';
import { buildNotificationCaption } from '../src/notifiers/caption.js';
import jpeg from 'jpeg-js';

/** minimal JPEG-ish bytes (not a real image, but file present for upload path) */
const FAKE_JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xd9, 0x00, 0x01, 0x02, 0x03]);


function realJpeg(width, height) {
  const data = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    const x = i % width;
    const y = Math.floor(i / width);
    data[i * 4] = (x * 7) % 256;
    data[i * 4 + 1] = (y * 11) % 256;
    data[i * 4 + 2] = ((x + y) * 5) % 256;
    data[i * 4 + 3] = 255;
  }
  return jpeg.encode({ data, width, height }, 90).data;
}
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

describe('notification captions', () => {
  test('default caption is only localized date and time', async () => {
    await withTempImage(async (imagePath) => {
      const caption = await buildNotificationCaption({
        imagePath,
        caption: 'motion score=1',
        metadata: { capturedAt: '2026-07-29T20:15:30.000Z', camera: 'front' },
        captionOptions: { locale: 'de-DE', timeZone: 'Europe/Berlin' },
      });

      assert.equal(caption, '29.07.2026, 22:15:30');
    });
  });

  test('debug caption adds useful technical metadata', async () => {
    await withTempImage(async (imagePath) => {
      const caption = await buildNotificationCaption({
        imagePath,
        caption: 'motion motion score=0.2',
        metadata: {
          capturedAt: '2026-07-29T20:15:30.000Z',
          camera: 'front',
          source: 'reolink',
          burstIndex: 2,
          burstCount: 4,
          cameraMotionSignal: true,
          cameraMotionRawState: 1,
          decision: {
            reason: 'motion',
            metrics: {
              score: 0.23456789,
              changed: 42,
              compared: 100,
              brightness: 88.123456,
              zonePass: true,
              mode: 'image',
              image: {
                width: 512,
                height: 288,
                sourceWidth: 1920,
                sourceHeight: 1080,
                roiPixels: 120000,
                maskedOut: 2048,
              },
            },
          },
        },
        captionOptions: { debug: true, locale: 'en-US', timeZone: 'UTC' },
      });

      assert.match(caption, /^Jul 29, 2026, 8:15:30 PM/);
      assert.match(caption, /camera=front source=reolink file=shot\.jpg/);
      assert.match(caption, /reason=motion score=0\.234568 changed=42 compared=100/);
      assert.match(caption, /mode=image work=512x288 source=1920x1080/);
      assert.match(caption, /cameraMotion=true rawState=1/);
      assert.match(caption, /burst=2\/4 caption=motion motion score=0\.2/);
    });
  });
});
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

  test('telegram health releases unusual response bodies', async () => {
    let cancelled = 0;
    const n = createTelegramNotifier({
      botToken: 'SECRET_TOKEN',
      chatId: '99',
      fetchImpl: async () => ({
        ok: false,
        status: 502,
        json: async () => { throw new Error('invalid json'); },
        body: { cancel: async () => { cancelled += 1; } },
      }),
    });

    const h = await n.health();
    assert.equal(h.ok, false);
    assert.equal(cancelled, 1);
  });

  test('ntfy health releases the response body', async () => {
    let cancelled = 0;
    const n = createNtfyNotifier({
      url: 'https://ntfy.sh/zeus-test',
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        body: { cancel: async () => { cancelled += 1; } },
      }),
    });

    await n.health();
    assert.equal(cancelled, 1);
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
      const fetchImpl = async (url, init = {}) => {
        call += 1;
        if (String(url).includes('api.telegram.org')) {
          return {
            ok: false,
            status: 500,
            json: async () => ({ ok: false, description: 'down' }),
          };
        }
        assert.equal(init.headers.Message, '29.07.2026, 22:15:30');
        return {
          ok: true,
          status: 200,
          json: async () => ({ id: 'n1' }),
        };
      };
      const notifiers = createNotifiers(config, { fetchImpl });
      assert.equal(notifiers.length, 2);
      const hub = createNotifierHub(notifiers, {
        captionOptions: { locale: 'de-DE', timeZone: 'Europe/Berlin' },
      });
      const outcome = await hub.sendAcceptedFrame(imagePath, 'cap', {
        capturedAt: '2026-07-29T20:15:30.000Z',
      });
      assert.equal(outcome.ok, true);
      assert.equal(outcome.results.length, 2);
      assert.ok(outcome.results.some((r) => r.ok));
      assert.ok(outcome.results.some((r) => !r.ok));
      assert.ok(call >= 2);
    });
  });

  test('no notifiers -> not ok', async () => {
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


  test('loadImageFile compresses JPEG before notifier upload', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'zeus-compress-'));
    try {
      const imagePath = path.join(dir, 'large.jpg');
      await writeFile(imagePath, realJpeg(1600, 900));
      const original = await loadImageFile(imagePath, { enabled: false });
      const compressed = await loadImageFile(imagePath, {
        enabled: true,
        maxWidth: 640,
        jpegQuality: 60,
      });
      assert.equal(compressed.contentType, 'image/jpeg');
      assert.equal(compressed.compressed, true);
      assert.ok(compressed.buffer.length < original.buffer.length);
      assert.equal(compressed.originalBytes, original.buffer.length);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
  test('truncateCaption respects limit', () => {
    const long = 'x'.repeat(2000);
    assert.equal(truncateCaption(long, 10).length, 10);
  });
});

