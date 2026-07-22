import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, readdir } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { loadIngestConfig } from '../src/ingest/config.js';
import { buildReolinkSnapshotUrl, fetchReolinkSnapshot } from '../src/ingest/reolink.js';
import { buildUpcamSnapshotUrl, fetchUpcamSnapshot } from '../src/ingest/upcam.js';
import { writeReceivedFrame } from '../src/ingest/writer.js';
import { createIngest } from '../src/ingest/index.js';

/** Minimal JPEG-ish body large enough to pass size checks */
const FAKE_JPEG = Buffer.concat([
  Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
  Buffer.alloc(200, 1),
]);

describe('ingest config', () => {
  test('defaults to reolink files_only', () => {
    const cfg = loadIngestConfig({});
    assert.equal(cfg.cameraType, 'reolink');
    assert.equal(cfg.mode, 'files_only');
    assert.equal(cfg.writeMetadata, true);
  });

  test('rejects unknown camera type', () => {
    assert.throws(() => loadIngestConfig({ CAMERA_TYPE: 'drone' }), /unknown_camera_type/);
  });

  test('parses direct_notify mode', () => {
    const cfg = loadIngestConfig({ INGEST_MODE: 'direct_notify' });
    assert.equal(cfg.mode, 'direct_notify');
  });
});

describe('reolink / upcam clients', () => {
  test('buildReolinkSnapshotUrl from host', () => {
    const url = buildReolinkSnapshotUrl({
      host: '192.168.1.50',
      user: 'admin',
      password: 'secret',
      channel: '0',
      snapshotUrl: '',
    });
    assert.match(url, /^http:\/\/192\.168\.1\.50\/cgi-bin\/api\.cgi/);
    assert.match(url, /cmd=Snap/);
    assert.match(url, /user=admin/);
    assert.ok(!url.includes('secret') || url.includes('password=secret'));
  });

  test('fetchReolinkSnapshot success with mock fetch', async () => {
    const fetchImpl = async (url) => {
      assert.equal(String(url), 'http://cam/snap');
      return {
        ok: true,
        status: 200,
        headers: { get: () => 'image/jpeg' },
        arrayBuffer: async () => FAKE_JPEG.buffer.slice(
          FAKE_JPEG.byteOffset,
          FAKE_JPEG.byteOffset + FAKE_JPEG.byteLength,
        ),
      };
    };
    const { buffer, contentType } = await fetchReolinkSnapshot({
      config: {
        snapshotUrl: 'http://cam/snap',
        host: '',
        user: '',
        password: '',
        channel: '0',
      },
      fetchImpl,
    });
    assert.equal(contentType, 'image/jpeg');
    assert.ok(buffer.length >= 100);
  });

  test('fetchReolinkSnapshot maps HTTP error', async () => {
    const fetchImpl = async () => ({
      ok: false,
      status: 401,
      headers: { get: () => null },
      arrayBuffer: async () => new ArrayBuffer(0),
    });
    await assert.rejects(
      () =>
        fetchReolinkSnapshot({
          config: {
            snapshotUrl: 'http://cam/snap',
            host: '',
            user: '',
            password: '',
            channel: '0',
          },
          fetchImpl,
        }),
      /reolink_http_401|401/,
    );
  });

  test('buildUpcamSnapshotUrl prefers snapshot URL', () => {
    const url = buildUpcamSnapshotUrl({
      snapshotUrl: 'http://u/cam.jpg',
      host: 'ignored',
      user: '',
      password: '',
    });
    assert.equal(url, 'http://u/cam.jpg');
  });

  test('fetchUpcamSnapshot success', async () => {
    const fetchImpl = async () => ({
      ok: true,
      status: 200,
      headers: { get: () => 'image/jpeg' },
      arrayBuffer: async () =>
        FAKE_JPEG.buffer.slice(FAKE_JPEG.byteOffset, FAKE_JPEG.byteOffset + FAKE_JPEG.byteLength),
    });
    const { buffer } = await fetchUpcamSnapshot({
      config: {
        snapshotUrl: 'http://u/snap',
        host: '',
        user: 'a',
        password: 'b',
      },
      fetchImpl,
    });
    assert.ok(buffer.length >= 100);
  });
});

describe('writer', () => {
  test('writes jpeg + metadata json under target dir', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'zeus-ingest-'));
    try {
      const result = await writeReceivedFrame({
        targetDir: dir,
        cameraId: 'front',
        source: 'reolink',
        buffer: FAKE_JPEG,
        writeMetadata: true,
        requestId: 'req-1',
      });
      const img = await readFile(result.imagePath);
      assert.ok(img.length >= 100);
      assert.ok(result.metadataPath);
      const meta = JSON.parse(await readFile(result.metadataPath, 'utf8'));
      assert.equal(meta.camera, 'front');
      assert.equal(meta.source, 'reolink');
      assert.equal(meta.requestId, 'req-1');
      assert.ok(meta.capturedAt);
      assert.equal(meta.path, result.imagePath);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe('createIngest integration', () => {
  test('files-only captureOnce writes frame without notifier secrets', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'zeus-ingest-app-'));
    try {
      const fetchImpl = async () => ({
        ok: true,
        status: 200,
        headers: { get: () => 'image/jpeg' },
        arrayBuffer: async () =>
          FAKE_JPEG.buffer.slice(FAKE_JPEG.byteOffset, FAKE_JPEG.byteOffset + FAKE_JPEG.byteLength),
      });
      const ingest = createIngest({
        fetchImpl,
        env: {
          CAMERA_TYPE: 'reolink',
          CAMERA_ID: 'gate',
          REOLINK_SNAPSHOT_URL: 'http://fixture/snap',
          INGEST_TARGET_DIR: dir,
          INGEST_MODE: 'files_only',
          INGEST_WRITE_METADATA: 'true',
          INGEST_ONCE: '1',
        },
      });
      const result = await ingest.captureOnce('t1');
      assert.equal(result.notify, null);
      const files = await readdir(dir);
      assert.ok(files.some((f) => f.endsWith('.jpg') || f.endsWith('.jpeg')));
      assert.ok(files.some((f) => f.endsWith('.json')));
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test('direct_notify enqueues via app with mock fetch', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'zeus-ingest-notify-'));
    try {
      const fetchImpl = async (url) => {
        if (String(url).includes('fixture/snap') || String(url).includes('/snap')) {
          return {
            ok: true,
            status: 200,
            headers: { get: () => 'image/jpeg' },
            arrayBuffer: async () =>
              FAKE_JPEG.buffer.slice(
                FAKE_JPEG.byteOffset,
                FAKE_JPEG.byteOffset + FAKE_JPEG.byteLength,
              ),
          };
        }
        // notifier endpoints
        return {
          ok: true,
          status: 200,
          json: async () => ({ ok: true, result: { message_id: 9 }, id: 'n' }),
          text: async () => '',
          headers: { get: () => 'application/json' },
        };
      };
      const ingest = createIngest({
        fetchImpl,
        env: {
          CAMERA_TYPE: 'reolink',
          REOLINK_SNAPSHOT_URL: 'http://fixture/snap',
          INGEST_TARGET_DIR: dir,
          INGEST_MODE: 'direct_notify',
          INGEST_WRITE_METADATA: '0',
          NTFY_URL: 'https://ntfy.sh/test-topic',
          HEARTBEAT_MS: '600000',
          HEALTH_FILE: path.join(dir, 'health.json'),
        },
      });
      const result = await ingest.captureOnce();
      assert.ok(result.notify);
      assert.equal(result.notify.ok, true);
      await ingest.stop();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
