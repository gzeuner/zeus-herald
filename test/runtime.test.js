import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { BoundedQueue } from '../src/queue.js';
import { RuntimeSupervisor } from '../src/runtimeSupervisor.js';
import { createApp } from '../src/app.js';
import { installGracefulShutdown } from '../src/shutdown.js';
import { EventEmitter } from 'node:events';

describe('BoundedQueue', () => {
  test('processes tasks serially', async () => {
    const q = new BoundedQueue({ maxSize: 10 });
    const order = [];
    await Promise.all([
      q.enqueue(async () => {
        order.push(1);
        return 1;
      }),
      q.enqueue(async () => {
        order.push(2);
        return 2;
      }),
    ]);
    await q.whenIdle();
    assert.deepEqual(order, [1, 2]);
    assert.equal(q.metrics().processed, 2);
  });

  test('drop_oldest under pressure', async () => {
    const q = new BoundedQueue({ maxSize: 2, dropPolicy: 'drop_oldest' });
    let started = 0;
    /** @type {() => void} */
    let release;
    const gate = new Promise((r) => {
      release = r;
    });

    const p0 = q.enqueue(async () => {
      started += 1;
      await gate;
      return 'first';
    });

    // Fill queue while first task runs
    const p1 = q.enqueue(async () => 'a');
    const p2 = q.enqueue(async () => 'b');
    // This should drop oldest waiting (p1)
    const p3 = q.enqueue(async () => 'c');

    await assert.rejects(p1, /queue_dropped_oldest/);
    release();
    await p0;
    await p2;
    await p3;
    await q.whenIdle();
    assert.ok(q.metrics().dropped >= 1);
    assert.ok(q.metrics().depth <= 2);
  });

  test('reject policy when full', async () => {
    const q = new BoundedQueue({ maxSize: 1, dropPolicy: 'reject' });
    let release;
    const gate = new Promise((r) => {
      release = r;
    });
    const running = q.enqueue(async () => {
      await gate;
    });
    // one slot occupied by waiting item while running holds drain
    const waiting = q.enqueue(async () => 'x');
    await assert.rejects(q.enqueue(async () => 'y'), /queue_full/);
    release();
    await running;
    await waiting;
  });

  test('stopAccepting rejects new work', async () => {
    const q = new BoundedQueue({ maxSize: 5 });
    q.stopAccepting();
    await assert.rejects(q.enqueue(async () => 1), /queue_not_accepting/);
  });
});

describe('RuntimeSupervisor', () => {
  test('writes health file atomically', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'zeus-health-'));
    const healthFile = path.join(dir, 'health.json');
    try {
      const s = new RuntimeSupervisor({ healthFile });
      s.markRunning();
      s.sampleMemory({ rss: 12345, heapUsed: 1000, heapTotal: 2000, external: 0, arrayBuffers: 0 });
      s.recordQueueMetrics({ depth: 0, enqueued: 1, dropped: 0, processed: 1, errors: 0, maxDepth: 1, running: false, accepting: true });
      await s.writeHealth();
      const raw = await readFile(healthFile, 'utf8');
      const json = JSON.parse(raw);
      assert.equal(json.status, 'running');
      assert.equal(json.memory.rssBytes, 12345);
      assert.equal(json.queue.enqueued, 1);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe('createApp integration', () => {
  test('enqueueNotify uses hub and records send', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'zeus-app-'));
    const imagePath = path.join(dir, 'a.jpg');
    await writeFile(imagePath, Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
    const healthFile = path.join(dir, 'health.json');
    try {
      const fetchImpl = async () => ({
        ok: true,
        status: 200,
        json: async () => ({ ok: true, result: { message_id: 1 }, id: 'n' }),
        text: async () => '',
      });
      const app = createApp({
        installSignals: false,
        fetchImpl,
        env: {
          TELEGRAM_BOT_TOKEN: 't',
          TELEGRAM_CHAT_ID: '1',
          NTFY_URL: 'https://ntfy.sh/t',
          HEALTH_FILE: healthFile,
          HEARTBEAT_MS: '600000',
        },
      });
      await app.start();
      const outcome = await app.enqueueNotify(imagePath, 'cap');
      assert.equal(outcome.ok, true);
      assert.ok(app.supervisor.sendOkCount >= 1);
      await app.stop();
      const health = JSON.parse(await readFile(healthFile, 'utf8'));
      assert.equal(health.status, 'stopped');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test('synthetic soak: hundreds of enqueue without unbounded depth', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'zeus-soak-'));
    const imagePath = path.join(dir, 'a.jpg');
    await writeFile(imagePath, Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
    try {
      const fetchImpl = async () => ({
        ok: true,
        status: 200,
        json: async () => ({ ok: true, result: { message_id: 1 }, id: 'n' }),
        text: async () => '',
      });
      const app = createApp({
        installSignals: false,
        fetchImpl,
        env: {
          NTFY_URL: 'https://ntfy.sh/t',
          QUEUE_MAX_SIZE: '50',
          QUEUE_DROP_POLICY: 'drop_oldest',
          HEARTBEAT_MS: '600000',
          HEALTH_FILE: path.join(dir, 'h.json'),
        },
      });
      // Do not start heartbeat loop; just use queue
      const jobs = [];
      for (let i = 0; i < 300; i += 1) {
        jobs.push(
          app.enqueueNotify(imagePath, `n-${i}`).catch((err) => err.message),
        );
      }
      await Promise.all(jobs);
      await app.queue.whenIdle();
      const m = app.queue.metrics();
      assert.ok(m.maxDepth <= 50, `maxDepth ${m.maxDepth}`);
      assert.equal(m.depth, 0);
      assert.ok(m.processed + m.dropped + m.errors >= 300 || m.enqueued >= 50);
      // processed should be significant
      assert.ok(m.processed > 0);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe('graceful shutdown', () => {
  test('invokes onShutdown once on SIGTERM', async () => {
    const proc = new EventEmitter();
    // @ts-expect-error minimal process mock
    proc.exit = () => {};
    let calls = 0;
    installGracefulShutdown({
      // @ts-expect-error mock process
      proc,
      timeoutMs: 5000,
      onShutdown: async () => {
        calls += 1;
      },
    });
    proc.emit('SIGTERM');
    await new Promise((r) => setTimeout(r, 50));
    assert.equal(calls, 1);
  });
});
