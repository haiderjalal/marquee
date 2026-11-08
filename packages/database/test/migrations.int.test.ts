import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { applyMigrations, listPendingMigrations, MIGRATIONS_DIRECTORY } from '../src/migrate';
import { startTestDatabase, type TestDatabase } from '../src/test-harness';

/**
 * Migration bookkeeping: a database that is behind its migrations must be detectable, so the
 * API can refuse to start instead of failing at the first query that needs the new column.
 */
describe('schema currency on real PostgreSQL', () => {
  let database: TestDatabase;
  let scratch: string;

  beforeAll(async () => {
    database = await startTestDatabase();
    scratch = await mkdtemp(path.join(os.tmpdir(), 'marquee-migrations-'));
  }, 180_000);

  afterAll(async () => {
    await rm(scratch, { recursive: true, force: true });
    await database.dispose();
  });

  it('reports no pending migrations for a database migrated with the packaged files', async () => {
    const pool = new pg.Pool({ connectionString: database.url, max: 1 });
    try {
      expect(await listPendingMigrations(pool, MIGRATIONS_DIRECTORY)).toEqual([]);
    } finally {
      await pool.end();
    }
  });

  it('reports a newer migration as pending until it is applied', async () => {
    const directory = path.join(scratch, 'staged');
    await mkdir(directory, { recursive: true });
    await writeFile(
      path.join(directory, '0001_base.sql'),
      'CREATE TABLE stage_probe (id integer PRIMARY KEY);',
    );
    await writeFile(
      path.join(directory, '0002_column.sql'),
      'ALTER TABLE stage_probe ADD COLUMN note text;',
    );

    const pool = new pg.Pool({ connectionString: database.url, max: 1 });
    try {
      await applyMigrations(pool, directory);
      await writeFile(
        path.join(directory, '0003_later.sql'),
        'ALTER TABLE stage_probe ADD COLUMN extra text;',
      );
      expect(await listPendingMigrations(pool, directory)).toEqual(['0003_later.sql']);
      await applyMigrations(pool, directory);
      expect(await listPendingMigrations(pool, directory)).toEqual([]);
    } finally {
      await pool.end();
    }
  });
});
