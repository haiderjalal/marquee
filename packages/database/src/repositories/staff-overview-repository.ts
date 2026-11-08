import { sql } from 'drizzle-orm';

import type { Database } from '../client';

/**
 * Read models for the staff overview. These are reviewed queries that join data for
 * display; they never write, and every query is tenant-scoped.
 */

/** A hold as shown on the schedule. */
export interface ScheduleHoldRow {
  readonly holdId: string;
  readonly status: 'held' | 'confirmed' | 'released' | 'expired';
  readonly spaceId: string;
  readonly spaceName: string;
  readonly venueName: string;
  readonly occupiedFrom: Date;
  readonly occupiedUntil: Date;
  readonly expiresAt: Date;
  readonly enquiryFullName: string | null;
}

/**
 * Counts enquiries for a tenant grouped by status.
 * @param db Database handle.
 * @param tenantId Tenant scope.
 * @returns Map from status to count.
 */
export async function countEnquiriesByStatus(
  db: Database,
  tenantId: string,
): Promise<Map<string, number>> {
  const result = await db.execute<{ status: string; total: number }>(sql`
    SELECT status, count(*)::int AS total
    FROM enquiry
    WHERE tenant_id = ${tenantId}
    GROUP BY status`);
  return new Map(result.rows.map((row) => [row.status, row.total]));
}

/**
 * Lists holds whose occupation overlaps a window, with space, venue and enquiry names.
 * @param db Database handle.
 * @param input Tenant and UTC window.
 * @returns Schedule rows ordered by start time.
 */
export async function listHoldsInWindow(
  db: Database,
  input: { readonly tenantId: string; readonly fromIso: string; readonly toIso: string },
): Promise<ScheduleHoldRow[]> {
  const result = await db.execute<{
    hold_id: string;
    status: ScheduleHoldRow['status'];
    space_id: string;
    space_name: string;
    venue_name: string;
    occupied_from: Date;
    occupied_until: Date;
    expires_at: Date;
    enquiry_full_name: string | null;
  }>(sql`
    SELECT h.id AS hold_id,
           h.status,
           s.id AS space_id,
           s.name AS space_name,
           v.name AS venue_name,
           lower(h.occupied_at) AS occupied_from,
           upper(h.occupied_at) AS occupied_until,
           h.expires_at,
           e.full_name AS enquiry_full_name
    FROM hold h
    JOIN space s ON s.tenant_id = h.tenant_id AND s.id = h.space_id
    JOIN venue v ON v.tenant_id = s.tenant_id AND v.id = s.venue_id
    LEFT JOIN enquiry e ON e.tenant_id = h.tenant_id AND e.id = h.enquiry_id
    WHERE h.tenant_id = ${input.tenantId}
      AND h.status IN ('held', 'confirmed')
      AND h.occupied_at && tstzrange(${input.fromIso}::timestamptz, ${input.toIso}::timestamptz, '[)')
    ORDER BY lower(h.occupied_at)`);
  return result.rows.map((row) => ({
    holdId: row.hold_id,
    status: row.status,
    spaceId: row.space_id,
    spaceName: row.space_name,
    venueName: row.venue_name,
    occupiedFrom: new Date(row.occupied_from),
    occupiedUntil: new Date(row.occupied_until),
    expiresAt: new Date(row.expires_at),
    enquiryFullName: row.enquiry_full_name,
  }));
}

/**
 * Counts provisional holds that will expire before a cut-off, using the database clock.
 * @param db Database handle.
 * @param input Tenant and cut-off instant.
 * @returns Number of holds still in the held state that expire before the cut-off.
 */
export async function countHoldsExpiringBefore(
  db: Database,
  input: { readonly tenantId: string; readonly untilIso: string },
): Promise<number> {
  const result = await db.execute<{ total: number }>(sql`
    SELECT count(*)::int AS total
    FROM hold
    WHERE tenant_id = ${input.tenantId}
      AND status = 'held'
      AND expires_at > now()
      AND expires_at <= ${input.untilIso}::timestamptz`);
  return result.rows[0]?.total ?? 0;
}
