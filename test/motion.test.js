import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { loadMotionConfig } from '../src/motion/config.js';
import { MotionEventState } from '../src/motion/state.js';
import { decideFrame } from '../src/motion/decide.js';
import { createMotion } from '../src/motion/index.js';
import jpeg from 'jpeg-js';
import { computeFrameMetrics } from '../src/motion/metrics.js';

function solidBuffer(byte, size = 4096) {
  return Buffer.alloc(size, byte);
}

describe('motion config', () => {
  test('loads defaults', () => {
    const cfg = loadMotionConfig({});
    assert.equal(cfg.receivedDir, 'images/received');
    assert.equal(cfg.confirmCount, 1);
    assert.ok(cfg.cooldownMs > 0);
    assert.equal(cfg.imageDecodeEnabled, true);
    assert.equal(cfg.resizeWidth, 512);
    assert.equal(cfg.pixelDiffThreshold, 12);
    assert.equal(cfg.motionScoreThreshold, 0.012);
  });

  test('parses image decode resize crop and ROI polygons', () => {
    const cfg = loadMotionConfig({
      MOTION_IMAGE_DECODE_ENABLED: 'true',
      MOTION_RESIZE_WIDTH: '384',
      MOTION_CROP_TOP_PX: '24',
      MOTION_ROI_POLYGONS_JSON: '[[{"x":0,"y":0},{"x":10,"y":0},{"x":0,"y":10}]]',
    });
    assert.equal(cfg.resizeWidth, 384);
    assert.equal(cfg.cropTopPx, 24);
    assert.equal(cfg.roiPolygons.length, 1);
    assert.equal(cfg.roiPolygons[0].length, 3);
  });
});

describe('MotionEventState', () => {
  test('cooldown blocks second send', () => {
    const s = new MotionEventState({
      confirmCount: 1,
      cooldownMs: 10_000,
      maxSendsPerEvent: 5,
      eventIdleMs: 60_000,
    });
    const t0 = 1_000_000;
    const a = s.evaluate(true, t0);
    assert.equal(a.allowSend, true);
    s.recordSend(t0);
    const b = s.evaluate(true, t0 + 100);
    assert.equal(b.allowSend, false);
    assert.equal(b.reasonGate, 'cooldown');
  });

  test('max_sends blocks after cap', () => {
    const s = new MotionEventState({
      confirmCount: 1,
      cooldownMs: 0,
      maxSendsPerEvent: 2,
      eventIdleMs: 60_000,
    });
    const t0 = 1_000_000;
    s.evaluate(true, t0);
    s.recordSend(t0);
    s.evaluate(true, t0 + 1);
    s.recordSend(t0 + 1);
    const c = s.evaluate(true, t0 + 2);
    assert.equal(c.allowSend, false);
    assert.equal(c.reasonGate, 'max_sends');
  });

  test('confirmCount requires streak', () => {
    const s = new MotionEventState({
      confirmCount: 3,
      cooldownMs: 0,
      maxSendsPerEvent: 5,
      eventIdleMs: 60_000,
    });
    const t0 = 1_000_000;
    assert.equal(s.evaluate(true, t0).allowSend, false);
    assert.equal(s.evaluate(true, t0 + 1).reasonGate, 'confirming');
    assert.equal(s.evaluate(true, t0 + 2).allowSend, true);
  });
});

  test('idle gap resets capped event before next positive signal', () => {
    const s = new MotionEventState({
      confirmCount: 1,
      cooldownMs: 0,
      maxSendsPerEvent: 1,
      eventIdleMs: 5_000,
    });
    const t0 = 1_000_000;
    assert.equal(s.evaluate(true, t0).allowSend, true);
    s.recordSend(t0);
    assert.equal(s.evaluate(true, t0 + 1_000).reasonGate, 'max_sends');

    const afterIdle = s.evaluate(true, t0 + 6_000);
    assert.equal(afterIdle.allowSend, true);
    assert.equal(afterIdle.metrics.sendsThisEvent, 0);
  });


