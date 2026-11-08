import { DomainError } from './errors';
import { type HalfOpenInterval, intervalsOverlap } from './interval';

/** A quantity reserved from a fungible stock pool for one interval. */
export interface StockReservation {
  readonly quantity: number;
  readonly interval: HalfOpenInterval;
}

/** Result of checking a proposed reservation against a pool. */
export interface StockCheckResult {
  readonly fits: boolean;
  /** Highest simultaneous quantity reserved anywhere in the proposed interval, including the proposal. */
  readonly peakQuantity: number;
  readonly serviceableCapacity: number;
}

/**
 * Computes the maximum simultaneous reserved quantity across a set of reservations.
 *
 * Uses an endpoint sweep: start events add quantity and end events subtract it.
 * At an equal timestamp end events are applied before start events, which keeps
 * half-open semantics (a reservation ending at 11:00 does not conflict with one
 * starting at 11:00). A naive sum of every overlapping quantity would overstate
 * peak usage, so it is never used for capacity decisions.
 *
 * @param reservations Reservations to sweep; quantities must be non-negative integers.
 * @returns The peak simultaneous quantity, zero for an empty list.
 * @throws DomainError for invalid quantities.
 */
export function maxConcurrentQuantity(reservations: readonly StockReservation[]): number {
  const events: Array<{ readonly at: number; readonly delta: number }> = [];
  for (const reservation of reservations) {
    if (!Number.isSafeInteger(reservation.quantity) || reservation.quantity < 0) {
      throw new DomainError(
        'VALIDATION_FAILED',
        'Reserved quantities must be non-negative integers.',
      );
    }
    events.push({ at: reservation.interval.startMs, delta: reservation.quantity });
    events.push({ at: reservation.interval.endMs, delta: -reservation.quantity });
  }
  events.sort((left, right) => left.at - right.at || left.delta - right.delta);

  let current = 0;
  let peak = 0;
  for (const event of events) {
    current += event.delta;
    peak = Math.max(peak, current);
  }
  return peak;
}

/**
 * Decides whether a proposed quantity can be reserved from a pool over its interval.
 *
 * Only reservations that overlap the proposal are considered. The check is the
 * peak of existing overlapping reservations plus the proposal, measured against
 * serviceable capacity (capacity minus damaged and maintenance units). The caller
 * must hold the stock-pool row lock while calling this in a write path.
 *
 * @param input Pool capacity, existing reservations and the proposed reservation.
 * @returns Whether it fits, plus the peak used for explanations.
 * @throws DomainError for invalid capacities or quantities.
 */
export function checkStockAvailability(input: {
  readonly capacity: number;
  readonly unavailableUnits: number;
  readonly existing: readonly StockReservation[];
  readonly proposed: StockReservation;
}): StockCheckResult {
  if (!Number.isSafeInteger(input.capacity) || input.capacity < 0) {
    throw new DomainError('VALIDATION_FAILED', 'Pool capacity must be a non-negative integer.');
  }
  if (!Number.isSafeInteger(input.unavailableUnits) || input.unavailableUnits < 0) {
    throw new DomainError('VALIDATION_FAILED', 'Unavailable units must be a non-negative integer.');
  }
  const serviceableCapacity = Math.max(0, input.capacity - input.unavailableUnits);
  const overlapping = input.existing.filter((reservation) =>
    intervalsOverlap(reservation.interval, input.proposed.interval),
  );
  const peakQuantity = maxConcurrentQuantity([...overlapping, input.proposed]);
  return {
    fits: peakQuantity <= serviceableCapacity,
    peakQuantity,
    serviceableCapacity,
  };
}
