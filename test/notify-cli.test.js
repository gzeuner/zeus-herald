import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { findLatestImage, notifyImage, parseNotifyArgs } from '../src/notify-cli.js';

const FAKE_JPEG = Buffer.concat([
  Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
  Buffer.alloc(200, 1),
]);

describe('notify CLI helpers', () => {
  test('parseNotifyArgs accepts explicit image and caption', () => {
    const parsed = parseNotifyArgs(['--image', 'a.jpg', '--caption', 'hello'], {});
    assert.equal(parsed.imagePath, 'a.jpg');
    assert.equal(parsed.caption, 'hello');
  });

  test('findLatestImage returns newest image file', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'zeus-notify-latest-'));
    try {
      const older = path.join(dir, 'older.jpg');
      const newer = path.join(dir, 'newer.jpg');
      await writeFile(older, FAKE_JPEG);
      await new Promise((resolve) => setTimeout(resolve, 5));
      await writeFile(newer, FAKE_JPEG);
      await writeFile(path.join(dir, 'newer.jpg.json'), '{}');

      assert.equal(await findLatestImage(dir), newer);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test('notifyImage sends latest image via ntfy mock', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'zeus-notify-send-'));
    try {
      const imagePath = path.join(dir, 'shot.jpg');
      await writeFile(imagePath, FAKE_JPEG);
      let uploadSeen = false;
      const fetchImpl = async (_url, init = {}) => {
        if (init.method === 'PUT') {
          uploadSeen = true;
          assert.ok(Buffer.isBuffer(init.body) || init.body instanceof Uint8Array);
          return {
            ok: true,
            status: 200,
            json: async () => ({ id: 'mobile-1' }),
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ ok: true }),
          text: async () => '',
          headers: { get: () => 'application/json' },
        };
      };

      const result = await notifyImage({
        latestDir: dir,
        caption: 'test mobile transfer',
        fetchImpl,
        env: {
          NTFY_URL: 'https://ntfy.sh/zeus-mobile-test',
          HEARTBEAT_MS: '600000',
          HEALTH_FILE: path.join(dir, 'health.json'),
        },
      });
      assert.equal(result.imagePath, imagePath);
      assert.equal(result.outcome.ok, true);
      assert.equal(uploadSeen, true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
