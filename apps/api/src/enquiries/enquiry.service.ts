import { randomInt } from 'node:crypto';

import type {
  ChangeEnquiryStatusInput,
  CreateEnquiryInput,
  EnquiryReceiptDto,
  EnquiryStatusDto,
  StaffEnquiryDto,
} from '@marquee/contracts';
import {
  appendAuditEvent,
  type DatabaseClient,
  enqueueOutbox,
  findEnquiryStatus,
  findPublishedVenueBySlug,
  insertEnquiry,
  listEnquiries,
  pgErrorCode,
  updateEnquiryStatus,
} from '@marquee/database';
import {
  canTransitionEnquiry,
  DomainError,
  ENQUIRY_STATUSES,
  type EnquiryStatus,
} from '@marquee/domain';
import { Inject, Injectable } from '@nestjs/common';

import { DATABASE, ID_GENERATOR, type IdGenerator } from '../core/tokens';
import type { Principal } from '../auth/principal';
import { requireRole } from '../auth/principal';

/** Alphabet for human-friendly references: no 0, O, 1 or I. */
const REFERENCE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** Attempts to find an unused reference before giving up. */
const REFERENCE_ATTEMPTS = 3;

/** Roles allowed to see and move leads. */
const LEAD_ROLES = ['owner', 'manager', 'sales', 'coordinator', 'accounts', 'viewer'] as const;

/** Roles allowed to change a lead's status. */
const LEAD_EDIT_ROLES = ['owner', 'manager', 'sales', 'coordinator'] as const;

/**
 * Enquiry use cases. Each write commits the enquiry, its audit event and its outbox intent
 * in one transaction, so a lead can never exist without its record of creation.
 */
@Injectable()
export class EnquiryService {
  private readonly database: DatabaseClient;
  private readonly ids: IdGenerator;

  /**
   * @param database Database handle.
   * @param ids Identifier source.
   */
  constructor(@Inject(DATABASE) database: DatabaseClient, @Inject(ID_GENERATOR) ids: IdGenerator) {
    this.database = database;
    this.ids = ids;
  }

  /**
   * Records a public enquiry. Contact details are stored only with consent, and the audit
   * and outbox entries carry no personal data.
   * @param input Validated enquiry.
   * @param correlationId Request correlation identifier.
   * @returns The reference the visitor can quote.
   * @throws DomainError NOT_FOUND when the venue is not published.
   */
  async submit(input: CreateEnquiryInput, correlationId: string): Promise<EnquiryReceiptDto> {
    const venue = await findPublishedVenueBySlug(this.database.db, input.venueSlug);
    if (!venue) {
      throw new DomainError('NOT_FOUND', 'That venue is not published.');
    }
    const enquiryId = this.ids.next();

    for (let attempt = 1; attempt <= REFERENCE_ATTEMPTS; attempt += 1) {
      const reference = newReference();
      try {
        await this.database.db.transaction(async (transaction) => {
          await insertEnquiry(transaction, {
            id: enquiryId,
            tenantId: venue.venue.tenantId,
            venueId: venue.venue.id,
            reference,
            fullName: input.fullName,
            mobileE164: input.mobile,
            email: input.email ?? null,
            eventType: input.eventType,
            preferredDate: input.preferredDate,
            guestsExpected: input.guestsExpected,
            message: input.message ?? null,
            source: 'website',
          });
          await appendAuditEvent(transaction, {
            id: this.ids.next(),
            tenantId: venue.venue.tenantId,
            actorUserId: null,
            actorKind: 'public',
            action: 'enquiry.created',
            entityType: 'enquiry',
            entityId: enquiryId,
            correlationId,
            summary: {
              reference,
              venueSlug: venue.venue.slug,
              eventType: input.eventType,
              guestsExpected: input.guestsExpected,
              source: 'website',
            },
          });
          await enqueueOutbox(transaction, {
            id: this.ids.next(),
            tenantId: venue.venue.tenantId,
            topic: 'enquiry.created',
            dedupKey: `enquiry.created:${enquiryId}`,
            payload: { enquiryId, reference, venueId: venue.venue.id },
          });
        });
        return {
          reference,
          status: 'new',
          message:
            'Thank you. Our team will contact you on the number you provided. Your date is reserved only after confirmation.',
        };
      } catch (error) {
        if (pgErrorCode(error) === '23505' && attempt < REFERENCE_ATTEMPTS) {
          continue;
        }
        throw error;
      }
    }
    throw new Error('Could not allocate an enquiry reference.');
  }

