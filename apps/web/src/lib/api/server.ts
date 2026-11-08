import type { PublicVenueDetailDto, PublicVenueSummaryDto } from '@marquee/contracts';

import { internalApiBase } from '@/lib/env.server';

import { ApiRequestError } from './errors';
import { isArrayOf, isVenueDetail, isVenueSummary } from './guards';
import { requestJson } from './http';

/**
 * Lists published venues for the discovery page. Server-side only.
 * @returns Published venue cards.
 * @throws ApiRequestError when the API is unreachable or answers with an error.
 */
export async function getPublicVenues(): Promise<PublicVenueSummaryDto[]> {
  return requestJson(`${internalApiBase()}/public/venues`, {
    guard: (value): value is PublicVenueSummaryDto[] => isArrayOf(value, isVenueSummary),
    cache: 'no-store',
  });
}

/**
 * Loads one venue with its approved catalogue. Server-side only.
 * @param slug Venue slug from the route.
 * @returns The venue detail, or null when the API reports NOT_FOUND.
 * @throws ApiRequestError for every failure other than NOT_FOUND.
 */
export async function getPublicVenue(slug: string): Promise<PublicVenueDetailDto | null> {
  try {
    return await requestJson(`${internalApiBase()}/public/venues/${encodeURIComponent(slug)}`, {
      guard: isVenueDetail,
      cache: 'no-store',
    });
  } catch (error) {
    if (error instanceof ApiRequestError && (error.code === 'NOT_FOUND' || error.status === 404)) {
      return null;
    }
    throw error;
  }
}
