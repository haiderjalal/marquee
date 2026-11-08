import { DomainError } from './errors';

/**
 * Resource-claim lifecycle. Only `held` and `confirmed` claims occupy a resource;
 * `released` and `expired` claims are history and never block availability.
 */
export const CLAIM_STATES = ['held', 'confirmed', 'released', 'expired'] as const;
export type ClaimState = (typeof CLAIM_STATES)[number];

/** States that occupy an exclusive resource and are covered by the database exclusion constraint. */
export const ACTIVE_CLAIM_STATES: readonly ClaimState[] = ['held', 'confirmed'];

const CLAIM_TRANSITIONS: Readonly<Record<ClaimState, readonly ClaimState[]>> = {
  held: ['confirmed', 'released', 'expired'],
  confirmed: ['released'],
  released: [],
  expired: [],
};

/**
 * Reports whether a claim may change from one state to another.
 * @param from Current claim state.
 * @param to Requested claim state.
 * @returns True when the transition is allowed.
 */
export function canTransitionClaim(from: ClaimState, to: ClaimState): boolean {
  return CLAIM_TRANSITIONS[from].includes(to);
}

/**
 * Decides whether a hold has expired at a given database-clock instant.
 * Expiry is evaluated against the clock supplied by the caller, which must be the
 * database clock on write paths. Holds with a null expiry never expire on their own.
 * @param expiresAtMs Expiry instant in epoch milliseconds.
 * @param nowMs Current instant from the authoritative clock.
 * @returns True when the hold must be treated as expired.
 */
export function isHoldExpired(expiresAtMs: number, nowMs: number): boolean {
  if (!Number.isSafeInteger(expiresAtMs) || !Number.isSafeInteger(nowMs)) {
    throw new DomainError('VALIDATION_FAILED', 'Hold expiry checks need whole epoch milliseconds.');
  }
  return nowMs >= expiresAtMs;
}