  /**
   * Lists enquiries for the caller's tenant, newest first.
   * @param principal Verified caller.
   * @param limit Maximum rows.
   * @returns Staff enquiry rows.
   */
  async list(principal: Principal, limit: number): Promise<StaffEnquiryDto[]> {
    requireRole(principal, LEAD_ROLES);
    const rows = await listEnquiries(this.database.db, principal.tenantId, limit);
    return rows.map((row) => ({
      id: row.id,
      reference: row.reference,
      status: row.status,
      venueName: row.venueName,
      fullName: row.fullName,
      mobile: row.mobileE164,
      eventType: row.eventType,
      preferredDate: row.preferredDate,
      guestsExpected: row.guestsExpected,
      source: row.source,
      createdAt: row.createdAt.toISOString(),
      revision: row.revision,
    }));
  }

  /**
   * Moves a lead to a new status when the transition is allowed and the caller's revision
   * is current. Stale revisions are refused rather than overwritten.
   * @param principal Verified caller.
   * @param enquiryId Enquiry identifier.
   * @param input Requested status and expected revision.
   * @param correlationId Request correlation identifier.
   * @returns The updated status and revision.
   * @throws DomainError NOT_FOUND, REVISION_CONFLICT or POLICY_BLOCKED.
   */
  async changeStatus(
    principal: Principal,
    enquiryId: string,
    input: ChangeEnquiryStatusInput,
    correlationId: string,
  ): Promise<EnquiryStatusDto> {
    requireRole(principal, LEAD_EDIT_ROLES);
    const current = await findEnquiryStatus(this.database.db, principal.tenantId, enquiryId);
    if (!current) {
      throw new DomainError('NOT_FOUND', 'That enquiry could not be found.');
    }
    if (current.revision !== input.expectedRevision) {
      throw new DomainError(
        'REVISION_CONFLICT',
        'This enquiry changed since you opened it. Reload and try again.',
      );
    }
    if (!isEnquiryStatus(current.status) || !canTransitionEnquiry(current.status, input.status)) {
      throw new DomainError(
        'POLICY_BLOCKED',
        `A lead cannot move from ${current.status} to ${input.status}.`,
      );
    }

    const revision = await this.database.db.transaction(async (transaction) => {
      const nextRevision = await updateEnquiryStatus(transaction, {
        tenantId: principal.tenantId,
        enquiryId,
        expectedRevision: input.expectedRevision,
        nextStatus: input.status,
      });
      if (nextRevision === null) {
        throw new DomainError(
          'REVISION_CONFLICT',
          'This enquiry changed since you opened it. Reload and try again.',
        );
      }
      await appendAuditEvent(transaction, {
        id: this.ids.next(),
        tenantId: principal.tenantId,
        actorUserId: principal.userId,
        actorKind: 'staff',
        action: 'enquiry.status_changed',
        entityType: 'enquiry',
        entityId: enquiryId,
        correlationId,
        summary: { from: current.status, to: input.status, revision: nextRevision },
      });
      return nextRevision;
    });
    return { id: enquiryId, status: input.status, revision };
  }
}

/**
 * Generates a human-friendly enquiry reference such as ENQ-7K2M9QXB.
 * @returns A reference matching the database check constraint.
 */
export function newReference(): string {
  let suffix = '';
  for (let index = 0; index < 8; index += 1) {
    suffix += REFERENCE_ALPHABET.charAt(randomInt(REFERENCE_ALPHABET.length));
  }
  return `ENQ-${suffix}`;
}

/**
 * Type guard for lead statuses read from the database.
 * @param value Status text.
 * @returns True when the text is a known lead status.
 */
function isEnquiryStatus(value: string): value is EnquiryStatus {
  return (ENQUIRY_STATUSES as readonly string[]).includes(value);
}
