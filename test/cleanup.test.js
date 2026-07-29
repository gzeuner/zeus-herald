import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, stat, utimes, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { cleanupOnce, loadCleanupConfig } from '../src/cleanup.js';

async function touchOld(filePath, ageMs, nowMs) {
  const time = new Date(nowMs - ageMs);
  await utimes(filePath, time, time);
}

test('loadCleanupConfig defaults image cleanup to 36h and logs to 48h', () => {
  const cfg = loadCleanupConfig({});
  assert.equal(cfg.enabled, true);
  assert.equal(cfg.images.enabled, true);
  assert.equal(cfg.images.maxAgeMs, 36 * 60 * 60 * 1000);
  assert.equal(cfg.logs.enabled, true);
  assert.equal(cfg.logs.maxAgeMs, 48 * 60 * 60 * 1000);
  assert.deepEqual(cfg.images.dirs, ['images/received', 'images/filtered', 'images/sent']);
  assert.deepEqual(cfg.logs.dirs, ['logs']);
});

test('cleanupOnce removes old images and logs but keeps recent files', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'zeus-cleanup-'));
  const received = path.join(dir, 'received');
  const sent = path.join(dir, 'sent');
  const logs = path.join(dir, 'logs');
  const nowMs = Date.UTC(2026, 6, 29, 12, 0, 0);

  try {
    await mkdir(received, { recursive: true });
    await mkdir(sent, { recursive: true });
    await mkdir(logs, { recursive: true });

    await writeFile(path.join(received, 'old.jpg'), 'old');
    await writeFile(path.join(received, 'old.json'), '{}');
    await writeFile(path.join(sent, 'recent.jpg'), 'recent');
    await writeFile(path.join(logs, 'old.log'), 'oldlog');
    await writeFile(path.join(logs, 'old.ndjson'), '{}');
    await writeFile(path.join(logs, 'recent.log'), 'recentlog');
    await writeFile(path.join(logs, 'keep.bin'), 'bin');

    await touchOld(path.join(received, 'old.jpg'), 37 * 60 * 60 * 1000, nowMs);
    await touchOld(path.join(received, 'old.json'), 37 * 60 * 60 * 1000, nowMs);
    await touchOld(path.join(sent, 'recent.jpg'), 2 * 60 * 60 * 1000, nowMs);
    await touchOld(path.join(logs, 'old.log'), 49 * 60 * 60 * 1000, nowMs);
    await touchOld(path.join(logs, 'old.ndjson'), 49 * 60 * 60 * 1000, nowMs);
    await touchOld(path.join(logs, 'recent.log'), 2 * 60 * 60 * 1000, nowMs);
    await touchOld(path.join(logs, 'keep.bin'), 99 * 60 * 60 * 1000, nowMs);

    const result = await cleanupOnce({
      nowMs,
      config: loadCleanupConfig({
        CLEANUP_IMAGE_DIRS: `${received},${sent}`,
        CLEANUP_LOG_DIRS: logs,
      }),
    });

    assert.equal(result.images.deleted, 2);
    assert.equal(result.logs.deleted, 2);

    await assert.rejects(stat(path.join(received, 'old.jpg')));
    await assert.rejects(stat(path.join(received, 'old.json')));
    assert.equal(await readFile(path.join(sent, 'recent.jpg'), 'utf8'), 'recent');
    await assert.rejects(stat(path.join(logs, 'old.log')));
    await assert.rejects(stat(path.join(logs, 'old.ndjson')));
    assert.equal(await readFile(path.join(logs, 'recent.log'), 'utf8'), 'recentlog');
    assert.equal(await readFile(path.join(logs, 'keep.bin'), 'utf8'), 'bin');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('cleanupOnce can be disabled', async () => {
  const result = await cleanupOnce({ config: loadCleanupConfig({ CLEANUP_ENABLED: 'false' }) });
  assert.equal(result.skipped, true);
});
