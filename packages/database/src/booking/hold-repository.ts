import { randomUUID } from 'node:crypto';

import { DomainError, type HalfOpenInterval } from '@marquee/domain';
import { sql } from 'drizzle-orm';

import type { Database, Transaction } from '../client';

/**
 * Booking write path: atomic hold acquisition with ordered row locks.
 *
 * Global lock order (every command that touches claims follows it):
 *   1. exclusive resource rows (atomic_resource), sorted by UUID;
 *   2. stock-pool rows, sorted by UUID (added with the inventory slice);
 *   3. affected hold rows, sorted by UUID.
 * A command reads identifiers without locks to build its set, then acquires the
 * locks in order and revalidates the mapping. If discovery under the lock finds
 * an extra resource, the transaction is rolled back and retried with the larger
 * set, so no out-of-order lock is ever requested.
 *
 * Expiry uses the database clock (now()) inside the transaction. Time never
 * appears in an index or constraint predicate.
 */

/** Maximum attempts (lock-set expansions and concurrency retries together) before giving up. */
const MAX_ACQUIRE_ATTEMPTS = 6;

/** SQLSTATE codes for serialization failure and deadlock, which are safe to retry. */
const RETRYABLE_CONCURRENCY_CODES = new Set(['40001', '40P01']);

/** Input for placing a temporary hold on a space for one occupation interval. */
export interface HoldRequest {
  readonly tenantId: string;
  readonly spaceId: string;
  readonly enquiryId: string | null;
  readonly createdByUserId: string;
  /** Occupation interval already expanded with setup and teardown (epoch milliseconds). */
  readonly occupation: HalfOpenInterval;
  readonly ttlMinutes: number;
}

/** A hold as committed to the database. */
export interface AcquiredHold {
  readonly id: string;
  readonly spaceId: string;
  readonly occupiedFrom: Date;
  readonly occupiedUntil: Date;
  readonly expiresAt: Date;
  readonly resourceIds: readonly string[];
  /** Holds expired by this command before the new hold was inserted. */
  readonly expiredHoldIds: readonly string[];
}

/** Work that must commit in the same transaction as the hold (audit, outbox, idempotency). */
export type AfterAcquire = (transaction: Transaction, hold: AcquiredHold) => Promise<void>;

/** Internal signal: the lock set must grow, so the transaction restarts. */
class LockSetExpandedError extends Error {
  readonly expandedResourceIds: string[];

  /**
   * @param expandedResourceIds The complete, sorted set to lock on the next attempt.
   */
  constructor(expandedResourceIds: string[]) {
    super('Lock set expanded; restarting acquisition.');
    this.name = 'LockSetExpandedError';
    this.expandedResourceIds = expandedResourceIds;
  }
}

/**
 * Atomically acquires a hold on every resource that the space maps to.
 *
 * All claims are inserted or none are. Overlaps with active claims raise
 * SLOT_CONFLICT; the exclusion constraint is the last line of defence.
 *
 * @param db Database handle.
 * @param request Validated hold request with the expanded occupation interval.
 * @param afterAcquire Callback run inside the same transaction after the hold is inserted.
 * @returns The committed hold.
 * @throws DomainError with SLOT_CONFLICT, NOT_FOUND or a retryable SLOT_CONFLICT when contention persists.
 */
export async function acquireHold(
  db: Database,
  request: HoldRequest,
  afterAcquire: AfterAcquire,
): Promise<AcquiredHold> {
  let lockSet = await readSpaceResourceIds(db, request.tenantId, request.spaceId);
  if (lockSet.length === 0) {
    throw new DomainError('NOT_FOUND', 'This space has no bookable resources.');
  }

  for (let attempt = 1; attempt <= MAX_ACQUIRE_ATTEMPTS; attempt += 1) {
    try {
      return await db.transaction(async (transaction) => {
        const hold = await acquireWithOrderedLocks(transaction, request, lockSet);
        await afterAcquire(transaction, hold);
        return hold;
      });
    } catch (error) {
      if (error instanceof LockSetExpandedError) {
        lockSet = error.expandedResourceIds;
        continue;
      }
      const code = pgErrorCode(error);
      if (
        code !== undefined &&
        RETRYABLE_CONCURRENCY_CODES.has(code) &&
        attempt < MAX_ACQUIRE_ATTEMPTS
      ) {
        await delay(jitterMilliseconds(attempt));
        continue;
      }
      throw mapWriteError(error);
    }
  }
  throw new DomainError(
    'SLOT_CONFLICT',
    'The space is being changed by another request. Please try again.',
  );
}

