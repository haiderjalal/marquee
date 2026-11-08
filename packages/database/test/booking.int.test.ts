import { randomUUID } from 'node:crypto';

import { createInterval, DomainError, type HalfOpenInterval } from '@marquee/domain';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  type AcquiredHold,
  acquireHold,
  type AfterAcquire,
  type HoldRequest,
  pgErrorCode,
} from '../src/booking/hold-repository';
import { type Database, type DatabaseClient } from '../src/client';
import { appendAuditEvent } from '../src/repositories/platform-repository';
import { atomicResources, spaceResources, spaces, tenants, venues } from '../src/schema';
import { DEMO_OWNER_USER_ID, DEMO_TENANT_ID, DEMO_IDS, seedDemoData } from '../src/seed';
import { startTestDatabase, type TestDatabase } from '../src/test-harness';

/**
 * Real PostgreSQL 17 integration suite for the booking and tenancy invariants.
 * SQLite or mocked repositories cannot prove range exclusion, row locking or races,
 * so these tests run against an embedded cluster that is created for this run.
 */

const HOUR_MS = 3_600_000;
/** Fixed instant for readable fixtures: 2026-12-20 06:00 UTC. */
const T0 = Date.UTC(2026, 11, 20, 6, 0);

/** Interval from hour offsets relative to T0. */
function hours(from: number, to: number): HalfOpenInterval {
  return createInterval(T0 + from * HOUR_MS, T0 + to * HOUR_MS);
}

/** Creates a venue with the given number of halls and returns their identifiers. */
async function createVenueWithHalls(
  db: Database,
  hallCount: number,
): Promise<{ venueId: string; hallIds: string[] }> {
  const venueId = randomUUID();
  const hallIds = Array.from({ length: hallCount }, () => randomUUID());
  const slugSuffix = venueId.slice(0, 8);
  await db.transaction(async (tx) => {
    await tx.insert(venues).values({
      id: venueId,
      tenantId: DEMO_TENANT_ID,
      slug: `test-venue-${slugSuffix}`,
      name: `Test venue ${slugSuffix}`,
      tagline: 'Fixture venue for integration tests.',
      indoor: true,
      publishedCapacityGuests: 100,
      timezone: 'Asia/Karachi',
      facilities: [],
      publicationStatus: 'draft',
    });
    await tx.insert(atomicResources).values(
      hallIds.map((id, index) => ({
        id,
        tenantId: DEMO_TENANT_ID,
        venueId,
        label: `Hall ${index + 1} ${slugSuffix}`,
        kind: 'hall' as const,
      })),
    );
  });
  return { venueId, hallIds };
}

/** Adds a bookable space that maps to the given resources and returns its identifier. */
async function addSpace(
  db: Database,
  venueId: string,
  resourceIds: readonly string[],
): Promise<string> {
  const spaceId = randomUUID();
  await db.transaction(async (tx) => {
    await tx.insert(spaces).values({
      id: spaceId,
      tenantId: DEMO_TENANT_ID,
      venueId,
      name: `Space ${spaceId.slice(0, 8)}`,
      rentMinor: 0n,
      shellVersionId: 'demo-shell-a-v2',
      publishedCapacityGuests: 100,
    });
    await tx
      .insert(spaceResources)
      .values(resourceIds.map((resourceId) => ({ tenantId: DEMO_TENANT_ID, spaceId, resourceId })));
  });
  return spaceId;
}

/** Builds a hold request for a space and interval with no enquiry link. */
function requestFor(spaceId: string, occupation: HalfOpenInterval, ttlMinutes = 30): HoldRequest {
  return {
    tenantId: DEMO_TENANT_ID,
    spaceId,
    enquiryId: null,
    createdByUserId: DEMO_OWNER_USER_ID,
    occupation,
    ttlMinutes,
  };
}

/** Callback that does nothing after acquisition; used when no companion writes are needed. */
const noCompanionWrites: AfterAcquire = () => Promise.resolve();

/** Reads the number of active claims overlapping an interval on one resource. */
async function countActiveClaims(
  db: Database,
  resourceId: string,
  occupation: HalfOpenInterval,
): Promise<number> {
  const start = new Date(occupation.startMs).toISOString();
  const end = new Date(occupation.endMs).toISOString();
  const result = await db.execute<{ total: number }>(sql`
    SELECT count(*)::int AS total FROM resource_claim
    WHERE tenant_id = ${DEMO_TENANT_ID}
      AND resource_id = ${resourceId}
      AND claim_state IN ('held', 'confirmed')
      AND occupied_at && tstzrange(${start}::timestamptz, ${end}::timestamptz, '[)')`);
  return result.rows[0]?.total ?? 0;
}

