/**
 * CI-safe E2E: fixture frames → motion → hub (mock fetch).
 * Simulates ingest output without live camera (package 07).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readdir, rm, mkdir } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { writeReceivedFrame } from '../src/ingest/writer.js';
import { createMotion } from '../src/motion/index.js';

function solidBuffer(byte, size = 4096) {
  return Buffer.alloc(size, byte);
}

test('e2e: received frames → motion filter/send → mock notify', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'zeus-e2e-'));
  const received = path.join(root, 'received');
  const filtered = path.join(root, 'filtered');
  const sent = path.join(root, 'sent');
  await mkdir(received, { recursive: true });

  try {
    const fetchImpl = async () => ({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, result: { message_id: 77 }, id: 'e2e' }),
      text: async () => '',
      headers: { get: () => 'application/json' },
    });

    // Simulate package 05 writer (ingest)
    const frameA = await writeReceivedFrame({
      targetDir: received,
      cameraId: 'e2e',
      source: 'fixture',
      buffer: solidBuffer(60),
      writeMetadata: true,
    });
    const frameB = await writeReceivedFrame({
      targetDir: received,
      cameraId: 'e2e',
      source: 'fixture',
      buffer: solidBuffer(60),
      writeMetadata: true,
    });
    const frameC = await writeReceivedFrame({
      targetDir: received,
      cameraId: 'e2e',
      source: 'fixture',
      buffer: solidBuffer(210),
      writeMetadata: true,
    });

    const motion = createMotion({
      fetchImpl,
      env: {
        MOTION_RECEIVED_DIR: received,
        MOTION_FILTERED_DIR: filtered,
        MOTION_SENT_DIR: sent,
        MOTION_SCORE_THRESHOLD: '0.02',
        MOTION_PIXEL_DIFF_THRESHOLD: '5',
        MOTION_BRIGHTNESS_MIN: '1',
        MOTION_BRIGHTNESS_MAX: '254',
        MOTION_CONFIRM_COUNT: '1',
        MOTION_COOLDOWN_MS: '0',
        MOTION_MAX_SENDS: '5',
        MOTION_NOTIFY: 'true',
        NTFY_URL: 'https://ntfy.sh/zeus-e2e',
        HEARTBEAT_MS: '600000',
        HEALTH_FILE: path.join(root, 'health.json'),
      },
    });

    const r1 = await motion.processPath(frameA.imagePath);
    const r2 = await motion.processPath(frameB.imagePath);
    const r3 = await motion.processPath(frameC.imagePath);

    assert.equal(r1.decision.send, false);
    assert.equal(r1.decision.reason, 'baseline');
    assert.equal(r2.decision.send, false);
    assert.equal(r2.decision.reason, 'no_delta');
    assert.equal(r3.decision.send, true);
    assert.equal(r3.decision.reason, 'motion');
    assert.equal(r3.notifyOutcome?.ok, true);

    const filteredNames = await readdir(filtered);
    const sentNames = await readdir(sent);
    assert.ok(filteredNames.length >= 2);
    assert.ok(sentNames.some((n) => n.endsWith('.jpg') || n.endsWith('.jpeg')));
    assert.ok(sentNames.some((n) => n.endsWith('.decision.json')));

    // received should be empty of those three images
    const left = (await readdir(received)).filter((n) => !n.endsWith('.json'));
    assert.equal(left.length, 0);

    await motion.stop();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