/**
 * Chooses a randomised pause before a retry so competing transactions do not collide again.
 * @param attempt The attempt that just failed (1-based).
 * @returns Milliseconds to wait.
 */
function jitterMilliseconds(attempt: number): number {
  return Math.floor(Math.random() * 15 * attempt) + 5;
}

/**
 * Waits for a number of milliseconds.
 * @param milliseconds Duration to wait.
 * @returns A promise that resolves after the wait.
 */
function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

/**
 * Runs the locked part of the acquisition inside an open transaction.
 * @param transaction Open transaction.
 * @param request Hold request.
 * @param lockSet Sorted resource identifiers to lock.
 * @returns The inserted hold.
 * @throws LockSetExpandedError when the set must grow; DomainError on a conflict.
 */
async function acquireWithOrderedLocks(
  transaction: Transaction,
  request: HoldRequest,
  lockSet: readonly string[],
): Promise<AcquiredHold> {
  const tenantId = request.tenantId;

  const locked = await transaction.execute<{ id: string }>(sql`
    SELECT id FROM atomic_resource
    WHERE tenant_id = ${tenantId} AND id IN (${joinIds(lockSet)})
    ORDER BY id
    FOR UPDATE`);
  if (locked.rows.length !== lockSet.length) {
    throw new DomainError(
      'NOT_FOUND',
      'A bookable resource for this space is no longer available.',
    );
  }

  // Every resource the space maps to must be locked. Extra locked resources are fine:
  // an expanded set (for expiry) may legitimately contain more than the space needs.
  const currentIds = await readSpaceResourceIds(transaction, tenantId, request.spaceId);
  if (currentIds.some((id) => !lockSet.includes(id))) {
    throw new LockSetExpandedError(sortedUnion(currentIds, lockSet));
  }

  const expiredHoldIds = await expireStaleHolds(transaction, tenantId, lockSet);

  const start = new Date(request.occupation.startMs).toISOString();
  const end = new Date(request.occupation.endMs).toISOString();

  const conflicts = await transaction.execute<{ hold_id: string }>(sql`
    SELECT hold_id FROM resource_claim
    WHERE tenant_id = ${tenantId}
      AND resource_id IN (${joinIds(lockSet)})
      AND claim_state IN ('held', 'confirmed')
      AND occupied_at && tstzrange(${start}::timestamptz, ${end}::timestamptz, '[)')
    LIMIT 1`);
  if (conflicts.rows.length > 0) {
    throw new DomainError(
      'SLOT_CONFLICT',
      'That hall is already reserved for an overlapping time.',
    );
  }

  const holdId = randomUUID();
  const inserted = await transaction.execute<{ expires_at: Date }>(sql`
    INSERT INTO hold (id, tenant_id, space_id, enquiry_id, status, occupied_at, expires_at, created_by, revision)
    VALUES (
      ${holdId},
      ${tenantId},
      ${request.spaceId},
      ${request.enquiryId},
      'held',
      tstzrange(${start}::timestamptz, ${end}::timestamptz, '[)'),
      now() + make_interval(mins => ${request.ttlMinutes}::int),
      ${request.createdByUserId},
      1
    )
    RETURNING expires_at`);
  const expiresAt = inserted.rows[0]?.expires_at;
  if (!expiresAt) {
    throw new Error('Hold insert returned no expiry; database contract broken.');
  }

  const claimRows = lockSet.map(
    (resourceId) => sql`(
      ${randomUUID()}, ${tenantId}, ${resourceId}, ${holdId},
      tstzrange(${start}::timestamptz, ${end}::timestamptz, '[)'),
      'held', ${expiresAt}::timestamptz
    )`,
  );
  await transaction.execute(sql`
    INSERT INTO resource_claim (id, tenant_id, resource_id, hold_id, occupied_at, claim_state, expires_at)
    VALUES ${sql.join(claimRows, sql`, `)}`);

  return {
    id: holdId,
    spaceId: request.spaceId,
    occupiedFrom: new Date(start),
    occupiedUntil: new Date(end),
    expiresAt: new Date(expiresAt),
    resourceIds: lockSet,
    expiredHoldIds,
  };
}

