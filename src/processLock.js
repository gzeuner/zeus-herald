import { mkdir, open, readFile, unlink } from 'node:fs/promises';
import path from 'node:path';

/**
 * @param {number} pid
 */
function isProcessAlive(pid) {
  if (!Number.isFinite(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * @param {string} lockFile
 */
async function readLockPid(lockFile) {
  try {
    const body = JSON.parse(await readFile(lockFile, 'utf8'));
    return Number(body.pid) || 0;
  } catch {
    return 0;
  }
}

/**
 * @param {string} name
 * @param {string} [dir]
 * @returns {Promise<{ lockFile: string, release: () => Promise<void> }>}
 */
export async function acquireProcessLock(name, dir = '.lock') {
  const safeName = String(name).replace(/[^\w.-]+/g, '_') || 'process';
  const lockDir = path.resolve(dir);
  const lockFile = path.join(lockDir, `${safeName}.lock`);
  await mkdir(lockDir, { recursive: true });

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const handle = await open(lockFile, 'wx');
      await handle.writeFile(`${JSON.stringify({ pid: process.pid, name: safeName, at: new Date().toISOString() })}\n`);
      let released = false;
      return {
        lockFile,
        release: async () => {
          if (released) return;
          released = true;
          await handle.close();
          try {
            await unlink(lockFile);
          } catch {
            // Best-effort cleanup. A missing lock is already released.
          }
        },
      };
    } catch (err) {
      if (/** @type {NodeJS.ErrnoException} */ (err).code !== 'EEXIST') throw err;
      const pid = await readLockPid(lockFile);
      if (isProcessAlive(pid)) {
        throw new Error(`process_already_running:${safeName}:pid=${pid}`);
      }
      try {
        await unlink(lockFile);
      } catch {
        // Another process may have removed/recreated it; retry once.
      }
    }
  }

  throw new Error(`process_lock_unavailable:${safeName}`);
}
