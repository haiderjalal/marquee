import { createHash } from 'node:crypto';

import { createInterval, occupationWindow, pkrRupees } from '@marquee/domain';
import { MARQUEE_A_SHELL_V2, MARQUEE_B_SHELL_V1, type VenueShell } from '@marquee/spatial';
import { sql } from 'drizzle-orm';

import type { Database, Transaction } from './client';
import {
  appUsers,
  atomicResources,
  catalogueItems,
  enquiries,
  memberships,
  shellVersions,
  spaceResources,
  spaces,
  tenants,
  venuePhotos,
  venuePolicies,
  venues,
} from './schema';

/**
 * DEMONSTRATION DATA ONLY. Every name, phone number, price and measurement here is
 * fictional or illustrative and is labelled as demo. Nothing in this seed may be
 * presented as a real venue, a real customer or a verified rate.
 *
 * The seed is idempotent: rerunning it inserts nothing new. Identifiers are derived
 * from fixed labels so the same demo entity always has the same id.
 */

/** Owner account used by the development sign-in. Matches DEV_STAFF_USER_ID in .env.example. */
export const DEMO_OWNER_USER_ID = '00000000-0000-4000-8000-000000000001';

/** Stable demo tenant identifier. */
export const DEMO_TENANT_ID = stableUuid('tenant:demo-halls');

/** Stable identifiers for demo entities, exported so tests can refer to them. */
export const DEMO_IDS = {
  salesUser: stableUuid('user:sales'),
  venueA: stableUuid('venue:marquee-a'),
  venueB: stableUuid('venue:marquee-b'),
  spaceA: stableUuid('space:marquee-a'),
  spaceB: stableUuid('space:marquee-b'),
  hallA: stableUuid('resource:hall-a'),
  hallB: stableUuid('resource:hall-b'),
  photoA: stableUuid('photo:marquee-a'),
  photoB: stableUuid('photo:marquee-b'),
} as const;

/**
 * Photographs uploaded to the public `marquee-photos` bucket for the demonstration venues.
 * They are seeded as pending, so they stay hidden until a staff member approves them.
 */
export const DEMO_VENUE_PHOTOS = [
  {
    id: DEMO_IDS.photoA,
    venueId: DEMO_IDS.venueA,
    url: 'https://jqpfjbeguirjmwdebojp.supabase.co/storage/v1/object/public/marquee-photos/A.jpg',
    alt: 'Marquee A hall (demonstration photograph)',
  },
  {
    id: DEMO_IDS.photoB,
    venueId: DEMO_IDS.venueB,
    url: 'https://jqpfjbeguirjmwdebojp.supabase.co/storage/v1/object/public/marquee-photos/B.jpg',
    alt: 'Marquee B hall (demonstration photograph)',
  },
] as const;

/** Demo enquiry labels and their stable references. */
const DEMO_ENQUIRIES = [
  {
    ref: 'ENQ-DEMO0001',
    name: 'Amina Example',
    mobile: '+923000000001',
    event: 'walima',
    date: '2026-12-14',
    guests: 500,
  },
  {
    ref: 'ENQ-DEMO0002',
    name: 'Hira Example',
    mobile: '+923000000002',
    event: 'mehndi',
    date: '2026-12-15',
    guests: 200,
  },
  {
    ref: 'ENQ-DEMO0003',
    name: 'Zara Example',
    mobile: '+923000000003',
    event: 'barat',
    date: '2026-12-19',
    guests: 300,
  },
  {
    ref: 'ENQ-DEMO0004',
    name: 'Bilal Example',
    mobile: '+923000000004',
    event: 'corporate',
    date: '2026-12-20',
    guests: 150,
  },
] as const;

/**
 * Inserts the demo tenant, venues, shells, catalogue, enquiries and holds.
 * @param db Database handle. Migrations must already be applied.
 */
