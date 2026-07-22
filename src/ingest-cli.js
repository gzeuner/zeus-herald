/**
 * CLI: node --env-file=.env src/ingest-cli.js
 * Single shot: INGEST_ONCE=1
 */

import { createIngest } from './ingest/index.js';
import { installGracefulShutdown } from './shutdown.js';
import { logger } from './logger.js';

const ingest = createIngest({ installSignals: false });

installGracefulShutdown({
  timeoutMs: Number.parseInt(process.env.SHUTDOWN_TIMEOUT_MS || '15000', 10) || 15000,
  onShutdown: async () => {
    await ingest.stop();
  },
});

try {
  await ingest.start();
  if (ingest.config.once) {
    await ingest.stop();
    process.exit(0);
  }
} catch (err) {
  logger.error('ingest_cli_fatal', {
    error: err instanceof Error ? err.message : String(err),
  });
  process.exit(1);
}
