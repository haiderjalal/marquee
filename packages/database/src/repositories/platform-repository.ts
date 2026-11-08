import { and, desc, eq } from 'drizzle-orm';

import type { Database, Transaction } from '../client';
import { auditEvents, idempotencyRecords, outboxMessages } from '../schema';

/**
 * Cross-cutting persistence: audit trail, transactional outbox and idempotency.
 * Writers pass the open transaction so these rows commit with the business change.
 */

/** Audit entry written for every committed mutation. Summaries never hold secrets or raw contact data. */
export interface AuditEventInput {
  readonly id: string;
  readonly tenantId: string;
  readonly actorUserId: string | null;
  readonly actorKind: 'staff' | 'public' | 'system';
  readonly action: string;
  readonly entityType: string;
  readonly entityId: string | null;
  readonly correlationId: string;
  readonly summary: Record<string, unknown>;
}

/** Outbox intent written with the state change; delivered after commit by the worker. */
export interface OutboxInput {
  readonly id: string;
  readonly tenantId: string;
  readonly topic: string;
  readonly dedupKey: string;
  readonly payload: Record<string, unknown>;
}

/** Stored response for a previously executed command. */
export interface IdempotentResponse {
  readonly requestHash: string;
  readonly responseStatus: number;
  readonly responseBody: unknown;
}

/**
 * Appends an audit event inside the caller's transaction.
 * @param transaction Open transaction.
 * @param event Audit entry.
 */
export async function appendAuditEvent(
  transaction: Transaction,
  event: AuditEventInput,
): Promise<void> {
  await transaction.insert(auditEvents).values({
    id: event.id,
    tenantId: event.tenantId,
    actorUserId: event.actorUserId,
    actorKind: event.actorKind,
    action: event.action,
    entityType: event.entityType,
    entityId: event.entityId,
    correlationId: event.correlationId,
    summary: event.summary,
  });
}

/**
 * Lists recent audit events for one tenant, newest first.
 * @param db Database handle.
 * @param tenantId Tenant scope; required.
 * @param limit Maximum rows, bounded by the caller.
 * @returns Audit rows.
 */
export async function listAuditEvents(db: Database, tenantId: string, limit: number) {
  return db
    .select()
    .from(auditEvents)
    .where(eq(auditEvents.tenantId, tenantId))
    .orderBy(desc(auditEvents.occurredAt))
    .limit(limit);
}

/**
 * Enqueues an outbox message inside the caller's transaction. The dedup key makes a
 * second enqueue of the same business event a no-op instead of a duplicate notification.
 * @param transaction Open transaction.
 * @param message Outbox intent.
 */
export async function enqueueOutbox(transaction: Transaction, message: OutboxInput): Promise<void> {
  await transaction
    .insert(outboxMessages)
    .values({
      id: message.id,
      tenantId: message.tenantId,
      topic: message.topic,
      dedupKey: message.dedupKey,
      payload: message.payload,
      status: 'pending',
      attempts: 0,
      availableAt: new Date(),
    })
    .onConflictDoNothing({ target: outboxMessages.dedupKey });
}

/**
 * Looks up a previously stored response for an idempotent command.
 * @param db Database handle.
 * @param scope Tenant, principal, command and client key.
 * @returns The stored response or null.
 */
export async function findIdempotentResponse(
  db: Database,
  scope: { tenantId: string; principalKey: string; command: string; key: string },
): Promise<IdempotentResponse | null> {
  const [row] = await db
    .select()
    .from(idempotencyRecords)
    .where(
      and(
        eq(idempotencyRecords.tenantId, scope.tenantId),
        eq(idempotencyRecords.principalKey, scope.principalKey),
        eq(idempotencyRecords.command, scope.command),
        eq(idempotencyRecords.idempotencyKey, scope.key),
      ),
    )
    .limit(1);
  if (!row) {
    return null;
  }
  return {
    requestHash: row.requestHash,
    responseStatus: row.responseStatus,
    responseBody: row.responseBody,
  };
}

/**
 * Stores a command's response inside its transaction so a retry replays the same result.
 * @param transaction Open transaction.
 * @param scope Tenant, principal, command and client key.
 * @param response Hash of the request and the response to replay.
 */
export async function saveIdempotentResponse(
  transaction: Transaction,
  scope: { tenantId: string; principalKey: string; command: string; key: string },
  response: IdempotentResponse,
): Promise<void> {
  await transaction.insert(idempotencyRecords).values({
    tenantId: scope.tenantId,
    principalKey: scope.principalKey,
    command: scope.command,
    idempotencyKey: scope.key,
    requestHash: response.requestHash,
    responseStatus: response.responseStatus,
    responseBody: response.responseBody,
  });
}
