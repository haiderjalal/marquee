import { access } from 'node:fs/promises';
import path from 'node:path';

import { applyMigrations, createDatabaseClient, seedDemoData } from '@marquee/database';
import EmbeddedPostgres from 'embedded-postgres';

/**
 * Local development database. Starts an embedded PostgreSQL 17 cluster that persists in
 * .pgdata/ (git-ignored), applies migrations, loads the DEMONSTRATION seed and keeps running
 * until interrupted. Never point this at a shared or production database.
 */

/** Local-only superuser password. It protects nothing beyond this loopback development cluster. */
const DEV_PASSWORD = 'marquee-dev-only';
const DEV_PORT = 54_329;
const DEV_DATABASE = 'marquee_dev';
const DATA_DIRECTORY = path.resolve(__dirname, '..', '.pgdata');

/**
 * Starts the cluster if needed, migrates, seeds and waits for a termination signal.
 */
async function main(): Promise<void> {
  const initialised = await fileExists(path.join(DATA_DIRECTORY, 'PG_VERSION'));
  const cluster = new EmbeddedPostgres({
    databaseDir: DATA_DIRECTORY,
    user: 'postgres',
    password: DEV_PASSWORD,
    port: DEV_PORT,
    persistent: true,
    onLog: () => undefined,
    onError: () => undefined,
  });
  if (!initialised) {
    await cluster.initialise();
  }
  await cluster.start();
  try {
    await cluster.createDatabase(DEV_DATABASE);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (!message.includes('already exists')) {
      throw error;
    }
  }

  const url = `postgres://postgres:${DEV_PASSWORD}@127.0.0.1:${DEV_PORT}/${DEV_DATABASE}`;
  const client = createDatabaseClient(url, 2);
  try {
    const report = await applyMigrations(client.pool);
    await seedDemoData(client.db);
    process.stdout.write(
      `Dev database ready at ${url}\nMigrations applied now: ${report.applied.length}. Demo seed loaded (idempotent).\nSet DATABASE_URL to the line above in .env. Press Ctrl+C to stop.\n`,
    );
  } finally {
    await client.close();
  }

  const stop = (): void => {
    cluster
      .stop()
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'unknown error';
        process.stderr.write(`Could not stop the dev database cleanly: ${message}\n`);
      })
      .finally(() => process.exit(0));
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
}

/**
 * Checks whether a path exists.
 * @param filePath Path to test.
 * @returns True when the file or directory exists.
 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'unknown failure';
  process.stderr.write(`Dev database failed: ${message}\n`);
  process.exitCode = 1;
});
