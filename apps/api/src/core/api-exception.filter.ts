import { randomUUID } from 'node:crypto';

import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException } from '@nestjs/common';
import type { ApiErrorBody } from '@marquee/contracts';
import { DomainError, type DomainErrorCode } from '@marquee/domain';
import type { Logger } from '@marquee/observability';
import { ZodError } from 'zod';

/** HTTP status for every domain error code. The record type forces exhaustive coverage. */
const STATUS_BY_CODE: Readonly<Record<DomainErrorCode, number>> = {
  VALIDATION_FAILED: 400,
  NOT_FOUND: 404,
  FORBIDDEN_SCOPE: 403,
  SLOT_CONFLICT: 409,
  HOLD_EXPIRED: 410,
  INVENTORY_SHORTAGE: 409,
  CONFIGURATION_STALE: 409,
  REVISION_CONFLICT: 409,
  LAYOUT_DOES_NOT_FIT: 409,
  QUOTE_EXPIRED: 410,
  POLICY_BLOCKED: 409,
  PAYMENT_UNVERIFIED: 409,
  IDEMPOTENCY_CONFLICT: 409,
  UNAUTHENTICATED: 401,
  RATE_LIMITED: 429,
};

/** Minimal shape of the response object the filter writes to. */
interface JsonResponse {
  status(code: number): { json(body: ApiErrorBody): void };
}

/** Request fields the filter reads for logging and correlation. */
interface FilteredRequest {
  readonly correlationId?: string;
  readonly method?: string;
  readonly url?: string;
}

/** Result of mapping an exception to an HTTP response. */
interface MappedError {
  readonly status: number;
  readonly body: ApiErrorBody['error'];
}

/**
 * Converts any thrown value into a safe, typed error response. Internal details (SQL,
 * stack traces, provider messages) are logged on the server and never returned.
 */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger: Logger;

  /**
   * @param logger Structured logger used for server-side failures.
   */
  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Writes the error response for an exception raised anywhere in a request.
   * @param exception Thrown value.
   * @param host Nest execution context for the current request.
   */
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<JsonResponse>();
    const request = context.getRequest<FilteredRequest>();
    const correlationId = request.correlationId ?? randomUUID();
    const mapped = mapException(exception, correlationId);

    if (mapped.status >= 500) {
      this.logger.error('request failed', {
        correlationId,
        method: request.method,
        path: request.url,
        errorName: exception instanceof Error ? exception.name : typeof exception,
        message: exception instanceof Error ? exception.message : 'non-error thrown',
      });
    }
    response.status(mapped.status).json({ error: mapped.body });
  }
}

/**
 * Maps an exception to a status and a client-safe body.
 * @param exception Thrown value.
 * @param correlationId Correlation id to echo.
 * @returns Status code and error body.
 */
export function mapException(exception: unknown, correlationId: string): MappedError {
  if (exception instanceof DomainError) {
    return {
      status: STATUS_BY_CODE[exception.code],
      body: {
        code: exception.code,
        message: exception.message,
        correlationId,
        retryable: false,
      },
    };
  }
  if (exception instanceof ZodError) {
    return {
      status: 400,
      body: {
        code: 'VALIDATION_FAILED',
        message: 'Some details need attention.',
        correlationId,
        retryable: false,
        fieldErrors: exception.issues.map((issue) => ({
          field: issue.path.map(String).join('.') || 'request',
          message: issue.message,
        })),
      },
    };
  }
  if (exception instanceof HttpException) {
    return httpExceptionBody(exception.getStatus(), correlationId);
  }
  return {
    status: 500,
    body: {
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong on our side. Please try again.',
      correlationId,
      retryable: true,
    },
  };
}

/**
 * Builds a safe body for framework-level HTTP exceptions such as unknown routes.
 * @param status HTTP status produced by the framework.
 * @param correlationId Correlation id to echo.
 * @returns Status and body.
 */
function httpExceptionBody(status: number, correlationId: string): MappedError {
  const codeByStatus: Record<number, { code: string; message: string }> = {
    400: { code: 'VALIDATION_FAILED', message: 'The request could not be read.' },
    401: { code: 'UNAUTHENTICATED', message: 'Sign in is required.' },
    403: { code: 'FORBIDDEN_SCOPE', message: 'You do not have access to this.' },
    404: { code: 'NOT_FOUND', message: 'That address does not exist.' },
    413: { code: 'VALIDATION_FAILED', message: 'The request is too large.' },
    429: { code: 'RATE_LIMITED', message: 'Too many requests. Please wait and try again.' },
  };
  const entry = codeByStatus[status] ?? { code: 'INTERNAL_ERROR', message: 'Request failed.' };
  return {
    status,
    body: { code: entry.code, message: entry.message, correlationId, retryable: status >= 500 },
  };
}
