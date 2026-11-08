import { randomUUID } from 'node:crypto';

import {
  claimDueOutboxMessages,
  type DatabaseClient,
  DEMO_TENANT_ID,
  outboxMessages,
  seedDemoData,
} from '@marquee/database';
import { startTestDatabase, type TestDatabase } from '@marquee/database/test-harness';
import { createLogger } from '@marquee/observability';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { backoffMs, dispatchOnce, type NotificationSink } from '../src/dispatcher';

/** Controllable clock so lease and retry timing is exact. */
function fakeClock(startIso: string) {
  let current = Date.parse(startIso);
  return {
    now: () => new Date(current),
    advance(milliseconds: number) {
      current += milliseconds;
    },
  };
}

/** Logger that discards lines; tests assert on database state instead. */
const quietLogger = createLogger({ level: 'error', write: () => undefined });

describe('outbox dispatcher on real PostgreSQL', () => {
  let database: TestDatabase;
  let client: DatabaseClient;

  beforeAll(async () => {
    database = await startTestDatabase();
    client = database.open(10);
    await seedDemoData(client.db);
  }, 180_000);

  afterAll(async () => {
    await client.close();
    await database.dispose();
  });

  /**
   * Inserts pending outbox rows that are due at the given instant.
   * @param count Number of rows.
   * @param availableAt Availability instant.
   * @returns The inserted identifiers.
   */
  async function enqueue(count: number, availableAt: string): Promise<string[]> {
    const rows = Array.from({ length: count }, () => ({
      id: randomUUID(),
      tenantId: DEMO_TENANT_ID,
      topic: 'enquiry.created',
      dedupKey: `test:${randomUUID()}`,
      payload: { enquiryId: randomUUID() },
      status: 'pending' as const,
      attempts: 0,
      availableAt: new Date(availableAt),
    }));
    await client.db.insert(outboxMessages).values(rows);
    return rows.map((row) => row.id);
  }

  it('delivers due messages exactly once per pass and leaves nothing for a second pass', async () => {
    const clock = fakeClock('2030-01-01T00:00:00Z');
    const ids = await enqueue(3, '2029-12-31T00:00:00Z');
    const deliveredIds: string[] = [];
    const sink: NotificationSink = {
      deliver: (message) => {
        deliveredIds.push(message.id);
        return Promise.resolve();
      },
    };
    const options = { batchSize: 500, leaseSeconds: 120, maxAttempts: 5 };
    await dispatchOnce({ database: client, sink, clock, logger: quietLogger, options });
    for (const id of ids) {
      expect(deliveredIds.filter((delivered) => delivered === id)).toHaveLength(1);
    }

    const countBefore = deliveredIds.length;
    await dispatchOnce({ database: client, sink, clock, logger: quietLogger, options });
    expect(deliveredIds.length).toBe(countBefore);
  });

  it('never gives the same message to two concurrent workers', async () => {
    const clock = fakeClock('2030-02-01T00:00:00Z');
    await enqueue(6, '2030-01-31T00:00:00Z');
    const batches = await Promise.all([
      claimDueOutboxMessages(client.db, { limit: 2, leaseSeconds: 120, now: clock.now() }),
      claimDueOutboxMessages(client.db, { limit: 2, leaseSeconds: 120, now: clock.now() }),
      claimDueOutboxMessages(client.db, { limit: 2, leaseSeconds: 120, now: clock.now() }),
    ]);
    const claimed = batches.flat().map((message) => message.id);
    expect(new Set(claimed).size).toBe(claimed.length);
    expect(claimed.length).toBeGreaterThanOrEqual(6);
  });

  it('holds a lease until it expires, then lets another worker reclaim the message', async () => {
    const clock = fakeClock('2030-03-01T00:00:00Z');
    const [id] = await enqueue(1, '2030-02-28T00:00:00Z');
    const firstClaim = await claimDueOutboxMessages(client.db, {
      limit: 500,
      leaseSeconds: 60,
      now: clock.now(),
    });
    expect(firstClaim.map((message) => message.id)).toContain(id);

    const whileLeased = await claimDueOutboxMessages(client.db, {
      limit: 500,
      leaseSeconds: 60,
      now: clock.now(),
    });
    expect(whileLeased.map((message) => message.id)).not.toContain(id);

    clock.advance(61_000);
    const afterExpiry = await claimDueOutboxMessages(client.db, {
      limit: 500,
      leaseSeconds: 60,
      now: clock.now(),
    });
    expect(afterExpiry.find((message) => message.id === id)?.attempts).toBe(2);
  });

  it('retries with backoff and dead-letters after the maximum attempts', async () => {
    const clock = fakeClock('2030-04-01T00:00:00Z');
    const [id] = await enqueue(1, '2030-03-31T00:00:00Z');
    const failing: NotificationSink = {
      deliver: () => Promise.reject(new TypeError('provider unavailable')),
    };
    const options = { batchSize: 500, leaseSeconds: 60, maxAttempts: 2 };

    await dispatchOnce({ database: client, sink: failing, clock, logger: quietLogger, options });
    const retry = await client.db.execute<{
      status: string;
      available_at: Date;
      last_error: string;
    }>(sql`SELECT status, available_at, last_error FROM outbox_message WHERE id = ${id}`);
    expect(retry.rows[0]?.status).toBe('pending');
    expect(retry.rows[0]?.last_error).toBe('TypeError');
    expect(new Date(retry.rows[0]?.available_at ?? 0).getTime()).toBe(
      clock.now().getTime() + backoffMs(1),
    );

    clock.advance(backoffMs(1) + 1);
    await dispatchOnce({ database: client, sink: failing, clock, logger: quietLogger, options });
    const dead = await client.db.execute<{ status: string }>(
      sql`SELECT status FROM outbox_message WHERE id = ${id}`,
    );
    expect(dead.rows[0]?.status).toBe('dead');
  });

  it('caps the retry backoff at one hour', () => {
    expect(backoffMs(1)).toBe(60_000);
    expect(backoffMs(2)).toBe(120_000);
    expect(backoffMs(20)).toBe(60 * 60_000);
  });
});
