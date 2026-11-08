'use client';

import type { ConfigurationValidateInput, ConfigurationValidationDto } from '@marquee/contracts';
import { MAX_REQUESTED_GUESTS, type SeatsPerTable } from '@marquee/domain';

import { validateConfiguration } from '@/lib/api/client';

import { useDebouncedRequest, type RequestState } from './useDebouncedRequest';

/** Debounce for seating validation, so rapid stepper clicks produce one request. */
const VALIDATION_DEBOUNCE_MS = 350;

/**
 * Validates the seating plan and the chosen stage on the server whenever guests, table size or
 * stage change. The returned counts and stage fit are the server's; the browser never derives them.
 *
 * @param venueSlug Venue being planned, or null before one is chosen.
 * @param guests Requested guest count.
 * @param seatsPerTable Chosen table size.
 * @param stageId Chosen stage preset code, or null for no stage.
 * @returns Request state holding the server validation result.
 */
export function useConfigurationValidation(
  venueSlug: string | null,
  guests: number,
  seatsPerTable: SeatsPerTable,
  stageId: string | null,
): RequestState<ConfigurationValidationDto> {
  const inputIsValid =
    venueSlug !== null && Number.isInteger(guests) && guests >= 1 && guests <= MAX_REQUESTED_GUESTS;
  const input: ConfigurationValidateInput | null = inputIsValid
    ? { venueSlug, requestedGuests: guests, seatsPerTable, stageId }
    : null;
  return useDebouncedRequest(input, validateConfiguration, VALIDATION_DEBOUNCE_MS);
}
