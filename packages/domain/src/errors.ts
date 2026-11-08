/**
 * Stable, client-safe error codes shared by the domain, API and web app.
 * Codes are part of the public contract: never rename one without an ADR.
 */
export const DOMAIN_ERROR_CODES = [
  'VALIDATION_FAILED',
  'NOT_FOUND',
  'FORBIDDEN_SCOPE',
  'SLOT_CONFLICT',
  'HOLD_EXPIRED',
  'INVENTORY_SHORTAGE',
  'CONFIGURATION_STALE',
  'REVISION_CONFLICT',
  'LAYOUT_DOES_NOT_FIT',
  'QUOTE_EXPIRED',
  'POLICY_BLOCKED',
  'PAYMENT_UNVERIFIED',
  'IDEMPOTENCY_CONFLICT',
  'UNAUTHENTICATED',
  'RATE_LIMITED',
] as const;

export type DomainErrorCode = (typeof DOMAIN_ERROR_CODES)[number];

/**
 * Error raised by pure domain rules. It carries a stable code and a safe
 * message; it never carries SQL, stack details or other tenants' data.
 */
export class DomainError extends Error {
  readonly code: DomainErrorCode;

  /**
   * @param code Stable error code from {@link DOMAIN_ERROR_CODES}.
   * @param message Safe, user-presentable explanation.
   */
  constructor(code: DomainErrorCode, message: string) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
  }
}
