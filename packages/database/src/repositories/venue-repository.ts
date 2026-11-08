import { and, asc, eq, inArray } from 'drizzle-orm';

import type { Database } from '../client';
import { catalogueItems, shellVersions, spaces, venuePolicies, venues } from '../schema';

/**
 * Reads published venues and their approved configuration. Every query is scoped to
 * published rows, so draft or withdrawn data cannot reach a public response.
 */

/** Venue row as stored. */
export interface VenueRecord {
  readonly id: string;
  readonly tenantId: string;
  readonly slug: string;
  readonly name: string;
  readonly tagline: string;
  readonly indoor: boolean;
  readonly publishedCapacityGuests: number;
  readonly facilities: readonly string[];
}

/** Bookable space as stored. */
export interface SpaceRecord {
  readonly id: string;
  readonly tenantId: string;
  readonly venueId: string;
  readonly name: string;
  readonly rentMinor: bigint;
  readonly shellVersionId: string;
  readonly publishedCapacityGuests: number;
}

/** Commercial policy row for one venue. */
export interface PolicyRecord {
  readonly minBillableGuests: number | null;
  readonly rentWaiverFoodThresholdMinor: bigint | null;
  readonly minimumSpendMinor: bigint | null;
  readonly advanceBasisPoints: number;
  readonly partialTablesAllowed: boolean;
}

/** Approved shell version. The payload is validated by the caller before use. */
export interface ShellRecord {
  readonly id: string;
  readonly tenantId: string;
  readonly venueId: string;
  readonly label: string;
  readonly payload: unknown;
  readonly contentHash: string;
}

/** Published catalogue item. The payload is validated by the caller before use. */
export interface CatalogueRecord {
  readonly id: string;
  readonly kind: 'menu_package' | 'stage' | 'extra';
  readonly code: string;
  readonly name: string;
  readonly unitPriceMinor: bigint;
  readonly payload: unknown;
  readonly demo: boolean;
  readonly version: number;
}

/** Everything a public venue page or configurator needs, in one consistent read. */
export interface VenueAggregate {
  readonly venue: VenueRecord;
  readonly policy: PolicyRecord;
  readonly spaces: readonly SpaceRecord[];
  readonly shells: readonly ShellRecord[];
  readonly catalogue: readonly CatalogueRecord[];
}

/**
 * Lists published venues with their spaces, ordered by name.
 * @param db Database handle.
 * @returns Venue rows with spaces.
 */
export async function listPublishedVenues(
  db: Database,
): Promise<Array<{ venue: VenueRecord; spaces: SpaceRecord[] }>> {
  const venueRows = await db
    .select()
    .from(venues)
    .where(eq(venues.publicationStatus, 'published'))
    .orderBy(asc(venues.name));
  if (venueRows.length === 0) {
    return [];
  }
  const spaceRows = await db
    .select()
    .from(spaces)
    .where(
      inArray(
        spaces.venueId,
        venueRows.map((row) => row.id),
      ),
    )
    .orderBy(asc(spaces.name));
  return venueRows.map((row) => ({
    venue: toVenueRecord(row),
    spaces: spaceRows.filter((space) => space.venueId === row.id).map(toSpaceRecord),
  }));
}

/**
 * Loads one published venue by its public slug with its policy, spaces, shells and catalogue.
 * @param db Database handle.
 * @param slug Public venue slug.
 * @returns The aggregate, or null when no published venue has that slug.
 */
export async function findPublishedVenueBySlug(
  db: Database,
  slug: string,
): Promise<VenueAggregate | null> {
  const [venueRow] = await db
    .select()
    .from(venues)
    .where(and(eq(venues.slug, slug), eq(venues.publicationStatus, 'published')))
    .limit(1);
  if (!venueRow) {
    return null;
  }
  const [policyRow] = await db
    .select()
    .from(venuePolicies)
    .where(eq(venuePolicies.venueId, venueRow.id))
    .limit(1);
  if (!policyRow) {
    throw new Error(`Published venue ${slug} has no commercial policy row.`);
  }
  const spaceRows = await db
    .select()
    .from(spaces)
    .where(eq(spaces.venueId, venueRow.id))
    .orderBy(asc(spaces.name));
  const shellRows = await db
    .select()
    .from(shellVersions)
    .where(eq(shellVersions.venueId, venueRow.id));
  const catalogueRows = await db
    .select()
    .from(catalogueItems)
    .where(
      and(
        eq(catalogueItems.venueId, venueRow.id),
        eq(catalogueItems.publicationStatus, 'published'),
      ),
    )
    .orderBy(asc(catalogueItems.kind), asc(catalogueItems.code));

  return {
    venue: toVenueRecord(venueRow),
    policy: {
      minBillableGuests: policyRow.minBillableGuests,
      rentWaiverFoodThresholdMinor: policyRow.rentWaiverFoodThresholdMinor,
      minimumSpendMinor: policyRow.minimumSpendMinor,
      advanceBasisPoints: policyRow.advanceBasisPoints,
      partialTablesAllowed: policyRow.partialTablesAllowed,
    },
    spaces: spaceRows.map(toSpaceRecord),
    shells: shellRows.map((row) => ({
      id: row.id,
      tenantId: row.tenantId,
      venueId: row.venueId,
      label: row.label,
      payload: row.payload,
      contentHash: row.contentHash,
    })),
    catalogue: catalogueRows.map((row) => ({
      id: row.id,
      kind: row.kind,
      code: row.code,
      name: row.name,
      unitPriceMinor: row.unitPriceMinor,
      payload: row.payload,
      demo: row.demo,
      version: row.version,
    })),
  };
}

/**
 * Finds one space inside a tenant. Used by write paths that must verify ownership before locking.
 * @param db Database handle.
 * @param tenantId Tenant scope.
 * @param spaceId Space identifier.
 * @returns The space, or null when it does not belong to this tenant.
 */
export async function findSpaceInTenant(
  db: Database,
  tenantId: string,
  spaceId: string,
): Promise<SpaceRecord | null> {
  const [row] = await db
    .select()
    .from(spaces)
    .where(and(eq(spaces.tenantId, tenantId), eq(spaces.id, spaceId)))
    .limit(1);
  return row ? toSpaceRecord(row) : null;
}

/**
 * Maps a venue row to its record shape.
 * @param row Drizzle venue row.
 * @returns Venue record.
 */
function toVenueRecord(row: typeof venues.$inferSelect): VenueRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    slug: row.slug,
    name: row.name,
    tagline: row.tagline,
    indoor: row.indoor,
    publishedCapacityGuests: row.publishedCapacityGuests,
    facilities: row.facilities,
  };
}

/**
 * Maps a space row to its record shape.
 * @param row Drizzle space row.
 * @returns Space record.
 */
function toSpaceRecord(row: typeof spaces.$inferSelect): SpaceRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    venueId: row.venueId,
    name: row.name,
    rentMinor: row.rentMinor,
    shellVersionId: row.shellVersionId,
    publishedCapacityGuests: row.publishedCapacityGuests,
  };
}
