import { z } from 'zod';

import type { VenueShellPayload } from './payloads';

/**
 * Response DTOs. Monetary values are integer minor-unit decimal strings; the web
 * app formats them with @marquee/domain. Only published data appears in public DTOs.
 */

/** Stable error envelope returned by every failed request. */
export interface ApiErrorBody {
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly correlationId: string;
    readonly retryable: boolean;
    readonly fieldErrors?: readonly { readonly field: string; readonly message: string }[];
  };
}

/** Published venue card for discovery pages. */
export interface PublicVenueSummaryDto {
  readonly slug: string;
  readonly name: string;
  readonly tagline: string;
  readonly publishedCapacityGuests: number;
  readonly indoor: boolean;
  readonly facilities: readonly string[];
  /** Null until approved photography exists; the UI shows a labelled placeholder. */
  readonly photo: { readonly url: string; readonly alt: string } | null;
  readonly spaces: readonly PublicSpaceDto[];
}

/** One bookable space offered by a venue. */
export interface PublicSpaceDto {
  readonly id: string;
  readonly name: string;
  readonly publishedCapacityGuests: number;
  readonly shellVersionId: string;
}

/** Stage preset in the approved catalogue. */
export interface PublicStageDto {
  readonly id: string;
  readonly name: string;
  readonly price: string;
  readonly widthMm: number;
  readonly depthMm: number;
  readonly heightMm: number;
  readonly collection: string;
}

/** Menu package in the approved catalogue. */
export interface PublicMenuPackageDto {
  readonly id: string;
  readonly name: string;
  readonly pricePerGuest: string;
  readonly includes: readonly string[];
  readonly description: string;
}

/** Extra service in the approved catalogue. */
export interface PublicExtraDto {
  readonly code: string;
  readonly label: string;
  readonly unitPrice: string;
}

/** Venue detail: approved shell reference plus catalogue offers for the configurator. */
/** Space on the detail page, with its approved shell geometry for drawing. */
export interface PublicSpaceDetailDto extends PublicSpaceDto {
  readonly shell: VenueShellPayload;
}

export interface PublicVenueDetailDto extends PublicVenueSummaryDto {
  readonly spaces: readonly PublicSpaceDetailDto[];
  readonly stages: readonly PublicStageDto[];
  readonly menuPackages: readonly PublicMenuPackageDto[];
  readonly extras: readonly PublicExtraDto[];
  readonly disclaimer: string;
}

/** Table placement for rendering. Chairs are derived with the spatial package. */
export interface LayoutPlacementDto {
  readonly id: string;
  readonly xMm: number;
  readonly yMm: number;
  readonly seatsOccupied: number;
}

/** Result of authoritative layout validation for a requested count. */
/** Physical check of one stage preset against a seated layout. */
export interface StageCheckDto {
  readonly stageId: string;
  readonly name: string;
  readonly widthMm: number;
  readonly depthMm: number;
  /** True when the footprint is on the floor and no table intrudes on its clearance. */
  readonly fits: boolean;
  readonly outsideFloor: boolean;
  /** Tables the stage would collide with; these are the ones to move before approval. */
  readonly conflictingPlacementIds: readonly string[];
}

export type ConfigurationValidationDto =
  | {
      readonly ok: true;
      readonly shellVersionId: string;
      readonly templateId: string;
      readonly seatsPerTable: number;
      readonly requestedGuests: number;
      readonly tableCount: number;
      readonly chairCount: number;
      readonly placements: readonly LayoutPlacementDto[];
      readonly validatorVersion: string;
      readonly contentHash: string;
      /** Physical check of the requested stage, or null when no stage was requested. */
      readonly stage: StageCheckDto | null;
    }
  | {
      readonly ok: false;
      readonly code: 'LAYOUT_DOES_NOT_FIT' | 'POLICY_BLOCKED';
      readonly message: string;
      readonly capacity: {
        readonly maxTables: number;
        readonly maxGuests: number;
        readonly seatsPerTable: number;
      };
    };

