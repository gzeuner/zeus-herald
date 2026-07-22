import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';

/**
 * @typedef {object} IngestMetadata
 * @property {string} capturedAt
 * @property {string} camera
 * @property {string} source
 * @property {string} path
 * @property {string} [requestId]
 */

/**
 * @param {object} options
 * @param {string} options.targetDir
 * @param {string} options.cameraId
 * @param {string} options.source
 * @param {Buffer} options.buffer
 * @param {string} [options.contentType]
 * @param {boolean} [options.writeMetadata]
 * @param {string} [options.requestId]
 * @param {Date} [options.now]
 * @returns {Promise<{ imagePath: string, metadataPath: string | null, metadata: IngestMetadata }>}
 */
export async function writeReceivedFrame(options) {
  const {
    targetDir,
    cameraId,
    source,
    buffer,
    contentType = 'image/jpeg',
    writeMetadata = true,
    requestId,
    now = new Date(),
  } = options;

  const dir = path.resolve(targetDir);
  await mkdir(dir, { recursive: true });

  const stamp = now.toISOString().replace(/[:.]/g, '-');
  const safeCam = String(cameraId).replace(/[^\w.-]+/g, '_') || 'camera';
  const ext =
    contentType.includes('png') ? '.png' : contentType.includes('webp') ? '.webp' : '.jpg';
  const basename = `${stamp}_${safeCam}_${randomBytes(3).toString('hex')}${ext}`;
  const imagePath = path.join(dir, basename);

  await writeFile(imagePath, buffer);

  /** @type {IngestMetadata} */
  const metadata = {
    capturedAt: now.toISOString(),
    camera: cameraId,
    source,
    path: imagePath,
    requestId,
  };

  let metadataPath = null;
  if (writeMetadata) {
    metadataPath = `${imagePath}.json`;
    await writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');
  }

  return { imagePath, metadataPath, metadata };
}
