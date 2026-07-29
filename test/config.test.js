import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../src/config.js';

test('telegram enabled only with token and chat id', () => {
  const cfg = loadConfig({
    TELEGRAM_BOT_TOKEN: 'tok',
    TELEGRAM_CHAT_ID: '123',
  });
  assert.equal(cfg.telegram.enabled, true);
  assert.equal(cfg.ntfy.enabled, false);
});

test('telegram can be explicitly disabled', () => {
  const cfg = loadConfig({
    TELEGRAM_BOT_TOKEN: 'tok',
    TELEGRAM_CHAT_ID: '123',
    TELEGRAM_ENABLED: 'false',
  });
  assert.equal(cfg.telegram.enabled, false);
});

test('ntfy enabled with URL', () => {
  const cfg = loadConfig({ NTFY_URL: 'https://ntfy.sh/topic' });
  assert.equal(cfg.ntfy.enabled, true);
});

test('timeout falls back to 30000 on invalid', () => {
  const cfg = loadConfig({ NOTIFIER_TIMEOUT_MS: 'nope' });
  assert.equal(cfg.notifier.timeoutMs, 30000);
});

test('notifier image compression defaults are enabled', () => {
  const cfg = loadConfig({});
  assert.equal(cfg.notifier.imageCompression.enabled, true);
  assert.equal(cfg.notifier.imageCompression.maxWidth, 1920);
  assert.equal(cfg.notifier.imageCompression.jpegQuality, 88);
});

test('notifier image compression can be configured', () => {
  const cfg = loadConfig({
    NOTIFIER_IMAGE_COMPRESSION_ENABLED: 'false',
    NOTIFIER_IMAGE_MAX_WIDTH: '640',
    NOTIFIER_IMAGE_JPEG_QUALITY: '60',
  });
  assert.equal(cfg.notifier.imageCompression.enabled, false);
  assert.equal(cfg.notifier.imageCompression.maxWidth, 640);
  assert.equal(cfg.notifier.imageCompression.jpegQuality, 60);
});