describe('decideFrame', () => {
  const baseCfg = loadMotionConfig({
    MOTION_SCORE_THRESHOLD: '0.02',
    MOTION_PIXEL_DIFF_THRESHOLD: '5',
    MOTION_BRIGHTNESS_MIN: '1',
    MOTION_BRIGHTNESS_MAX: '254',
    MOTION_CONFIRM_COUNT: '1',
    MOTION_COOLDOWN_MS: '0',
    MOTION_MAX_SENDS: '10',
  });

  test('first frame is baseline', () => {
    const state = new MotionEventState({
      confirmCount: 1,
      cooldownMs: 0,
      maxSendsPerEvent: 5,
      eventIdleMs: 60_000,
    });
    const { decision, samples } = decideFrame(solidBuffer(100), baseCfg, null, state);
    assert.equal(decision.send, false);
    assert.equal(decision.reason, 'baseline');
    assert.ok(decision.metrics);
    assert.ok(samples.length > 0);
  });

  test('identical second frame → no_delta', () => {
    const state = new MotionEventState({
      confirmCount: 1,
      cooldownMs: 0,
      maxSendsPerEvent: 5,
      eventIdleMs: 60_000,
    });
    const buf = solidBuffer(100);
    const first = decideFrame(buf, baseCfg, null, state);
    const second = decideFrame(buf, baseCfg, first.samples, state);
    assert.equal(second.decision.send, false);
    assert.equal(second.decision.reason, 'no_delta');
  });

  test('changed frame → motion send', () => {
    const state = new MotionEventState({
      confirmCount: 1,
      cooldownMs: 0,
      maxSendsPerEvent: 5,
      eventIdleMs: 60_000,
    });
    const first = decideFrame(solidBuffer(40), baseCfg, null, state);
    const second = decideFrame(solidBuffer(200), baseCfg, first.samples, state);
    assert.equal(second.decision.send, true);
    assert.equal(second.decision.reason, 'motion');
    assert.equal(typeof second.decision.metrics.score, 'number');
  });

  test('brightness gate', () => {
    const cfg = loadMotionConfig({
      MOTION_BRIGHTNESS_MIN: '50',
      MOTION_BRIGHTNESS_MAX: '200',
      MOTION_SCORE_THRESHOLD: '0.01',
    });
    const state = new MotionEventState({
      confirmCount: 1,
      cooldownMs: 0,
      maxSendsPerEvent: 5,
      eventIdleMs: 60_000,
    });
    const first = decideFrame(solidBuffer(100), cfg, null, state);
    const dark = decideFrame(solidBuffer(5), cfg, first.samples, state);
    assert.equal(dark.decision.send, false);
    assert.equal(dark.decision.reason, 'brightness');
  });
});


describe('image pixel metrics', () => {
  function jpegBuffer(width, height, fill) {
    const data = Buffer.alloc(width * height * 4);
    for (let i = 0; i < width * height; i += 1) {
      data[i * 4] = fill(i, 'r');
      data[i * 4 + 1] = fill(i, 'g');
      data[i * 4 + 2] = fill(i, 'b');
      data[i * 4 + 3] = 255;
    }
    return jpeg.encode({ data, width, height }, 90).data;
  }

  test('decodes JPEG, resizes, applies ROI, and compares pixels', () => {
    const cfg = loadMotionConfig({
      MOTION_RESIZE_WIDTH: '8',
      MOTION_CROP_TOP_PX: '0',
      MOTION_PIXEL_DIFF_THRESHOLD: '20',
      MOTION_SCORE_THRESHOLD: '0.01',
      MOTION_BRIGHTNESS_MIN: '1',
      MOTION_BRIGHTNESS_MAX: '254',
      MOTION_ROI_POLYGONS_JSON: '[[{"x":0,"y":0},{"x":4,"y":0},{"x":4,"y":8},{"x":0,"y":8}]]',
    });
    const first = jpegBuffer(8, 8, () => 80);
    const second = jpegBuffer(8, 8, (i) => (i % 8 < 4 ? 180 : 80));

    const a = computeFrameMetrics(first, cfg, null);
    const b = computeFrameMetrics(second, cfg, a.samples);

    assert.equal(a.mode, 'image');
    assert.equal(a.image.width, 8);
    assert.equal(a.image.roiPixels, 32);
    assert.ok(a.image.maskedOut > 0);
    assert.ok(b.score > 0.8);
    assert.equal(b.changed, b.compared);
  });

  test('default image metrics catch small real pixel movement', () => {
    const cfg = loadMotionConfig({
      MOTION_CROP_TOP_PX: '0',
      MOTION_BRIGHTNESS_MIN: '1',
      MOTION_BRIGHTNESS_MAX: '254',
    });
    const first = jpegBuffer(128, 72, () => 90);
    const second = jpegBuffer(128, 72, (i, channel) => {
      const x = i % 128;
      const y = Math.floor(i / 128);
      const inMovedPatch = x >= 50 && x < 66 && y >= 26 && y < 36;
      if (!inMovedPatch) return 90;
      return channel === 'b' ? 125 : 118;
    });

    const a = computeFrameMetrics(first, cfg, null);
    const b = computeFrameMetrics(second, cfg, a.samples);

    assert.ok(b.score >= cfg.motionScoreThreshold);
    assert.ok(b.changed > 0);
  });
});