/**
 * Expires held claims whose hold has passed its expiry, under the resource locks.
 * Every claim of an expiring hold must be locked before it changes, so a hold that
 * also occupies a resource outside the lock set forces a restart with the larger set.
 * @param transaction Open transaction holding the resource locks.
 * @param tenantId Tenant scope.
 * @param lockSet Locked resource identifiers.
 * @returns Identifiers of the holds that were expired by this call.
 * @throws LockSetExpandedError when an expiring hold reaches an unlocked resource.
 */
async function expireStaleHolds(
  transaction: Transaction,
  tenantId: string,
  lockSet: readonly string[],
): Promise<string[]> {
  const expiring = await transaction.execute<{ hold_id: string }>(sql`
    SELECT DISTINCT hold_id FROM resource_claim
    WHERE tenant_id = ${tenantId}
      AND resource_id IN (${joinIds(lockSet)})
      AND claim_state = 'held'
      AND expires_at <= now()`);
  const holdIds = expiring.rows.map((row) => row.hold_id);
  if (holdIds.length === 0) {
    return [];
  }

  const related = await transaction.execute<{ resource_id: string }>(sql`
    SELECT DISTINCT resource_id FROM resource_claim
    WHERE tenant_id = ${tenantId}
      AND hold_id IN (${joinIds(holdIds)})`);
  const relatedIds = related.rows.map((row) => row.resource_id);
  if (relatedIds.some((id) => !lockSet.includes(id))) {
    throw new LockSetExpandedError(sortedUnion(lockSet, relatedIds));
  }

  await transaction.execute(sql`
    UPDATE resource_claim SET claim_state = 'expired'
    WHERE tenant_id = ${tenantId} AND hold_id IN (${joinIds(holdIds)}) AND claim_state = 'held'`);
  await transaction.execute(sql`
    UPDATE hold SET status = 'expired', revision = revision + 1
    WHERE tenant_id = ${tenantId} AND id IN (${joinIds(holdIds)}) AND status = 'held'`);
  return holdIds;
}

/**
 * Reads the resources a space maps to, sorted by UUID. Used without locks to build
 * the lock set, and again under locks to revalidate it.
 * @param executor Database or transaction handle.
 * @param tenantId Tenant scope.
 * @param spaceId Space identifier.
 * @returns Sorted resource identifiers in lowercase canonical form.
 */
export async function readSpaceResourceIds(
  executor: Database | Transaction,
  tenantId: string,
  spaceId: string,
): Promise<string[]> {
  const result = await executor.execute<{ resource_id: string }>(sql`
    SELECT resource_id FROM space_resource
    WHERE tenant_id = ${tenantId} AND space_id = ${spaceId}
    ORDER BY resource_id`);
  return result.rows.map((row) => row.resource_id.toLowerCase()).sort();
}

/**
 * Builds a comma-separated list of bound identifiers for an IN clause.
 * @param ids Identifiers to bind.
 * @returns A SQL fragment such as $1, $2, $3.
 */
function joinIds(ids: readonly string[]) {
  return sql.join(
    ids.map((id) => sql`${id}`),
    sql`, `,
  );
}

/**
 * Returns the sorted union of two identifier lists without duplicates.
 * @param left First list.
 * @param right Second list.
 * @returns A new sorted list.
 */
function sortedUnion(left: readonly string[], right: readonly string[]): string[] {
  return [...new Set([...left, ...right].map((id) => id.toLowerCase()))].sort();
}

/**
 * Translates driver errors into domain errors. An exclusion violation (SQLSTATE 23P01)
 * means a concurrent writer won the race, which callers report as SLOT_CONFLICT.
 * @param error Error thrown by the transaction.
 * @returns A DomainError when recognised, otherwise the original error.
 */
function mapWriteError(error: unknown): unknown {
  if (pgErrorCode(error) === '23P01') {
    return new DomainError(
      'SLOT_CONFLICT',
      'That hall was reserved by another request. Choose another time.',
    );
  }
  return error;
}

/**
 * Extracts a PostgreSQL SQLSTATE code, looking through driver wrappers.
 * @param error Thrown value.
 * @returns The five-character code, or undefined.
 */
export function pgErrorCode(error: unknown): string | undefined {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && typeof current === 'object' && current !== null; depth += 1) {
    const code: unknown = Reflect.get(current, 'code');
    if (typeof code === 'string' && /^[0-9A-Z]{5}$/.test(code)) {
      return code;
    }
    current = Reflect.get(current, 'cause');
  }
  return undefined;
}
