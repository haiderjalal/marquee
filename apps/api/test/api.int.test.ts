import { randomUUID } from 'node:crypto';

import { createLogger } from '@marquee/observability';
import {
  appUsers,
  DEMO_IDS,
  DEMO_OWNER_USER_ID,
  DEMO_TENANT_ID,
  type DatabaseClient,
  memberships,
  seedDemoData,
} from '@marquee/database';
import { startTestDatabase, type TestDatabase } from '@marquee/database/test-harness';
import { type INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { type AppConfig } from '../src/config/env';
import { createApp } from '../src/create-app';

/**
 * End-to-end HTTP tests against a real PostgreSQL 17 cluster. They exercise the same
 * pipeline the browser uses: validation, authorisation, transactions and error mapping.
 */

/** Configuration for the test application instance. */
const TEST_CONFIG: AppConfig = {
  nodeEnv: 'test',
  port: 0,
  databaseUrl: 'postgres://unused',
  corsOrigins: ['http://localhost:3000'],
  authMode: 'dev',
  logLevel: 'error',
};

/** Header set for the seeded owner. */
const OWNER = { 'x-dev-user-id': DEMO_OWNER_USER_ID };
/** Header set for the seeded sales user. */
const SALES = { 'x-dev-user-id': DEMO_IDS.salesUser };
/** Header set for a viewer created by these tests. */
const viewerUserId = randomUUID();

/** JSON envelope returned by the API. */
interface Envelope<T> {
  readonly data?: T;
  readonly error?: { code: string; message: string; correlationId: string };
}

describe('API over HTTP (real PostgreSQL)', () => {
  let database: TestDatabase;
  let client: DatabaseClient;
  let app: INestApplication;
  let base: string;

  beforeAll(async () => {
    database = await startTestDatabase();
    client = database.open(10);
    await seedDemoData(client.db);
    await client.db.insert(appUsers).values({
      id: viewerUserId,
      email: `viewer-${viewerUserId.slice(0, 8)}@demo.invalid`,
      displayName: 'Demo Viewer',
    });
    await client.db.insert(memberships).values({
      id: randomUUID(),
      tenantId: DEMO_TENANT_ID,
      userId: viewerUserId,
      role: 'viewer',
      status: 'active',
    });
    app = await createApp({
      config: TEST_CONFIG,
      database: client,
      logger: createLogger({ level: 'error', write: () => undefined }),
    });
    await app.listen(0, '127.0.0.1');
    base = `${await app.getUrl()}/api/v1`;
  }, 180_000);

  afterAll(async () => {
    await app.close();
    await client.close();
    await database.dispose();
  });

  /**
   * Sends a JSON request and returns status and parsed envelope.
   * @param method HTTP method.
   * @param path Path below the API prefix.
   * @param options Optional headers and JSON body.
   * @returns Status code and envelope.
   */
  async function call<T>(
    method: string,
    path: string,
    options: { headers?: Record<string, string>; body?: unknown } = {},
  ): Promise<{ status: number; json: Envelope<T> }> {
    const init: RequestInit = {
      method,
      headers: {
        ...(options.body === undefined ? {} : { 'content-type': 'application/json' }),
        ...options.headers,
      },
    };
    if (options.body !== undefined) {
      init.body = JSON.stringify(options.body);
    }
    const response = await fetch(`${base}${path}`, init);
    const body: unknown = await response.json();
    // Test-only assertion: each test asserts the concrete fields it depends on, so a wrong
    // shape fails there rather than here.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    return { status: response.status, json: body as Envelope<T> };
  }

  it('lists the two seeded venues with their spaces', async () => {
    const { status, json } = await call<Array<{ slug: string; spaces: unknown[] }>>(
      'GET',
      '/public/venues',
    );
    expect(status).toBe(200);
    expect(json.data?.map((venue) => venue.slug).sort()).toEqual(['marquee-a', 'marquee-b']);
    expect(json.data?.every((venue) => venue.spaces.length === 1)).toBe(true);
  });

  it('shows a venue photo only once it is approved', async () => {
    const photoOf = async (slug: string) => {
      const { status, json } = await call<
        Array<{ slug: string; photo: { url: string; alt: string } | null }>
      >('GET', '/public/venues');
      expect(status).toBe(200);
      return json.data?.find((venue) => venue.slug === slug)?.photo ?? null;
    };
    const setStatus = async (status: string) =>
      client.pool.query('UPDATE venue_photo SET status = $1 WHERE id = $2', [
        status,
        DEMO_IDS.photoA,
      ]);

    expect(await photoOf('marquee-a')).toBeNull();

    await setStatus('approved');
    try {
      const photo = await photoOf('marquee-a');
      expect(photo?.url).toContain('/marquee-photos/A.jpg');
      expect(photo?.alt).not.toBe('');
      expect(await photoOf('marquee-b')).toBeNull();
    } finally {
      await setStatus('pending');
    }
    expect(await photoOf('marquee-a')).toBeNull();
  });

  it('gives 40/200 and 100/500 chairs and refuses 700 guests with the measured maximum', async () => {
    const counts = async (requestedGuests: number) =>
      call<{
        ok: boolean;
        tableCount?: number;
        chairCount?: number;
        capacity?: { maxGuests: number };
      }>('POST', '/public/configurations/validate', {
        body: { venueSlug: 'marquee-a', requestedGuests, seatsPerTable: 5 },
      });
    const two = await counts(200);
    expect(two.json.data).toMatchObject({ ok: true, tableCount: 40, chairCount: 200 });
    const five = await counts(500);
    expect(five.json.data).toMatchObject({ ok: true, tableCount: 100, chairCount: 500 });
    const refused = await counts(700);
    expect(refused.json.data?.ok).toBe(false);
    expect(refused.json.data?.capacity?.maxGuests).toBeLessThan(700);
  });

  it('prices the worked example at PKR 735,000 and rejects a browser-supplied total', async () => {
    const quote = await call<{ total: string; advance: string; balance: string }>(
      'POST',
      '/public/quotes/preview',
      {
        body: {
          venueSlug: 'marquee-a',
          requestedGuests: 500,
          seatsPerTable: 5,
          packageId: 'signature-1100',
          stageId: 'floral-garden',
          extras: [{ code: 'ac-service', quantity: 1 }],
        },
      },
    );
    expect(quote.status).toBe(200);
    expect(quote.json.data?.total).toBe('73500000');
    expect(quote.json.data?.advance).toBe('18375000');
    expect(quote.json.data?.balance).toBe('55125000');

    const forged = await call('POST', '/public/quotes/preview', {
      body: {
        venueSlug: 'marquee-a',
        requestedGuests: 500,
        seatsPerTable: 5,
        packageId: 'signature-1100',
        stageId: null,
        extras: [],
        total: '1',
      },
    });
    expect(forged.status).toBe(400);
    expect(forged.json.error?.code).toBe('VALIDATION_FAILED');
  });

  it('records a public enquiry and keeps contact details out of its audit trail', async () => {
    const mobile = '+923111222333';
    const created = await call<{ reference: string; status: string }>('POST', '/public/enquiries', {
      body: {
        venueSlug: 'marquee-a',
        fullName: 'Audit Check',
        mobile: '0311 1222333',
        eventType: 'nikah',
        preferredDate: '2028-03-02',
        guestsExpected: 180,
        consentToContact: true,
      },
    });
    expect(created.status).toBe(201);
    expect(created.json.data?.status).toBe('new');

    const audit = await call<Array<{ action: string; summary: Record<string, unknown> }>>(
      'GET',
      '/staff/audit?limit=50',
      {
        headers: OWNER,
      },
    );
    const entry = audit.json.data?.find(
      (event) => event.summary['reference'] === created.json.data?.reference,
    );
    expect(entry?.action).toBe('enquiry.created');
    expect(JSON.stringify(audit.json.data)).not.toContain(mobile);
  });

  it('refuses staff routes without a membership and a tenant the caller does not belong to', async () => {
    const anonymous = await call('GET', '/staff/overview');
    expect(anonymous.status).toBe(401);
    const stranger = await call('GET', '/staff/overview', {
      headers: { ...OWNER, 'x-tenant-id': randomUUID() },
    });
    expect(stranger.status).toBe(403);
    expect(stranger.json.error?.code).toBe('FORBIDDEN_SCOPE');
  });

  it('places one hold, replays the same key and refuses an overlapping request', async () => {
    const body = {
      spaceId: DEMO_IDS.spaceA,
      startsAt: '2028-01-15T11:00:00Z',
      endsAt: '2028-01-15T18:00:00Z',
      setupMinutes: 120,
      teardownMinutes: 60,
      ttlMinutes: 30,
      enquiryId: null,
    };
    const key = `hold-${randomUUID()}`;
    const first = await call<{ id: string }>('POST', '/staff/holds', {
      headers: { ...SALES, 'idempotency-key': key },
      body,
    });
    expect(first.status).toBe(201);

    const replay = await call<{ id: string }>('POST', '/staff/holds', {
      headers: { ...SALES, 'idempotency-key': key },
      body,
    });
    expect(replay.json.data?.id).toBe(first.json.data?.id);

    const overlapping = await call('POST', '/staff/holds', {
      headers: { ...SALES, 'idempotency-key': `hold-${randomUUID()}` },
      body: { ...body, startsAt: '2028-01-15T13:00:00Z', endsAt: '2028-01-15T16:00:00Z' },
    });
    expect(overlapping.status).toBe(409);
    expect(overlapping.json.error?.code).toBe('SLOT_CONFLICT');
  });

  it('keeps viewers read-only and refuses a hold without an idempotency key', async () => {
    const viewer = { 'x-dev-user-id': viewerUserId };
    const denied = await call('POST', '/staff/holds', {
      headers: { ...viewer, 'idempotency-key': `hold-${randomUUID()}` },
      body: {
        spaceId: DEMO_IDS.spaceA,
        startsAt: '2028-02-01T11:00:00Z',
        endsAt: '2028-02-01T18:00:00Z',
        setupMinutes: 0,
        teardownMinutes: 0,
        ttlMinutes: 30,
        enquiryId: null,
      },
    });
    expect(denied.status).toBe(403);

    const missingKey = await call('POST', '/staff/holds', {
      headers: OWNER,
      body: {
        spaceId: DEMO_IDS.spaceA,
        startsAt: '2028-02-02T11:00:00Z',
        endsAt: '2028-02-02T18:00:00Z',
        setupMinutes: 0,
        teardownMinutes: 0,
        ttlMinutes: 30,
        enquiryId: null,
      },
    });
    expect(missingKey.status).toBe(400);
  });

  it('moves a lead only with the current revision and an allowed transition', async () => {
    const list = await call<Array<{ id: string; status: string; revision: number }>>(
      'GET',
      '/staff/enquiries?limit=20',
      {
        headers: OWNER,
      },
    );
    const lead = list.json.data?.find((row) => row.status === 'new');
    expect(lead).toBeDefined();
    if (!lead) {
      return;
    }

    const stale = await call('PATCH', `/staff/enquiries/${lead.id}/status`, {
      headers: OWNER,
      body: { status: 'contacted', expectedRevision: lead.revision + 5 },
    });
    expect(stale.json.error?.code).toBe('REVISION_CONFLICT');

    const moved = await call<{ status: string; revision: number }>(
      'PATCH',
      `/staff/enquiries/${lead.id}/status`,
      {
        headers: OWNER,
        body: { status: 'contacted', expectedRevision: lead.revision },
      },
    );
    expect(moved.json.data).toMatchObject({ status: 'contacted', revision: lead.revision + 1 });

    const backwards = await call('PATCH', `/staff/enquiries/${lead.id}/status`, {
      headers: OWNER,
      body: { status: 'new', expectedRevision: lead.revision + 1 },
    });
    expect(backwards.json.error?.code).toBe('POLICY_BLOCKED');
  });

  it('reports a stage that collides with seating and refuses to price it', async () => {
    const seating = await call<{
      ok: boolean;
      stage: { fits: boolean; conflictingPlacementIds: string[] } | null;
    }>('POST', '/public/configurations/validate', {
      body: {
        venueSlug: 'marquee-a',
        requestedGuests: 200,
        seatsPerTable: 5,
        stageId: 'grand-stage',
      },
    });
    expect(seating.json.data?.ok).toBe(true);
    expect(seating.json.data?.stage?.fits).toBe(false);
    expect(seating.json.data?.stage?.conflictingPlacementIds.length).toBeGreaterThan(0);

    const fitting = await call<{ ok: boolean; stage: { fits: boolean } | null }>(
      'POST',
      '/public/configurations/validate',
      {
        body: {
          venueSlug: 'marquee-a',
          requestedGuests: 200,
          seatsPerTable: 5,
          stageId: 'floral-garden',
        },
      },
    );
    expect(fitting.json.data?.stage?.fits).toBe(true);

    const quote = await call('POST', '/public/quotes/preview', {
      body: {
        venueSlug: 'marquee-a',
        requestedGuests: 200,
        seatsPerTable: 5,
        packageId: 'signature-1100',
        stageId: 'grand-stage',
        extras: [],
      },
    });
    expect(quote.status).toBe(409);
    expect(quote.json.error?.code).toBe('POLICY_BLOCKED');
  });
});
