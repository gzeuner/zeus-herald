/**
 * CLI: node --env-file=.env src/ingest-cli.js
 * Single shot: INGEST_ONCE=1
 */

import { createIngest } from './ingest/index.js';
import { installGracefulShutdown } from './shutdown.js';
import { logger } from './logger.js';
import { acquireProcessLock } from './processLock.js';
import { startCleanup } from './cleanup.js';

const lock = await acquireProcessLock('ingest');
const ingest = createIngest({ installSignals: false });
const cleanup = startCleanup();

installGracefulShutdown({
  timeoutMs: Number.parseInt(process.env.SHUTDOWN_TIMEOUT_MS || '15000', 10) || 15000,
  onShutdown: async () => {
    await ingest.stop();
    cleanup.stop();
    await lock.release();
  },
});

try {
  await ingest.start();
  if (ingest.config.once) {
    await ingest.stop();
    cleanup.stop();
    await lock.release();
    process.exit(0);
  }
} catch (err) {
  logger.error('ingest_cli_fatal', {
    error: err instanceof Error ? err.message : String(err),
  });
  cleanup.stop();
  await lock.release();
  process.exit(1);
}