/** One priced quote line as shown on the estimate. */
export interface QuoteLineDto {
  readonly code: string;
  readonly label: string;
  readonly quantity: number;
  readonly amount: string;
  readonly ruleCode: string | null;
}

/** Non-binding, server-priced quote preview. Always labelled as an estimate. */
export interface QuotePreviewDto {
  readonly label: 'ESTIMATE';
  readonly currency: 'PKR';
  readonly billableGuests: number;
  readonly lines: readonly QuoteLineDto[];
  readonly subtotal: string;
  readonly total: string;
  readonly advance: string;
  readonly balance: string;
  readonly advancePercent: number;
  readonly note: string;
}

/** Enquiry as seen by staff. Contact details are visible only to authorised staff. */
export interface StaffEnquiryDto {
  readonly id: string;
  readonly reference: string;
  readonly status: string;
  readonly venueName: string;
  readonly fullName: string;
  readonly mobile: string;
  readonly eventType: string;
  readonly preferredDate: string;
  readonly guestsExpected: number;
  readonly source: string;
  readonly createdAt: string;
  /** Current revision; send it back when changing status so stale edits are refused. */
  readonly revision: number;
}

/** Acknowledgement returned after a successful enquiry submission. */
export interface EnquiryReceiptDto {
  readonly reference: string;
  readonly status: 'new';
  readonly message: string;
}

/** Result of a hold request. */
export interface HoldDto {
  readonly id: string;
  readonly spaceId: string;
  readonly status: 'held';
  readonly occupiedFrom: string;
  readonly occupiedUntil: string;
  readonly expiresAt: string;
  readonly revision: number;
}

/** Staff overview: KPIs, next-week schedule and attention items for one tenant. */
export interface StaffOverviewDto {
  readonly generatedAt: string;
  readonly timezone: 'Asia/Karachi';
  readonly window: { readonly fromIso: string; readonly toIso: string; readonly days: number };
  readonly kpis: {
    readonly upcomingEvents: number;
    readonly newEnquiries: number;
    /** Null until the payments module exists; never a fabricated number. */
    readonly awaitingVerification: number | null;
    /** Null until the billing module exists; never a fabricated number. */
    readonly outstandingBalance: string | null;
  };
  readonly schedule: readonly ScheduleHoldDto[];
  readonly attention: {
    readonly holdsExpiringToday: number;
    readonly newEnquiries: number;
    readonly paymentsToVerify: number | null;
    readonly eventOrdersAwaitingApproval: number | null;
  };
}

/** One hold on the staff schedule. */
export interface ScheduleHoldDto {
  readonly id: string;
  readonly status: 'held' | 'confirmed' | 'released' | 'expired';
  readonly spaceId: string;
  readonly spaceName: string;
  readonly venueName: string;
  readonly occupiedFrom: string;
  readonly occupiedUntil: string;
  readonly expiresAt: string;
  readonly enquiryFullName: string | null;
}

/** Audit event as shown to owners and managers. */
export interface AuditEventDto {
  readonly id: string;
  readonly action: string;
  readonly actorKind: 'staff' | 'public' | 'system';
  readonly entityType: string;
  readonly entityId: string | null;
  readonly correlationId: string;
  readonly occurredAt: string;
  readonly summary: Record<string, unknown>;
}

/** Result of changing an enquiry's status. */
export interface EnquiryStatusDto {
  readonly id: string;
  readonly status: string;
  readonly revision: number;
}

/** Runtime schema for a stored hold response, used when an idempotent request is replayed. */
export const holdDtoSchema = z.object({
  id: z.string(),
  spaceId: z.string(),
  status: z.literal('held'),
  occupiedFrom: z.string(),
  occupiedUntil: z.string(),
  expiresAt: z.string(),
  revision: z.int(),
});