export async function seedDemoData(db: Database): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .insert(tenants)
      .values({ id: DEMO_TENANT_ID, slug: 'demo-halls', name: 'Demo Wedding Halls (fictional)' })
      .onConflictDoNothing();

    await tx
      .insert(appUsers)
      .values([
        { id: DEMO_OWNER_USER_ID, email: 'owner@demo.invalid', displayName: 'Demo Owner' },
        { id: DEMO_IDS.salesUser, email: 'sales@demo.invalid', displayName: 'Demo Sales' },
      ])
      .onConflictDoNothing();

    await tx
      .insert(memberships)
      .values([
        {
          id: stableUuid('membership:owner'),
          tenantId: DEMO_TENANT_ID,
          userId: DEMO_OWNER_USER_ID,
          role: 'owner',
          status: 'active',
        },
        {
          id: stableUuid('membership:sales'),
          tenantId: DEMO_TENANT_ID,
          userId: DEMO_IDS.salesUser,
          role: 'sales',
          status: 'active',
        },
      ])
      .onConflictDoNothing();

    await seedVenue(tx, {
      venueId: DEMO_IDS.venueA,
      slug: 'marquee-a',
      name: 'Marquee A',
      tagline: 'Luxury marquee with draped ceilings and a grand stage.',
      indoor: true,
      publishedCapacityGuests: 700,
      facilities: ['Indoor', 'Bridal suite'],
      spaceId: DEMO_IDS.spaceA,
      spaceName: 'Marquee A',
      rentMinor: pkrRupeesMinor(100_000),
      shell: MARQUEE_A_SHELL_V2,
      hallId: DEMO_IDS.hallA,
      hallLabel: 'Marquee A hall',
    });
    await seedVenue(tx, {
      venueId: DEMO_IDS.venueB,
      slug: 'marquee-b',
      name: 'Marquee B',
      tagline: 'Indoor and lawn event space with private parking.',
      indoor: true,
      publishedCapacityGuests: 1000,
      facilities: ['Indoor and lawn', 'Private parking'],
      spaceId: DEMO_IDS.spaceB,
      spaceName: 'Marquee B',
      rentMinor: pkrRupeesMinor(150_000),
      shell: MARQUEE_B_SHELL_V1,
      hallId: DEMO_IDS.hallB,
      hallLabel: 'Marquee B hall',
    });

    await tx
      .insert(venuePhotos)
      .values(
        DEMO_VENUE_PHOTOS.map((photo) => ({
          ...photo,
          tenantId: DEMO_TENANT_ID,
          status: 'pending' as const,
        })),
      )
      .onConflictDoNothing();

    await tx
      .insert(enquiries)
      .values(
        DEMO_ENQUIRIES.map((entry) => ({
          id: stableUuid(`enquiry:${entry.ref}`),
          tenantId: DEMO_TENANT_ID,
          venueId: DEMO_IDS.venueA,
          reference: entry.ref,
          fullName: entry.name,
          mobileE164: entry.mobile,
          email: null,
          eventType: entry.event,
          preferredDate: entry.date,
          guestsExpected: entry.guests,
          message: 'Demo enquiry (fictional).',
          source: 'demo' as const,
          status: 'new' as const,
          consentToContact: true,
          revision: 1,
        })),
      )
      .onConflictDoNothing();

    await seedDemoHolds(tx);
  });
}

/**
 * Converts whole rupees to minor units for demo prices.
 * @param rupees Whole rupees.
 * @returns Integer paisa.
 */
function pkrRupeesMinor(rupees: number): bigint {
  return pkrRupees(rupees).amountMinor;
}

/** Parameters describing one demo venue and its single space. */
interface DemoVenueSeed {
  readonly venueId: string;
  readonly slug: string;
  readonly name: string;
  readonly tagline: string;
  readonly indoor: boolean;
  readonly publishedCapacityGuests: number;
  readonly facilities: readonly string[];
  readonly spaceId: string;
  readonly spaceName: string;
  readonly rentMinor: bigint;
  readonly shell: VenueShell;
  readonly hallId: string;
  readonly hallLabel: string;
}

/**
 * Seeds one venue with its policy, shell, space, resource, catalogue and demo menu/stage/extras.
 * @param tx Open transaction.
 * @param venue Venue description.
 */
