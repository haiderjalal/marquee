import type { StaffEnquiryDto, StaffOverviewDto } from '@marquee/contracts';

import { devStaffUserId, internalApiBase } from '@/lib/env.server';

import { ApiRequestError } from './errors';
import { isArrayOf, isStaffEnquiry, isStaffOverview } from './guards';
import { requestJson } from './http';

/**
 * Builds the development staff headers. Server-only: the dev user id never
 * reaches the browser.
 * @returns Headers for the API, or throws when no dev identity is configured.
 * @throws ApiRequestError with FORBIDDEN_SCOPE when DEV_STAFF_USER_ID is not set.
 */
export function staffHeaders(): Record<string, string> {
  const userId = devStaffUserId();
  if (!userId) {
    throw new ApiRequestError({
      status: 403,
      code: 'FORBIDDEN_SCOPE',
      message: 'DEV_STAFF_USER_ID is not configured on the web server.',
      correlationId: null,
      retryable: false,
      fieldErrors: [],
    });
  }
  return { 'x-dev-user-id': userId };
}

/**
 * Loads the staff overview for a seven-day window.
 * @param from Optional first local date (YYYY-MM-DD) of the window.
 * @returns The overview DTO.
 * @throws ApiRequestError on failure.
 */
export function getStaffOverview(from?: string): Promise<StaffOverviewDto> {
  const query = from ? `?from=${encodeURIComponent(from)}` : '';
  return requestJson(`${internalApiBase()}/staff/overview${query}`, {
    guard: isStaffOverview,
    headers: staffHeaders(),
    cache: 'no-store',
  });
}

/**
 * Loads recent enquiries, newest first.
 * @param limit Maximum rows.
 * @returns Enquiry rows including contact details and revision.
 * @throws ApiRequestError on failure.
 */
export function getStaffEnquiries(limit = 50): Promise<StaffEnquiryDto[]> {
  return requestJson(`${internalApiBase()}/staff/enquiries?limit=${limit}`, {
    guard: (value): value is StaffEnquiryDto[] => isArrayOf(value, isStaffEnquiry),
    headers: staffHeaders(),
    cache: 'no-store',
  });
}