describe('booking and tenancy integrity on real PostgreSQL', () => {
  let database: TestDatabase;
  let client: DatabaseClient;

  beforeAll(async () => {
    database = await startTestDatabase();
    client = database.open(20);
    await seedDemoData(client.db);
  }, 180_000);

  afterAll(async () => {
    await client.close();
    await database.dispose();
  });

  it('seeds the demo tenant idempotently', async () => {
    await seedDemoData(client.db);
    const rows = await client.db.select().from(tenants);
    const demoRows = rows.filter((row) => row.id === DEMO_TENANT_ID);
    expect(demoRows).toHaveLength(1);
    const demoVenues = await client.db.select().from(venues);
    expect(demoVenues.filter((venue) => venue.tenantId === DEMO_TENANT_ID)).toHaveLength(2);
  });

  it('lets one hold win and rejects an overlapping hold on the same hall', async () => {
    const { venueId, hallIds } = await createVenueWithHalls(client.db, 1);
    const spaceId = await addSpace(client.db, venueId, hallIds);
    const first = await acquireHold(client.db, requestFor(spaceId, hours(0, 4)), noCompanionWrites);
    expect(first.resourceIds).toEqual(hallIds);

    await expect(
      acquireHold(client.db, requestFor(spaceId, hours(3, 5)), noCompanionWrites),
    ).rejects.toMatchObject({ code: 'SLOT_CONFLICT' });
  });

  it('allows a hold that starts exactly when another one ends (half-open intervals)', async () => {
    const { venueId, hallIds } = await createVenueWithHalls(client.db, 1);
    const spaceId = await addSpace(client.db, venueId, hallIds);
    await acquireHold(client.db, requestFor(spaceId, hours(0, 4)), noCompanionWrites);
    const adjacent = await acquireHold(
      client.db,
      requestFor(spaceId, hours(4, 8)),
      noCompanionWrites,
    );
    expect(adjacent.occupiedFrom.getTime()).toBe(T0 + 4 * HOUR_MS);
  });

  it('enforces non-overlap in PostgreSQL itself, without any application lock', async () => {
    const { venueId, hallIds } = await createVenueWithHalls(client.db, 1);
    const spaceId = await addSpace(client.db, venueId, hallIds);
    const holdOne = randomUUID();
    const holdTwo = randomUUID();
    const insertRawHold = (id: string) =>
      client.db.execute(sql`
        INSERT INTO hold (id, tenant_id, space_id, status, occupied_at, expires_at, created_by, revision)
        VALUES (${id}, ${DEMO_TENANT_ID}, ${spaceId}, 'held',
                tstzrange(${new Date(T0).toISOString()}::timestamptz, ${new Date(T0 + 2 * HOUR_MS).toISOString()}::timestamptz, '[)'),
                now() + interval '1 hour', ${DEMO_OWNER_USER_ID}, 1)`);
    const insertRawClaim = (holdId: string, startHour: number, endHour: number) =>
      client.db.execute(sql`
        INSERT INTO resource_claim (id, tenant_id, resource_id, hold_id, occupied_at, claim_state, expires_at)
        VALUES (${randomUUID()}, ${DEMO_TENANT_ID}, ${hallIds[0]}, ${holdId},
                tstzrange(${new Date(T0 + startHour * HOUR_MS).toISOString()}::timestamptz,
                          ${new Date(T0 + endHour * HOUR_MS).toISOString()}::timestamptz, '[)'),
                'held', now() + interval '1 hour')`);

    await insertRawHold(holdOne);
    await insertRawHold(holdTwo);
    await insertRawClaim(holdOne, 0, 2);
    const overlapping = insertRawClaim(holdTwo, 1, 3);
    await expect(overlapping).rejects.toSatisfy((error: unknown) => pgErrorCode(error) === '23P01');
  });

  it('lets exactly one of thirty concurrent requests for the same hall interval succeed', async () => {
    const { venueId, hallIds } = await createVenueWithHalls(client.db, 1);
    const spaceId = await addSpace(client.db, venueId, hallIds);
    const occupation = hours(10, 14);

    const outcomes = await Promise.allSettled(
      Array.from({ length: 30 }, () =>
        acquireHold(client.db, requestFor(spaceId, occupation), noCompanionWrites),
      ),
    );
    const winners = outcomes.filter((outcome) => outcome.status === 'fulfilled');
    const losers = outcomes.filter(
      (outcome): outcome is PromiseRejectedResult => outcome.status === 'rejected',
    );

    expect(winners).toHaveLength(1);
    expect(losers).toHaveLength(29);
    for (const loser of losers) {
      expect(loser.reason).toBeInstanceOf(DomainError);
      expect(loser.reason).toMatchObject({ code: 'SLOT_CONFLICT' });
    }
    expect(await countActiveClaims(client.db, hallIds[0] ?? '', occupation)).toBe(1);
  });

  it('keeps a combined hall and a single hall mutually exclusive under concurrent requests', async () => {
    const { venueId, hallIds } = await createVenueWithHalls(client.db, 2);
    const combined = await addSpace(client.db, venueId, hallIds);
    const singleA = await addSpace(client.db, venueId, [hallIds[0] ?? '']);
    const occupationCombined = hours(20, 24);
    const occupationSingle = hours(21, 23);

    const outcomes = await Promise.allSettled([
      acquireHold(client.db, requestFor(combined, occupationCombined), noCompanionWrites),
      acquireHold(client.db, requestFor(singleA, occupationSingle), noCompanionWrites),
      acquireHold(client.db, requestFor(combined, occupationCombined), noCompanionWrites),
      acquireHold(client.db, requestFor(singleA, occupationSingle), noCompanionWrites),
    ]);
    expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1);
    expect(await countActiveClaims(client.db, hallIds[0] ?? '', hours(20, 24))).toBe(1);
  });

  it('expires a stale hold under the lock and lets an overlapping request take the slot', async () => {
    const { venueId, hallIds } = await createVenueWithHalls(client.db, 1);
    const spaceId = await addSpace(client.db, venueId, hallIds);
    const stale = await acquireHold(
      client.db,
      requestFor(spaceId, hours(0, 2), 5),
      noCompanionWrites,
    );
    await client.db.execute(sql`
      UPDATE resource_claim SET expires_at = now() - interval '1 minute' WHERE hold_id = ${stale.id}`);
    await client.db.execute(sql`
      UPDATE hold SET expires_at = now() - interval '1 minute' WHERE id = ${stale.id}`);

    const replacement = await acquireHold(
      client.db,
      requestFor(spaceId, hours(1, 3)),
      noCompanionWrites,
    );
    expect(replacement.expiredHoldIds).toEqual([stale.id]);
    const after = await client.db.execute<{ status: string }>(
      sql`SELECT status FROM hold WHERE id = ${stale.id}`,
    );
    expect(after.rows[0]?.status).toBe('expired');
  });

  it('restarts with a larger lock set when an expiring combined hold holds an unlocked resource', async () => {
    const { venueId, hallIds } = await createVenueWithHalls(client.db, 2);
    const combined = await addSpace(client.db, venueId, hallIds);
    const singleA = await addSpace(client.db, venueId, [hallIds[0] ?? '']);
    const expiringCombined: AcquiredHold = await acquireHold(
      client.db,
      requestFor(combined, hours(0, 3), 5),
      noCompanionWrites,
    );
    await client.db.execute(sql`
      UPDATE resource_claim SET expires_at = now() - interval '1 minute' WHERE hold_id = ${expiringCombined.id}`);
    await client.db.execute(sql`
      UPDATE hold SET expires_at = now() - interval '1 minute' WHERE id = ${expiringCombined.id}`);

    const replacement = await acquireHold(
      client.db,
      requestFor(singleA, hours(1, 2)),
      noCompanionWrites,
    );
    expect(replacement.expiredHoldIds).toEqual([expiringCombined.id]);
    const claimStates = await client.db.execute<{ resource_id: string; claim_state: string }>(sql`
      SELECT resource_id, claim_state FROM resource_claim WHERE hold_id = ${expiringCombined.id} ORDER BY resource_id`);
    expect(claimStates.rows.map((row) => row.claim_state)).toEqual(['expired', 'expired']);
  });

  it('rolls back the hold and its companion writes together when the companion fails', async () => {
    const { venueId, hallIds } = await createVenueWithHalls(client.db, 1);
    const spaceId = await addSpace(client.db, venueId, hallIds);
    const failingCompanion: AfterAcquire = () =>
      Promise.reject(new Error('simulated audit failure'));
    await expect(
      acquireHold(client.db, requestFor(spaceId, hours(0, 1)), failingCompanion),
    ).rejects.toThrow('simulated audit failure');
    expect(await countActiveClaims(client.db, hallIds[0] ?? '', hours(0, 1))).toBe(0);
  });

  it('refuses to attach another tenant to a venue through a composite foreign key', async () => {
    const otherTenant = randomUUID();
    await client.db
      .insert(tenants)
      .values({ id: otherTenant, slug: `other-${otherTenant.slice(0, 8)}`, name: 'Other' });
    const attempt = client.db.insert(spaces).values({
      id: randomUUID(),
      tenantId: otherTenant,
      venueId: DEMO_IDS.venueA,
      name: 'Cross tenant space',
      rentMinor: 0n,
      shellVersionId: 'demo-shell-a-v2',
      publishedCapacityGuests: 10,
    });
    await expect(attempt).rejects.toSatisfy((error: unknown) => pgErrorCode(error) === '23503');
  });

  it('makes audit events immutable at the database level', async () => {
    const auditId = randomUUID();
    await client.db.transaction((tx) =>
      appendAuditEvent(tx, {
        id: auditId,
        tenantId: DEMO_TENANT_ID,
        actorUserId: DEMO_OWNER_USER_ID,
        actorKind: 'staff',
        action: 'test.audit_written',
        entityType: 'test',
        entityId: null,
        correlationId: randomUUID(),
        summary: {},
      }),
    );
    await expect(
      client.db.execute(sql`UPDATE audit_event SET action = 'test.tampered' WHERE id = ${auditId}`),
    ).rejects.toSatisfy((error: unknown) => pgErrorCode(error) === '42501');
    await expect(
      client.db.execute(sql`DELETE FROM audit_event WHERE id = ${auditId}`),
    ).rejects.toSatisfy((error: unknown) => pgErrorCode(error) === '42501');
  });
});
