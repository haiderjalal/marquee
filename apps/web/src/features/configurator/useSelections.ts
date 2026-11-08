'use client';

import type {
  PublicExtraDto,
  PublicMenuPackageDto,
  PublicStageDto,
  PublicVenueDetailDto,
  QuotePreviewInput,
} from '@marquee/contracts';
import type { SeatsPerTable } from '@marquee/domain';
import { useMemo } from 'react';

import { useDraftStore } from '@/store/draftStore';

/** A selected extra with its quantity. */
export interface SelectedExtra {
  readonly extra: PublicExtraDto;
  readonly quantity: number;
}

/** Draft choices resolved against the venue's approved catalogue. */
export interface Selections {
  readonly menuPackage: PublicMenuPackageDto | null;
  readonly stage: PublicStageDto | null;
  readonly extras: readonly SelectedExtra[];
}

/**
 * Resolves the draft's ids against the venue catalogue. Ids that do not exist for
 * this venue (for example after switching venue) resolve to nothing.
 *
 * @param venue Venue detail with the approved catalogue.
 * @returns The package, stage and extras the draft refers to.
 */
export function useSelections(venue: PublicVenueDetailDto): Selections {
  const packageId = useDraftStore((state) => state.packageId);
  const stageId = useDraftStore((state) => state.stageId);
  const extras = useDraftStore((state) => state.extras);

  return useMemo(
    () => ({
      menuPackage: venue.menuPackages.find((entry) => entry.id === packageId) ?? null,
      stage: venue.stages.find((entry) => entry.id === stageId) ?? null,
      extras: venue.extras
        .map((extra) => ({ extra, quantity: extras[extra.code] ?? 0 }))
        .filter((entry) => entry.quantity > 0),
    }),
    [venue, packageId, stageId, extras],
  );
}

/** Which optional parts of the configuration to include in a quote request. */
export interface QuoteScope {
  readonly includeStage: boolean;
  readonly includeExtras: boolean;
}

/**
 * Builds the body for a quote preview from the draft. Returns null until a menu
 * package is chosen, because the server prices catering from a package.
 *
 * @param venue Venue detail.
 * @param selections Resolved selections.
 * @param guests Requested guests from the draft.
 * @param seatsPerTable Chosen table size.
 * @param scope Whether stage and extras are part of this estimate.
 * @returns A quote request, or null when it cannot be priced yet.
 */
export function buildQuoteInput(
  venue: PublicVenueDetailDto,
  selections: Selections,
  guests: number,
  seatsPerTable: SeatsPerTable,
  scope: QuoteScope,
): QuotePreviewInput | null {
  if (!selections.menuPackage) {
    return null;
  }
  return {
    venueSlug: venue.slug,
    requestedGuests: guests,
    seatsPerTable,
    packageId: selections.menuPackage.id,
    stageId: scope.includeStage && selections.stage ? selections.stage.id : null,
    extras: scope.includeExtras
      ? selections.extras.map((entry) => ({ code: entry.extra.code, quantity: entry.quantity }))
      : [],
  };
}
