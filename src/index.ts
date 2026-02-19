import { createApp } from './web/app.js';
import { logger } from './util/logger.js';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';

const PORT = parseInt(process.env['PORT'] ?? '3000', 10);
const HOST = process.env['HOST'] ?? '0.0.0.0';
const DATA_DIR = process.env['DATA_DIR'] ?? './data';
const RECORDINGS_DIR = process.env['RECORDINGS_DIR'] ?? join(DATA_DIR, 'recordings');
const DB_PATH = process.env['DB_PATH'] ?? join(DATA_DIR, 'config.db');

async function main() {
  logger.info('f12mqtt starting...');

  // Ensure data directories exist
  mkdirSync(DATA_DIR, { recursive: true });
  mkdirSync(RECORDINGS_DIR, { recursive: true });

  const app = await createApp({
    port: PORT,
    host: HOST,
    recordingsDir: RECORDINGS_DIR,
    dbPath: DB_PATH,
  });

  logger.info({ port: PORT, host: HOST, dataDir: DATA_DIR }, 'f12mqtt ready');

  const shutdown = async () => {
    logger.info('Shutting down...');
    await app.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  logger.fatal(err, 'Failed to start');
  process.exit(1);
});
