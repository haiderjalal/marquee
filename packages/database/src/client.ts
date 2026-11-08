import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';

import * as schema from './schema';

/** Typed Drizzle handle bound to the application schema. */
export type Database = NodePgDatabase<typeof schema>;

/** Transaction handle passed to repository functions that must share one transaction. */
export type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

/** A pool plus its Drizzle wrapper; the pool must be closed on shutdown. */
export interface DatabaseClient {
  readonly pool: pg.Pool;
  readonly db: Database;
  close(): Promise<void>;
}

/**
 * Opens a connection pool and returns a Drizzle wrapper.
 *
 * The pool never sets tenant or actor session state. Tenant scope is applied in
 * every query by the repositories, so reused pooled connections cannot leak scope.
 *
 * @param connectionString PostgreSQL URL, read from configuration (never hard-coded).
 * @param maxConnections Pool size; defaults to a small value suitable for one API instance.
 * @returns The client.
 */
export function createDatabaseClient(
  connectionString: string,
  maxConnections = 10,
): DatabaseClient {
  const pool = new pg.Pool({ connectionString, max: maxConnections });
  return {
    pool,
    db: drizzle(pool, { schema }),
    close: () => pool.end(),
  };
}
