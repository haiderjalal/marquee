import { DomainError } from './errors';

/**
 * Half-open UTC interval [startMs, endMs). One interval may start exactly when
 * another ends without overlapping. Values are epoch milliseconds so arithmetic
 * stays exact and the module has no clock dependency.
 */
export interface HalfOpenInterval {
  readonly startMs: number;
  readonly endMs: number;
}

/**
 * Builds a validated interval.
 * @param startMs Inclusive start, epoch milliseconds.
 * @param endMs Exclusive end, epoch milliseconds.
 * @returns The interval.
 * @throws DomainError when the bounds are not whole numbers or the end is not after the start.
 */
export function createInterval(startMs: number, endMs: number): HalfOpenInterval {
  if (!Number.isSafeInteger(startMs) || !Number.isSafeInteger(endMs)) {
    throw new DomainError('VALIDATION_FAILED', 'Interval bounds must be whole epoch milliseconds.');
  }
  if (endMs <= startMs) {
    throw new DomainError('VALIDATION_FAILED', 'An interval must end after it starts.');
  }
  return { startMs, endMs };
}

/**
 * Expands an event interval to its full occupation window: setup before and teardown after.
 * Buffers count as occupation, so a dinner ending at 22:00 with cleaning until 23:00
 * blocks the hall until 23:00.
 * @param event Public event interval.
 * @param setupMs Milliseconds of setup before the event starts.
 * @param teardownMs Milliseconds of teardown after the event ends.
 * @returns The occupation interval.
 */
export function occupationWindow(
  event: HalfOpenInterval,
  setupMs: number,
  teardownMs: number,
): HalfOpenInterval {
  if (setupMs < 0 || teardownMs < 0) {
    throw new DomainError('VALIDATION_FAILED', 'Setup and teardown durations cannot be negative.');
  }
  return createInterval(event.startMs - setupMs, event.endMs + teardownMs);
}

/**
 * Tests whether two half-open intervals share at least one instant.
 * @param left First interval.
 * @param right Second interval.
 * @returns True when they overlap; touching endpoints do not overlap.
 */
export function intervalsOverlap(left: HalfOpenInterval, right: HalfOpenInterval): boolean {
  return left.startMs < right.endMs && right.startMs < left.endMs;
}