async function seedVenue(tx: Transaction, venue: DemoVenueSeed): Promise<void> {
  await tx
    .insert(venues)
    .values({
      id: venue.venueId,
      tenantId: DEMO_TENANT_ID,
      slug: venue.slug,
      name: venue.name,
      tagline: venue.tagline,
      indoor: venue.indoor,
      publishedCapacityGuests: venue.publishedCapacityGuests,
      timezone: 'Asia/Karachi',
      facilities: [...venue.facilities],
      publicationStatus: 'published',
    })
    .onConflictDoNothing();

  await tx
    .insert(venuePolicies)
    .values({
      tenantId: DEMO_TENANT_ID,
      venueId: venue.venueId,
      minBillableGuests: null,
      rentWaiverFoodThresholdMinor: null,
      minimumSpendMinor: null,
      advanceBasisPoints: 2_500,
      partialTablesAllowed: true,
    })
    .onConflictDoNothing();

  const shellId = venue.shell.shellVersionId;
  await tx
    .insert(shellVersions)
    .values({
      id: shellId,
      tenantId: DEMO_TENANT_ID,
      venueId: venue.venueId,
      label: venue.shell.label,
      payload: venue.shell,
      contentHash: createHash('sha256').update(canonicalJson(venue.shell)).digest('hex'),
    })
    .onConflictDoNothing();

  await tx
    .insert(atomicResources)
    .values({
      id: venue.hallId,
      tenantId: DEMO_TENANT_ID,
      venueId: venue.venueId,
      label: venue.hallLabel,
      kind: 'hall',
    })
    .onConflictDoNothing();

  await tx
    .insert(spaces)
    .values({
      id: venue.spaceId,
      tenantId: DEMO_TENANT_ID,
      venueId: venue.venueId,
      name: venue.spaceName,
      rentMinor: venue.rentMinor,
      shellVersionId: shellId,
      publishedCapacityGuests: venue.publishedCapacityGuests,
    })
    .onConflictDoNothing();

  await tx
    .insert(spaceResources)
    .values({ tenantId: DEMO_TENANT_ID, spaceId: venue.spaceId, resourceId: venue.hallId })
    .onConflictDoNothing();

  await tx.insert(catalogueItems).values(demoCatalogue(venue.venueId)).onConflictDoNothing();
}

/**
 * Demo catalogue for one venue: menu packages, stage presets and extras. Prices are
 * DEMONSTRATION values; the venue owner supplies the approved prices before any use.
 * @param venueId Venue owning the catalogue.
 * @returns Catalogue rows ready to insert.
 */
function demoCatalogue(venueId: string) {
  const row = (
    kind: 'menu_package' | 'stage' | 'extra',
    code: string,
    name: string,
    priceRupees: number,
    payload: Record<string, unknown>,
  ) => ({
    id: stableUuid(`catalogue:${venueId}:${kind}:${code}:1`),
    tenantId: DEMO_TENANT_ID,
    venueId,
    kind,
    code,
    name,
    unitPriceMinor: pkrRupeesMinor(priceRupees),
    payload,
    demo: true,
    publicationStatus: 'published' as const,
    version: 1,
  });
  return [
    row('menu_package', 'classic-800', 'Classic', 800, {
      demo: true,
      description: 'Demonstration package. Contents to be confirmed by the venue.',
      includes: ['Biryani rice', 'Chicken qorma', 'Naan and drinks'],
    }),
    row('menu_package', 'signature-1100', 'Signature', 1_100, {
      demo: true,
      description: 'Demonstration package. Contents to be confirmed by the venue.',
      includes: [
        'Chicken qorma',
        'Biryani rice',
        'Grilled kebab',
        'Fresh salad',
        'Naan and drinks',
        'Traditional dessert',
      ],
    }),
    row('menu_package', 'celebration-1500', 'Celebration', 1_500, {
      demo: true,
      description: 'Demonstration package. Contents to be confirmed by the venue.',
      includes: [
        'Chicken qorma',
        'Biryani rice',
        'Grilled kebab platter',
        'Fresh salad',
        'Naan and drinks',
        'Dessert platter',
      ],
    }),
    row('stage', 'classic-ivory', 'Classic Ivory', 50_000, {
      demo: true,
      widthMm: 7_000,
      depthMm: 3_500,
      heightMm: 3_000,
      collection: 'Classic Ivory',
    }),
    row('stage', 'floral-garden', 'Floral Garden', 60_000, {
      demo: true,
      widthMm: 8_000,
      depthMm: 4_000,
      heightMm: 3_500,
      collection: 'Floral Garden',
    }),
    row('stage', 'royal-mehndi', 'Royal Mehndi', 75_000, {
      demo: true,
      widthMm: 7_500,
      depthMm: 3_500,
      heightMm: 3_200,
      collection: 'Royal Mehndi',
    }),
    row('stage', 'grand-stage', 'Grand Stage', 90_000, {
      demo: true,
      widthMm: 12_000,
      depthMm: 4_000,
      heightMm: 4_000,
      collection: 'Grand Stage',
    }),
    row('extra', 'ac-service', 'AC service', 25_000, { demo: true, unit: 'per event' }),
    row('extra', 'generator-backup', 'Generator backup', 15_000, { demo: true, unit: 'per event' }),
    row('extra', 'bridal-room', 'Bridal room', 10_000, { demo: true, unit: 'per event' }),
  ];
}

/**
 * Seeds two demonstration holds: one confirmed wedding and one provisional hold.
 * Claims use the same occupation window as their hold, with setup and teardown included.
 * @param tx Open transaction.
 */
