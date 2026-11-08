import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import os from 'node:os';
import path from 'node:path';

import EmbeddedPostgres from 'embedded-postgres';
import pg from 'pg';

import { createDatabaseClient, type DatabaseClient } from './client';
import { applyMigrations } from './migrate';

/** A migrated, disposable PostgreSQL database for integration tests. */
export interface TestDatabase {
  readonly url: string;
  /** Opens a pooled client bound to the test database. Caller must close it. */
  open(maxConnections?: number): DatabaseClient;
  /** Drops the cluster and its data directory. */
  dispose(): Promise<void>;
}

/** Superuser credentials used only by the throwaway embedded cluster. */
const TEST_USER = 'postgres';
const TEST_PASSWORD = 'marquee-test-only';
const TEST_DATABASE = 'marquee_test';

/**
 * Starts an embedded PostgreSQL 17 cluster on a free local port, creates a database,
 * applies every migration and returns a handle. Each call uses a new data directory,
 * so suites cannot leak state into each other.
 *
 * When TEST_DATABASE_URL is set, that existing server is used instead. It must be a
 * disposable database because it will be migrated and written to.
 *
 * @returns A migrated test database.
 */
export async function startTestDatabase(): Promise<TestDatabase> {
  const external = process.env['TEST_DATABASE_URL'];
  if (external) {
    await migrateUrl(external);
    return {
      url: external,
      open: (maxConnections) => createDatabaseClient(external, maxConnections),
      dispose: async () => {},
    };
  }

  const dataDirectory = await mkdtemp(path.join(os.tmpdir(), 'marquee-pg-'));
  const port = await findFreePort();
  const cluster = new EmbeddedPostgres({
    databaseDir: dataDirectory,
    user: TEST_USER,
    password: TEST_PASSWORD,
    port,
    persistent: false,
    onLog: () => undefined,
    onError: () => undefined,
  });
  await cluster.initialise();
  await cluster.start();
  await cluster.createDatabase(TEST_DATABASE);

  const url = `postgres://${TEST_USER}:${TEST_PASSWORD}@127.0.0.1:${port}/${TEST_DATABASE}`;
  await migrateUrl(url);
  return {
    url,
    open: (maxConnections) => createDatabaseClient(url, maxConnections),
    dispose: async () => {
      await cluster.stop();
      await rm(dataDirectory, { recursive: true, force: true });
    },
  };
}

/**
 * Applies migrations to a connection string using a short-lived pool.
 * @param url PostgreSQL URL.
 */
async function migrateUrl(url: string): Promise<void> {
  const pool = new pg.Pool({ connectionString: url, max: 1 });
  try {
    await applyMigrations(pool);
  } finally {
    await pool.end();
  }
}

/**
 * Asks the operating system for an unused TCP port on the loopback interface.
 * @returns A free port number.
 */
function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => {
        if (address && typeof address === 'object') {
          resolve(address.port);
        } else {
          reject(new Error('Could not determine a free port.'));
        }
      });
    });
  });
}
