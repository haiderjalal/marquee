import type { AuditEventDto, StaffOverviewDto } from '@marquee/contracts';
import {
  countEnquiriesByStatus,
  countHoldsExpiringBefore,
  type DatabaseClient,
  listAuditEvents,
  listHoldsInWindow,
} from '@marquee/database';
import { Inject, Injectable } from '@nestjs/common';

import type { Principal } from '../auth/principal';
import { requireRole } from '../auth/principal';
import { CLOCK, type Clock, DATABASE } from '../core/tokens';

/** Venue timezone used for "today" and day boundaries. Pakistan observes no daylight saving. */
const VENUE_TIMEZONE = 'Asia/Karachi';
const VENUE_UTC_OFFSET = '+05:00';

/** Length of one day in milliseconds. */
const DAY_MS = 24 * 60 * 60_000;

/** Days shown on the staff schedule. */
const SCHEDULE_DAYS = 7;

/** Horizon used to count upcoming confirmed events. */
const UPCOMING_HORIZON_DAYS = 365;

/** Roles allowed to read the audit trail. */
const AUDIT_ROLES = ['owner', 'manager'] as const;

/**
 * Staff read models: the overview dashboard and the audit trail. Nothing here writes.
 */
@Injectable()
export class StaffService {
  private readonly database: DatabaseClient;
  private readonly clock: Clock;

  /**
   * @param database Database handle.
   * @param clock Time source.
   */
  constructor(@Inject(DATABASE) database: DatabaseClient, @Inject(CLOCK) clock: Clock) {
    this.database = database;
    this.clock = clock;
  }

  /**
   * Builds the overview for the caller's tenant. Modules that do not exist yet are reported
   * as null so the interface can say so rather than show invented numbers.
   * @param principal Verified caller.
   * @returns The overview DTO.
   */
  async overview(principal: Principal, fromDate?: string): Promise<StaffOverviewDto> {
    const db = this.database.db;
    const now = this.clock.now();
    const today = venueDateString(now);
    const windowDay = fromDate ?? today;
    const startOfDay = Date.parse(`${windowDay}T00:00:00${VENUE_UTC_OFFSET}`);
    const endOfTodayMs = Date.parse(`${today}T00:00:00${VENUE_UTC_OFFSET}`) + DAY_MS;
    const windowEnd = startOfDay + SCHEDULE_DAYS * DAY_MS;

    const [counts, schedule, upcoming, expiringToday] = await Promise.all([
      countEnquiriesByStatus(db, principal.tenantId),
      listHoldsInWindow(db, {
        tenantId: principal.tenantId,
        fromIso: new Date(startOfDay).toISOString(),
        toIso: new Date(windowEnd).toISOString(),
      }),
      listHoldsInWindow(db, {
        tenantId: principal.tenantId,
        fromIso: now.toISOString(),
        toIso: new Date(now.getTime() + UPCOMING_HORIZON_DAYS * DAY_MS).toISOString(),
      }),
      countHoldsExpiringBefore(db, {
        tenantId: principal.tenantId,
        untilIso: new Date(endOfTodayMs).toISOString(),
      }),
    ]);

    const newEnquiries = counts.get('new') ?? 0;
    const upcomingEvents = upcoming.filter((hold) => hold.status === 'confirmed').length;
    return {
      generatedAt: now.toISOString(),
      timezone: VENUE_TIMEZONE,
      window: {
        fromIso: new Date(startOfDay).toISOString(),
        toIso: new Date(windowEnd).toISOString(),
        days: SCHEDULE_DAYS,
      },
      kpis: {
        upcomingEvents,
        newEnquiries,
        awaitingVerification: null,
        outstandingBalance: null,
      },
      schedule: schedule.map((hold) => ({
        id: hold.holdId,
        status: hold.status,
        spaceId: hold.spaceId,
        spaceName: hold.spaceName,
        venueName: hold.venueName,
        occupiedFrom: hold.occupiedFrom.toISOString(),
        occupiedUntil: hold.occupiedUntil.toISOString(),
        expiresAt: hold.expiresAt.toISOString(),
        enquiryFullName: hold.enquiryFullName,
      })),
      attention: {
        holdsExpiringToday: expiringToday,
        newEnquiries,
        paymentsToVerify: null,
        eventOrdersAwaitingApproval: null,
      },
    };
  }

  /**
   * Lists recent audit events for owners and managers.
   * @param principal Verified caller.
   * @param limit Maximum rows.
   * @returns Audit events, newest first.
   */
  async audit(principal: Principal, limit: number): Promise<AuditEventDto[]> {
    requireRole(principal, AUDIT_ROLES);
    const rows = await listAuditEvents(this.database.db, principal.tenantId, limit);
    return rows.map((row) => ({
      id: row.id,
      action: row.action,
      actorKind: row.actorKind,
      entityType: row.entityType,
      entityId: row.entityId,
      correlationId: row.correlationId,
      occurredAt: row.occurredAt.toISOString(),
      summary: summaryRecord(row.summary),
    }));
  }
}

/**
 * Narrows a stored audit summary to an object. Summaries are written by this API as objects;
 * anything else is shown as an empty summary rather than trusted.
 * @param value Stored JSON value.
 * @returns The summary object.
 */
function summaryRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value))
    : {};
}

/**
 * Returns the venue-local calendar date for an instant, formatted YYYY-MM-DD.
 * @param instant Instant to convert.
 * @returns Local date string.
 */
export function venueDateString(instant: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: VENUE_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}
