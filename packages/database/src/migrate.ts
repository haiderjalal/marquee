import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import type pg from 'pg';

/** Directory holding reviewed SQL migrations, applied in lexical order. */
export const MIGRATIONS_DIRECTORY = path.join(__dirname, 'migrations');

/** Session advisory-lock key so two migrators never run at the same time. */
const MIGRATION_LOCK_KEY = 752_001;

/** A migration file loaded from disk with its checksum. */
export interface MigrationFile {
  readonly name: string;
  readonly sql: string;
  readonly checksum: string;
}

/** Outcome of one migrator run. */
export interface MigrationReport {
  readonly applied: readonly string[];
  readonly alreadyApplied: readonly string[];
}

/**
 * Reads every `.sql` migration in a directory, sorted by file name.
 * @param directory Folder containing the migrations.
 * @returns Migration files with SHA-256 checksums.
 */
export function loadMigrations(directory: string = MIGRATIONS_DIRECTORY): MigrationFile[] {
  return readdirSync(directory)
    .filter((file) => file.endsWith('.sql'))
    .sort()
    .map((name) => {
      const sql = readFileSync(path.join(directory, name), 'utf8');
      return { name, sql, checksum: createHash('sha256').update(sql).digest('hex') };
    });
}

/**
 * Lists migration files that have not been applied to the database yet.
 * Used at API start-up so a stale schema fails loudly instead of at the first query.
 * @param pool Connection pool to the target database.
 * @param directory Migration folder.
 * @returns Names of pending migrations, in order; empty when the schema is current.
 */
export async function listPendingMigrations(
  pool: pg.Pool,
  directory: string = MIGRATIONS_DIRECTORY,
): Promise<string[]> {
  const present = await pool.query<{ present: boolean }>(
    "SELECT to_regclass('public.schema_migrations') IS NOT NULL AS present",
  );
  const applied = new Set<string>();
  if (present.rows[0]?.present) {
    const rows = await pool.query<{ name: string }>('SELECT name FROM schema_migrations');
    for (const row of rows.rows) {
      applied.add(row.name);
    }
  }
  return loadMigrations(directory)
    .map((migration) => migration.name)
    .filter((name) => !applied.has(name));
}

/**
 * Applies pending migrations, each in its own transaction, under an advisory lock.
 *
 * An already-applied migration whose checksum has changed is a hard error: history
 * is never edited, and a correction is a new migration. The lock is always released,
 * and a connection that fails to unlock is discarded rather than returned to the pool.
 *
 * @param pool Connection pool to the target database.
 * @param directory Migration folder (defaults to the packaged migrations).
 * @returns Names of migrations applied now and those that were already present.
 * @throws Error when a recorded checksum no longer matches its file.
 */
export async function applyMigrations(
  pool: pg.Pool,
  directory: string = MIGRATIONS_DIRECTORY,
): Promise<MigrationReport> {
  const migrations = loadMigrations(directory);
  const client = await pool.connect();
  let discardConnection = false;
  const applied: string[] = [];
  const alreadyApplied: string[] = [];
  try {
    await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_KEY]);
    await client.query(
      `CREATE TABLE IF NOT EXISTS schema_migrations (
         name text PRIMARY KEY,
         checksum text NOT NULL,
         applied_at timestamptz NOT NULL DEFAULT now()
       )`,
    );
    const existing = await client.query<{ name: string; checksum: string }>(
      'SELECT name, checksum FROM schema_migrations',
    );
    const recorded = new Map(existing.rows.map((row) => [row.name, row.checksum]));

    for (const migration of migrations) {
      const recordedChecksum = recorded.get(migration.name);
      if (recordedChecksum !== undefined) {
        if (recordedChecksum !== migration.checksum) {
          throw new Error(
            `Migration ${migration.name} was edited after it was applied. Add a new migration instead.`,
          );
        }
        alreadyApplied.push(migration.name);
        continue;
      }
      await client.query('BEGIN');
      try {
        await client.query(migration.sql);
        await client.query('INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)', [
          migration.name,
          migration.checksum,
        ]);
        await client.query('COMMIT');
        applied.push(migration.name);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
  } catch (error) {
    discardConnection = true;
    throw error;
  } finally {
    await releaseLock(client, discardConnection);
  }
  return { applied, alreadyApplied };
}

/**
 * Releases the migration advisory lock and returns the connection to the pool.
 * If unlocking fails the connection is destroyed, so a session holding the lock
 * can never be reused by another caller.
 * @param client Connected pool client.
 * @param discard True when the connection must not be reused.
 */
async function releaseLock(client: pg.PoolClient, discard: boolean): Promise<void> {
  try {
    await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_KEY]);
    client.release(discard ? true : undefined);
  } catch (error) {
    client.release(error instanceof Error ? error : true);
  }
}