describe('createMotion folder routing', () => {
  test('filters baseline and no_delta; sends motion with mock notify', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'zeus-motion-'));
    const received = path.join(root, 'received');
    const filtered = path.join(root, 'filtered');
    const sent = path.join(root, 'sent');
    await writeFile(path.join(root, '.keep'), '');
    const { mkdir } = await import('node:fs/promises');
    await mkdir(received, { recursive: true });

    try {
      const fetchImpl = async () => ({
        ok: true,
        status: 200,
        json: async () => ({ ok: true, result: { message_id: 1 }, id: 'n' }),
        text: async () => '',
        headers: { get: () => 'application/json' },
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
          NTFY_URL: 'https://ntfy.sh/zeus-motion-test',
          HEARTBEAT_MS: '600000',
          HEALTH_FILE: path.join(root, 'health.json'),
        },
      });

      const a = path.join(received, 'a.jpg');
      const b = path.join(received, 'b.jpg');
      const c = path.join(received, 'c.jpg');
      await writeFile(a, solidBuffer(80));
      const r1 = await motion.processPath(a);
      assert.equal(r1.decision.reason, 'baseline');
      assert.equal(r1.decision.send, false);

      await writeFile(b, solidBuffer(80));
      const r2 = await motion.processPath(b);
      assert.equal(r2.decision.reason, 'no_delta');

      await writeFile(c, solidBuffer(220));
      const r3 = await motion.processPath(c);
      assert.equal(r3.decision.send, true);
      assert.equal(r3.decision.reason, 'motion');
      assert.equal(r3.notifyOutcome?.ok, true);

      const filteredNames = await readdir(filtered);
      const sentNames = await readdir(sent);
      assert.ok(filteredNames.some((n) => n.startsWith('a.jpg')));
      assert.ok(filteredNames.some((n) => n.startsWith('b.jpg')));
      assert.ok(sentNames.some((n) => n.startsWith('c.jpg')));
      assert.ok(sentNames.some((n) => n.endsWith('.decision.json')));

      const decision = JSON.parse(
        await readFile(
          path.join(sent, sentNames.find((n) => n.endsWith('.decision.json'))),
          'utf8',
        ),
      );
      assert.equal(decision.send, true);
      assert.equal(decision.reason, 'motion');

      await motion.stop();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test('camera motion sidecar sends immediately without pixel baseline', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'zeus-motion-camera-signal-'));
    const received = path.join(root, 'r');
    const filtered = path.join(root, 'f');
    const sent = path.join(root, 's');
    const { mkdir } = await import('node:fs/promises');
    await mkdir(received, { recursive: true });
    try {
      const motion = createMotion({
        createAppIfNeeded: false,
        env: {
          MOTION_RECEIVED_DIR: received,
          MOTION_FILTERED_DIR: filtered,
          MOTION_SENT_DIR: sent,
          MOTION_NOTIFY: 'false',
          MOTION_COOLDOWN_MS: '0',
        },
      });
      const imagePath = path.join(received, 'camera.jpg');
      await writeFile(imagePath, solidBuffer(80));
      await writeFile(`${imagePath}.json`, JSON.stringify({ cameraMotionSignal: true, cameraMotionRawState: 1 }));

      const r = await motion.processPath(imagePath, { cameraMotionSignal: true, cameraMotionRawState: 1 });

      assert.equal(r.decision.send, true);
      assert.equal(r.decision.reason, 'camera_motion');
      assert.equal(r.decision.metrics.pixelReason, 'baseline');
      await motion.stop();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test('scanOnce reads camera motion sidecar metadata', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'zeus-motion-sidecar-'));
    const received = path.join(root, 'r');
    const filtered = path.join(root, 'f');
    const sent = path.join(root, 's');
    const { mkdir } = await import('node:fs/promises');
    await mkdir(received, { recursive: true });
    try {
      const motion = createMotion({
        createAppIfNeeded: false,
        env: {
          MOTION_RECEIVED_DIR: received,
          MOTION_FILTERED_DIR: filtered,
          MOTION_SENT_DIR: sent,
          MOTION_NOTIFY: 'false',
          MOTION_ONCE: '1',
          MOTION_COOLDOWN_MS: '0',
        },
      });
      const imagePath = path.join(received, 'sidecar.jpg');
      await writeFile(imagePath, solidBuffer(90));
      await writeFile(`${imagePath}.json`, JSON.stringify({ cameraMotionSignal: true, cameraMotionRawState: 1 }));

      await motion.start();
      const sentNames = await readdir(sent);
      const decision = JSON.parse(
        await readFile(path.join(sent, sentNames.find((n) => n.endsWith('.decision.json'))), 'utf8'),
      );
      assert.equal(decision.reason, 'camera_motion');
      assert.equal(decision.metrics.pixelReason, 'baseline');
      await motion.stop();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test('standalone works with notify disabled', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'zeus-motion-nonotify-'));
    const received = path.join(root, 'r');
    const filtered = path.join(root, 'f');
    const sent = path.join(root, 's');
    const { mkdir } = await import('node:fs/promises');
    await mkdir(received, { recursive: true });
    try {
      const motion = createMotion({
        createAppIfNeeded: false,
        env: {
          MOTION_RECEIVED_DIR: received,
          MOTION_FILTERED_DIR: filtered,
          MOTION_SENT_DIR: sent,
          MOTION_NOTIFY: 'false',
          MOTION_SCORE_THRESHOLD: '0.02',
          MOTION_PIXEL_DIFF_THRESHOLD: '5',
          MOTION_BRIGHTNESS_MIN: '1',
          MOTION_BRIGHTNESS_MAX: '254',
          MOTION_COOLDOWN_MS: '0',
        },
      });
      const p1 = path.join(received, '1.jpg');
      const p2 = path.join(received, '2.jpg');
      await writeFile(p1, solidBuffer(30));
      await motion.processPath(p1);
      await writeFile(p2, solidBuffer(200));
      const r = await motion.processPath(p2);
      assert.equal(r.decision.send, true);
      assert.equal(r.notifyOutcome, null);
      await motion.stop();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

