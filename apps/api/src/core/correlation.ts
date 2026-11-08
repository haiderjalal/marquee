import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

/** Header carrying the request correlation identifier in and out of the API. */
export const CORRELATION_HEADER = 'x-correlation-id';

/** Request augmented with its correlation identifier. */
export type CorrelatedRequest = IncomingMessage & { correlationId?: string };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Accepts a client correlation id when it is a UUID, otherwise generates one. The id is
 * attached to the request, echoed on the response and included in error bodies and logs.
 * @param request Incoming request.
 * @param response Outgoing response.
 * @param next Continues the middleware chain.
 */
export function correlationMiddleware(
  request: CorrelatedRequest,
  response: ServerResponse,
  next: () => void,
): void {
  const incoming = request.headers[CORRELATION_HEADER];
  const candidate = Array.isArray(incoming) ? incoming[0] : incoming;
  const correlationId = candidate && UUID_PATTERN.test(candidate) ? candidate : randomUUID();
  request.correlationId = correlationId;
  response.setHeader(CORRELATION_HEADER, correlationId);
  next();
}
