/** API path prefix shared by every environment. */
const API_PREFIX = '/api/v1';

/** Default API origin for local development. */
const DEFAULT_API_ORIGIN = 'http://localhost:4000';

/**
 * Builds the API base URL that browsers call directly (public endpoints only).
 * Reads the build-time NEXT_PUBLIC_API_BASE_URL; contains no secrets.
 * @returns Base URL ending in /api/v1 without a trailing slash.
 */
export function browserApiBase(): string {
  const origin = process.env.NEXT_PUBLIC_API_BASE_URL ?? DEFAULT_API_ORIGIN;
  return `${origin.replace(/\/+$/, '')}${API_PREFIX}`;
}