async function seedDemoHolds(tx: Transaction): Promise<void> {
  const confirmed = occupationWindow(
    createInterval(Date.parse('2026-12-14T11:00:00Z'), Date.parse('2026-12-14T18:00:00Z')),
    4 * 60 * 60_000,
    60 * 60_000,
  );
  const provisional = occupationWindow(
    createInterval(Date.parse('2026-12-15T12:00:00Z'), Date.parse('2026-12-15T17:00:00Z')),
    2 * 60 * 60_000,
    60 * 60_000,
  );

  await insertDemoHold(tx, {
    holdId: stableUuid('hold:amina-walima'),
    spaceId: DEMO_IDS.spaceA,
    resourceId: DEMO_IDS.hallA,
    status: 'confirmed',
    window: confirmed,
    expiresAtIso: null,
    claimStatus: 'confirmed',
    enquiryRef: 'ENQ-DEMO0001',
  });
  await insertDemoHold(tx, {
    holdId: stableUuid('hold:hira-mehndi'),
    spaceId: DEMO_IDS.spaceB,
    resourceId: DEMO_IDS.hallB,
    status: 'held',
    window: provisional,
    expiresAtIso: '2026-12-01T00:00:00Z',
    claimStatus: 'held',
    enquiryRef: 'ENQ-DEMO0002',
  });
}

/** Parameters for one demo hold and its claim. */
interface DemoHoldSeed {
  readonly holdId: string;
  readonly spaceId: string;
  readonly resourceId: string;
  readonly status: 'held' | 'confirmed';
  readonly window: { readonly startMs: number; readonly endMs: number };
  /** Null for confirmed holds (they do not expire). */
  readonly expiresAtIso: string | null;
  readonly claimStatus: 'held' | 'confirmed';
  readonly enquiryRef: string;
}

/**
 * Inserts one demo hold, its claim and the enquiry link, idempotently.
 * @param tx Open transaction.
 * @param hold Demo hold description.
 */
async function insertDemoHold(tx: Transaction, hold: DemoHoldSeed): Promise<void> {
  const start = new Date(hold.window.startMs).toISOString();
  const end = new Date(hold.window.endMs).toISOString();
  const enquiryId = stableUuid(`enquiry:${hold.enquiryRef}`);
  const expiresAt = hold.expiresAtIso ?? '2999-01-01T00:00:00Z';

  await tx.execute(sql`
    INSERT INTO hold (id, tenant_id, space_id, enquiry_id, status, occupied_at, expires_at, created_by, revision)
    VALUES (
      ${hold.holdId}, ${DEMO_TENANT_ID}, ${hold.spaceId}, ${enquiryId}, ${hold.status},
      tstzrange(${start}::timestamptz, ${end}::timestamptz, '[)'),
      ${expiresAt}::timestamptz, ${DEMO_OWNER_USER_ID}, 1
    )
    ON CONFLICT (id) DO NOTHING`);
  await tx.execute(sql`
    INSERT INTO resource_claim (id, tenant_id, resource_id, hold_id, occupied_at, claim_state, expires_at)
    VALUES (
      ${stableUuid(`claim:${hold.holdId}`)}, ${DEMO_TENANT_ID}, ${hold.resourceId}, ${hold.holdId},
      tstzrange(${start}::timestamptz, ${end}::timestamptz, '[)'),
      ${hold.claimStatus}, ${hold.claimStatus === 'held' ? expiresAt : null}::timestamptz
    )
    ON CONFLICT (id) DO NOTHING`);
}

/**
 * Derives a stable RFC 4122 version-4 style UUID from a label. Used for demo identifiers
 * only; production identifiers are random.
 * @param label Stable label naming the entity.
 * @returns Lowercase UUID string.
 */
export function stableUuid(label: string): string {
  const bytes = createHash('sha256').update(`marquee-demo:${label}`).digest().subarray(0, 16);
  const buffer = Buffer.from(bytes);
  buffer[6] = ((buffer[6] ?? 0) & 0x0f) | 0x40;
  buffer[8] = ((buffer[8] ?? 0) & 0x3f) | 0x80;
  const hex = buffer.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/**
 * Serialises a value with sorted object keys so hashes do not depend on property order.
 * @param value JSON-compatible value.
 * @returns Canonical JSON text.
 */
function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, nested: unknown) => {
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      return Object.fromEntries(Object.entries(nested).sort(([a], [b]) => a.localeCompare(b)));
    }
    return nested;
  });
}
