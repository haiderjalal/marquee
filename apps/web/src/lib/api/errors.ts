/** One field-level problem reported by the API. */
export interface FieldError {
  readonly field: string;
  readonly message: string;
}

/** Fields needed to build an {@link ApiRequestError}. */
export interface ApiRequestErrorInit {
  readonly status: number;
  readonly code: string;
  readonly message: string;
  readonly correlationId: string | null;
  readonly retryable: boolean;
  readonly fieldErrors: readonly FieldError[];
}

/**
 * Error raised for any failed API call: an error envelope, a malformed response
 * or a network failure. Carries the stable API code so the UI can map it to copy.
 */
export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string;
  readonly correlationId: string | null;
  readonly retryable: boolean;
  readonly fieldErrors: readonly FieldError[];

  /**
   * @param init Status, stable code, safe message and tracing details.
   */
  constructor(init: ApiRequestErrorInit) {
    super(init.message);
    this.name = 'ApiRequestError';
    this.status = init.status;
    this.code = init.code;
    this.correlationId = init.correlationId;
    this.retryable = init.retryable;
    this.fieldErrors = init.fieldErrors;
  }
}

/** Customer-safe copy for each stable API error code. */
const FRIENDLY_MESSAGES: Readonly<Record<string, string>> = {
  VALIDATION_FAILED: 'Some details need another look. Please check the highlighted fields.',
  NOT_FOUND: 'We could not find what you were looking for.',
  FORBIDDEN_SCOPE: 'Your account does not have access to this action.',
  SLOT_CONFLICT: 'That time is no longer free. Please try a different date.',
  REVISION_CONFLICT:
    'This record changed while you were viewing it. Reload the page and try again.',
  POLICY_BLOCKED: 'This request is not allowed by the venue policy.',
  LAYOUT_DOES_NOT_FIT: 'That many guests do not fit in this hall with the chosen tables.',
  IDEMPOTENCY_CONFLICT:
    'This request was already sent with different details. Please reload and try again.',
  RATE_LIMITED: 'Too many requests. Please wait a moment and try again.',
  NETWORK_ERROR: 'We could not reach the server. Check your connection and try again.',
  BAD_RESPONSE: 'The server sent an unexpected response. Please try again shortly.',
};

/** Fallback copy for codes without a dedicated message. */
const GENERIC_MESSAGE = 'Something went wrong on our side. Please try again.';

/**
 * Maps any thrown value to customer-safe copy. Never returns technical details.
 * @param error Value caught from an API call.
 * @returns A short sentence suitable for display.
 */
export function friendlyErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) {
    if (error.status === 429) {
      return FRIENDLY_MESSAGES.RATE_LIMITED ?? GENERIC_MESSAGE;
    }
    return FRIENDLY_MESSAGES[error.code] ?? GENERIC_MESSAGE;
  }
  return GENERIC_MESSAGE;
}

/**
 * Builds the small support line shown beside an error.
 * @param error Value caught from an API call.
 * @returns "Support reference: <id>" or null when no correlation id is known.
 */
export function supportLine(error: unknown): string | null {
  if (error instanceof ApiRequestError && error.correlationId) {
    return `Support reference: ${error.correlationId}`;
  }
  return null;
}
