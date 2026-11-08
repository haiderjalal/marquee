import { and, eq } from 'drizzle-orm';

import type { Database } from '../client';
import { appUsers, memberships, tenants } from '../schema';

/**
 * Tenancy lookups. Authorisation decisions depend only on rows returned here: a
 * tenant is accessible only through an active membership row.
 */

/** A user's active access to one tenant. */
export interface MembershipRecord {
  readonly userId: string;
  readonly userDisplayName: string;
  readonly tenantId: string;
  readonly tenantSlug: string;
  readonly tenantName: string;
  readonly role: 'owner' | 'manager' | 'sales' | 'coordinator' | 'accounts' | 'viewer';
}

/**
 * Lists every active membership of a user, ordered by tenant name.
 * @param db Database handle.
 * @param userId Authenticated user identifier.
 * @returns Active memberships; empty when the user belongs to no tenant.
 */
export async function findActiveMembershipsForUser(
  db: Database,
  userId: string,
): Promise<MembershipRecord[]> {
  const rows = await db
    .select({
      userId: appUsers.id,
      userDisplayName: appUsers.displayName,
      tenantId: tenants.id,
      tenantSlug: tenants.slug,
      tenantName: tenants.name,
      role: memberships.role,
    })
    .from(memberships)
    .innerJoin(appUsers, eq(appUsers.id, memberships.userId))
    .innerJoin(tenants, eq(tenants.id, memberships.tenantId))
    .where(and(eq(memberships.userId, userId), eq(memberships.status, 'active')))
    .orderBy(tenants.name);
  return rows;
}

/**
 * Finds the active membership for one user in one tenant.
 * @param db Database handle.
 * @param userId Authenticated user identifier.
 * @param tenantId Requested tenant; treated as a selector, verified by this lookup.
 * @returns The membership, or null when the user has no active access to that tenant.
 */
export async function findActiveMembership(
  db: Database,
  userId: string,
  tenantId: string,
): Promise<MembershipRecord | null> {
  const [row] = await db
    .select({
      userId: appUsers.id,
      userDisplayName: appUsers.displayName,
      tenantId: tenants.id,
      tenantSlug: tenants.slug,
      tenantName: tenants.name,
      role: memberships.role,
    })
    .from(memberships)
    .innerJoin(appUsers, eq(appUsers.id, memberships.userId))
    .innerJoin(tenants, eq(tenants.id, memberships.tenantId))
    .where(
      and(
        eq(memberships.userId, userId),
        eq(memberships.tenantId, tenantId),
        eq(memberships.status, 'active'),
      ),
    )
    .limit(1);
  return row ?? null;
}
