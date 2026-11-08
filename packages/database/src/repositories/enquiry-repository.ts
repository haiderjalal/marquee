import { and, desc, eq, sql } from 'drizzle-orm';

import type { Database, Transaction } from '../client';
import { enquiries, venues } from '../schema';

/**
 * Enquiry persistence. Status changes carry the expected revision so a stale
 * update is refused instead of silently overwriting a colleague's change.
 */

/** Values for a new enquiry. Contact details are stored only with consent. */
export interface NewEnquiry {
  readonly id: string;
  readonly tenantId: string;
  readonly venueId: string;
  readonly reference: string;
  readonly fullName: string;
  readonly mobileE164: string;
  readonly email: string | null;
  readonly eventType: 'walima' | 'barat' | 'nikah' | 'mehndi' | 'valima' | 'corporate' | 'other';
  readonly preferredDate: string;
  readonly guestsExpected: number;
  readonly message: string | null;
  readonly source: 'website' | 'walk_in' | 'phone' | 'referral' | 'demo';
}

/** Staff view row joined with the venue name. */
export interface EnquiryListRow {
  readonly id: string;
  readonly reference: string;
  readonly status: string;
  readonly venueName: string;
  readonly fullName: string;
  readonly mobileE164: string;
  readonly eventType: string;
  readonly preferredDate: string;
  readonly guestsExpected: number;
  readonly source: string;
  readonly createdAt: Date;
  readonly revision: number;
}

/**
 * Inserts an enquiry inside the caller's transaction.
 * @param transaction Open transaction.
 * @param enquiry Enquiry values.
 */
export async function insertEnquiry(transaction: Transaction, enquiry: NewEnquiry): Promise<void> {
  await transaction.insert(enquiries).values({
    id: enquiry.id,
    tenantId: enquiry.tenantId,
    venueId: enquiry.venueId,
    reference: enquiry.reference,
    fullName: enquiry.fullName,
    mobileE164: enquiry.mobileE164,
    email: enquiry.email,
    eventType: enquiry.eventType,
    preferredDate: enquiry.preferredDate,
    guestsExpected: enquiry.guestsExpected,
    message: enquiry.message,
    source: enquiry.source,
    status: 'new',
    consentToContact: true,
    revision: 1,
  });
}

/**
 * Lists a tenant's enquiries, newest first, optionally filtered by status.
 * @param db Database handle.
 * @param tenantId Tenant scope; required.
 * @param limit Maximum rows.
 * @returns Enquiry rows for staff.
 */
export async function listEnquiries(
  db: Database,
  tenantId: string,
  limit: number,
): Promise<EnquiryListRow[]> {
  const rows = await db
    .select({
      id: enquiries.id,
      reference: enquiries.reference,
      status: enquiries.status,
      venueName: venues.name,
      fullName: enquiries.fullName,
      mobileE164: enquiries.mobileE164,
      eventType: enquiries.eventType,
      preferredDate: enquiries.preferredDate,
      guestsExpected: enquiries.guestsExpected,
      source: enquiries.source,
      createdAt: enquiries.createdAt,
      revision: enquiries.revision,
    })
    .from(enquiries)
    .innerJoin(
      venues,
      and(eq(venues.id, enquiries.venueId), eq(venues.tenantId, enquiries.tenantId)),
    )
    .where(eq(enquiries.tenantId, tenantId))
    .orderBy(desc(enquiries.createdAt))
    .limit(limit);
  return rows;
}

/**
 * Reads one enquiry inside a tenant scope.
 * @param executor Database or transaction handle.
 * @param tenantId Tenant scope.
 * @param enquiryId Enquiry identifier.
 * @returns The row's status and revision, or null when it is not in this tenant.
 */
export async function findEnquiryStatus(
  executor: Database | Transaction,
  tenantId: string,
  enquiryId: string,
): Promise<{ status: string; revision: number } | null> {
  const [row] = await executor
    .select({ status: enquiries.status, revision: enquiries.revision })
    .from(enquiries)
    .where(and(eq(enquiries.tenantId, tenantId), eq(enquiries.id, enquiryId)))
    .limit(1);
  return row ?? null;
}

/**
 * Moves an enquiry to a new status only if its revision still matches.
 * @param transaction Open transaction.
 * @param input Tenant, enquiry, expected revision and new status.
 * @returns The new revision, or null when the revision no longer matches.
 */
export async function updateEnquiryStatus(
  transaction: Transaction,
  input: {
    readonly tenantId: string;
    readonly enquiryId: string;
    readonly expectedRevision: number;
    readonly nextStatus: string;
  },
): Promise<number | null> {
  const rows = await transaction.execute<{ revision: number }>(sql`
    UPDATE enquiry
    SET status = ${input.nextStatus},
        revision = revision + 1,
        updated_at = now()
    WHERE tenant_id = ${input.tenantId}
      AND id = ${input.enquiryId}
      AND revision = ${input.expectedRevision}
    RETURNING revision`);
  return rows.rows[0]?.revision ?? null;
}
