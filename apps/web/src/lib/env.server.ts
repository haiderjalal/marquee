/** API path prefix shared by every environment. */
const API_PREFIX = '/api/v1';

/** Default API origin for local development. */
const DEFAULT_API_ORIGIN = 'http://localhost:4000';

/**
 * Builds the API base URL used by Server Components and route handlers.
 * @returns Base URL ending in /api/v1 without a trailing slash.
 */
export function internalApiBase(): string {
  const origin = process.env.API_INTERNAL_URL ?? DEFAULT_API_ORIGIN;
  return `${origin.replace(/\/+$/, '')}${API_PREFIX}`;
}

/**
 * Reads the development staff identity. Server-only: this value must never be
 * prefixed NEXT_PUBLIC_ and must never reach the browser bundle.
 * @returns The dev user id, or null when it is not configured.
 */
export function devStaffUserId(): string | null {
  const value = process.env.DEV_STAFF_USER_ID;
  return value && value.length > 0 ? value : null;
}
