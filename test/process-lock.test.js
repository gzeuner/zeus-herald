import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, access } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { acquireProcessLock } from '../src/processLock.js';

describe('process lock', () => {
  test('prevents duplicate lock acquisition and releases file', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'zeus-lock-'));
    try {
      const lock = await acquireProcessLock('motion', dir);
      await assert.rejects(() => acquireProcessLock('motion', dir), /process_already_running:motion/);
      await lock.release();
      await assert.rejects(() => access(lock.lockFile), /ENOENT/);
      const lock2 = await acquireProcessLock('motion', dir);
      await lock2.release();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
