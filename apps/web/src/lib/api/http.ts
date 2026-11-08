import { ApiRequestError, type FieldError } from './errors';
import { isRecord } from './guards';

/** Options for {@link requestJson}. */
export interface RequestOptions<T> {
  /** Narrows the unknown `data` payload to the expected type. */
  readonly guard: (value: unknown) => value is T;
  readonly method?: 'GET' | 'POST' | 'PATCH';
  readonly body?: unknown;
  readonly headers?: Readonly<Record<string, string>>;
  readonly signal?: AbortSignal;
  /** Fetch cache directive for server calls. */
  readonly cache?: RequestCache;
}

/**
 * Extracts field errors from an error envelope.
 * @param value Raw `fieldErrors` member.
 * @returns A clean list, empty when absent or malformed.
 */
function readFieldErrors(value: unknown): FieldError[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const result: FieldError[] = [];
  for (const item of value) {
    if (isRecord(item) && typeof item.field === 'string' && typeof item.message === 'string') {
      result.push({ field: item.field, message: item.message });
    }
  }
  return result;
}

/**
 * Converts a failed response into an {@link ApiRequestError}, reading the API
 * error envelope when the body has one.
 * @param response Failed HTTP response.
 * @returns The error to throw.
 */
async function toApiError(response: Response): Promise<ApiRequestError> {
  let parsed: unknown;
  try {
    parsed = await response.json();
  } catch {
    parsed = null;
  }
  const envelope = isRecord(parsed) && isRecord(parsed.error) ? parsed.error : null;
  return new ApiRequestError({
    status: response.status,
    code: envelope && typeof envelope.code === 'string' ? envelope.code : 'BAD_RESPONSE',
    message:
      envelope && typeof envelope.message === 'string'
        ? envelope.message
        : `Request failed (${response.status}).`,
    correlationId:
      envelope && typeof envelope.correlationId === 'string'
        ? envelope.correlationId
        : response.headers.get('x-correlation-id'),
    retryable: envelope ? envelope.retryable === true : response.status >= 500,
    fieldErrors: envelope ? readFieldErrors(envelope.fieldErrors) : [],
  });
}

/**
 * Calls the API and returns the `data` member of a success envelope.
 * @param url Absolute URL.
 * @param options Method, body, guard and cancellation.
 * @returns The validated payload.
 * @throws ApiRequestError for error envelopes, malformed bodies and network failures.
 * @throws DOMException named AbortError when the caller aborts the request.
 */
export async function requestJson<T>(url: string, options: RequestOptions<T>): Promise<T> {
  const headers: Record<string, string> = { accept: 'application/json', ...options.headers };
  const init: RequestInit = { method: options.method ?? 'GET', headers };
  if (options.body !== undefined) {
    headers['content-type'] = 'application/json';
    init.body = JSON.stringify(options.body);
  }
  if (options.signal) {
    init.signal = options.signal;
  }
  if (options.cache) {
    init.cache = options.cache;
  }

  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }
    throw new ApiRequestError({
      status: 0,
      code: 'NETWORK_ERROR',
      message: 'Network request failed.',
      correlationId: null,
      retryable: true,
      fieldErrors: [],
    });
  }

  if (!response.ok) {
    throw await toApiError(response);
  }

  let parsed: unknown;
  try {
    parsed = await response.json();
  } catch {
    parsed = null;
  }
  if (isRecord(parsed) && options.guard(parsed.data)) {
    return parsed.data;
  }
  throw new ApiRequestError({
    status: response.status,
    code: 'BAD_RESPONSE',
    message: 'Response did not match the expected shape.',
    correlationId: response.headers.get('x-correlation-id'),
    retryable: false,
    fieldErrors: [],
  });
}

/**
 * Detects an aborted request so callers can ignore it silently.
 * @param error Value caught from {@link requestJson}.
 * @returns True when the request was cancelled by an AbortController.
 */
export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}
