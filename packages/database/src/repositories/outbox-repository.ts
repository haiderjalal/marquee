import { sql } from 'drizzle-orm';

import type { Database } from '../client';

/**
 * Outbox persistence for the worker. Claims use row locks with SKIP LOCKED so concurrent
 * workers never take the same message, and a lease lets a crashed worker's messages be
 * reclaimed later. Delivery is at-least-once: consumers must deduplicate by dedup_key.
 */

/** A message leased to one worker for one delivery attempt. */
export interface ClaimedOutboxMessage {
  readonly id: string;
  readonly tenantId: string;
  readonly topic: string;
  readonly dedupKey: string;
  readonly payload: unknown;
  /** Attempts including the one now starting. */
  readonly attempts: number;
}

/**
 * Leases up to `limit` due messages. A message is due when it is pending, its availability
 * time has passed and no other worker holds an unexpired lease on it.
 * @param db Database handle.
 * @param input Batch size, lease length and the authoritative current time.
 * @returns The leased messages.
 */
export async function claimDueOutboxMessages(
  db: Database,
  input: { readonly limit: number; readonly leaseSeconds: number; readonly now: Date },
): Promise<ClaimedOutboxMessage[]> {
  const nowIso = input.now.toISOString();
  const result = await db.execute<{
    id: string;
    tenant_id: string;
    topic: string;
    dedup_key: string;
    payload: unknown;
    attempts: number;
  }>(sql`
    WITH due AS (
      SELECT id FROM outbox_message
      WHERE status = 'pending'
        AND available_at <= ${nowIso}::timestamptz
        AND (locked_until IS NULL OR locked_until <= ${nowIso}::timestamptz)
      ORDER BY available_at
      LIMIT ${input.limit}
      FOR UPDATE SKIP LOCKED
    )
    UPDATE outbox_message AS m
    SET locked_until = ${nowIso}::timestamptz + make_interval(secs => ${input.leaseSeconds}::int),
        attempts = m.attempts + 1
    FROM due
    WHERE m.id = due.id
    RETURNING m.id, m.tenant_id, m.topic, m.dedup_key, m.payload, m.attempts`);
  return result.rows.map((row) => ({
    id: row.id,
    tenantId: row.tenant_id,
    topic: row.topic,
    dedupKey: row.dedup_key,
    payload: row.payload,
    attempts: row.attempts,
  }));
}

/**
 * Marks a message delivered and releases its lease. Idempotent: a repeat has no effect.
 * @param db Database handle.
 * @param id Outbox message identifier.
 */
export async function markOutboxDelivered(db: Database, id: string): Promise<void> {
  await db.execute(sql`
    UPDATE outbox_message
    SET status = 'delivered', locked_until = NULL, last_error = NULL
    WHERE id = ${id} AND status = 'pending'`);
}

/**
 * Records a failed attempt. The message returns to pending after a backoff, or becomes
 * dead-lettered when retries are exhausted. Dead letters stay visible for operator replay.
 * @param db Database handle.
 * @param input Message, retry time, dead-letter flag and a non-sensitive failure category.
 */
export async function recordOutboxFailure(
  db: Database,
  input: {
    readonly id: string;
    readonly retryAt: Date;
    readonly dead: boolean;
    readonly errorCategory: string;
  },
): Promise<void> {
  const error = input.errorCategory.slice(0, 500);
  if (input.dead) {
    await db.execute(sql`
      UPDATE outbox_message
      SET status = 'dead', locked_until = NULL, last_error = ${error}
      WHERE id = ${input.id}`);
    return;
  }
  await db.execute(sql`
    UPDATE outbox_message
    SET locked_until = NULL, available_at = ${input.retryAt.toISOString()}::timestamptz, last_error = ${error}
    WHERE id = ${input.id}`);
}
