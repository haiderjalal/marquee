import { NextResponse, type NextRequest } from 'next/server';

import { internalApiBase } from '@/lib/env.server';
import { ApiRequestError } from '@/lib/api/errors';
import { staffHeaders } from '@/lib/api/staff.server';

export const dynamic = 'force-dynamic';

/** Route parameters (a Promise in Next.js 16). */
interface RouteContext {
  readonly params: Promise<{ readonly path: string[] }>;
}

/** Only this browser-initiated staff write is forwarded: PATCH enquiries/:id/status. */
const STATUS_PATH = /^enquiries\/[0-9a-f-]{36}\/status$/i;

/**
 * Builds a JSON error body in the API's envelope shape.
 * @param status HTTP status.
 * @param code Stable error code.
 * @param message Safe message.
 * @returns A JSON response.
 */
function errorResponse(status: number, code: string, message: string): NextResponse {
  return NextResponse.json(
    { error: { code, message, correlationId: crypto.randomUUID(), retryable: false } },
    { status },
  );
}

/**
 * Forwards an enquiry status change to the API, adding the dev staff identity on
 * the server so the browser never sees it. Anything other than the allowed path is refused.
 *
 * @param request Incoming browser request with the JSON body.
 * @param context Route params holding the path segments.
 * @returns The API response body and status, or a refusal.
 */
export async function PATCH(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  // Development convenience only: this route acts with the dev staff identity, so it must never serve production.
  if (process.env.NODE_ENV === 'production') {
    return errorResponse(404, 'NOT_FOUND', 'Unknown staff action.');
  }
  const { path } = await context.params;
  const joined = path.join('/');
  if (!STATUS_PATH.test(joined)) {
    return errorResponse(404, 'NOT_FOUND', 'Unknown staff action.');
  }
  let headers: Record<string, string>;
  try {
    headers = staffHeaders();
  } catch (error) {
    if (error instanceof ApiRequestError) {
      return errorResponse(403, error.code, 'Staff sign-in is not configured.');
    }
    throw error;
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, 'VALIDATION_FAILED', 'Request body must be JSON.');
  }
  try {
    const upstream = await fetch(`${internalApiBase()}/staff/${joined}`, {
      method: 'PATCH',
      headers: { ...headers, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
    const text = await upstream.text();
    return new NextResponse(text, {
      status: upstream.status,
      headers: { 'content-type': upstream.headers.get('content-type') ?? 'application/json' },
    });
  } catch {
    return errorResponse(502, 'NETWORK_ERROR', 'The API could not be reached.');
  }
}
