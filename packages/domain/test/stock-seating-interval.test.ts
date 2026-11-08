import { describe, expect, it } from 'vitest';

import {
  checkStockAvailability,
  createInterval,
  DomainError,
  intervalsOverlap,
  isHoldExpired,
  maxConcurrentQuantity,
  occupationWindow,
  planSeating,
  type StockReservation,
} from '../src';

const HOUR = 3_600_000;
/** Anchor instant in UTC for readable fixtures: 10:00 on an arbitrary day. */
const TEN_AM = Date.UTC(2026, 11, 12, 5, 0);

/** Builds an interval from hour offsets relative to TEN_AM for compact fixtures. */
function hours(startOffset: number, endOffset: number) {
  return createInterval(TEN_AM + startOffset * HOUR, TEN_AM + endOffset * HOUR);
}

describe('half-open intervals', () => {
  it('treats touching endpoints as non-overlapping', () => {
    expect(intervalsOverlap(hours(0, 1), hours(1, 2))).toBe(false);
  });

  it('detects genuine overlap', () => {
    expect(intervalsOverlap(hours(0, 2), hours(1, 3))).toBe(true);
  });

  it('counts setup and teardown as occupation', () => {
    // Dinner 18:00 to 22:00 with cleaning until 23:00 blocks a 22:30 start.
    const dinner = hours(8, 12);
    const window = occupationWindow(dinner, 0, HOUR);
    const nextSetup = hours(12.5, 14);
    expect(intervalsOverlap(window, nextSetup)).toBe(true);
    expect(intervalsOverlap(dinner, nextSetup)).toBe(false);
  });

  it('rejects an interval that does not end after it starts', () => {
    expect(() => createInterval(TEN_AM, TEN_AM)).toThrow(DomainError);
  });
});

describe('stock peak concurrency (endpoint sweep, not naive sum)', () => {
  // Specification fixture: pool capacity 100; A 60 for 10:00-11:00; B 60 for 12:00-13:00.
  const existing: StockReservation[] = [
    { quantity: 60, interval: hours(0, 1) },
    { quantity: 60, interval: hours(2, 3) },
  ];

  it('computes a peak of 60 for the two disjoint reservations alone', () => {
    expect(maxConcurrentQuantity(existing)).toBe(60);
  });

  it('accepts a proposed quantity 40 across 10:00-13:00 because the true peak is 100', () => {
    const result = checkStockAvailability({
      capacity: 100,
      unavailableUnits: 0,
      existing,
      proposed: { quantity: 40, interval: hours(0, 3) },
    });
    expect(result.peakQuantity).toBe(100);
    expect(result.fits).toBe(true);
  });

  it('rejects a proposed quantity 41 over the same window', () => {
    const result = checkStockAvailability({
      capacity: 100,
      unavailableUnits: 0,
      existing,
      proposed: { quantity: 41, interval: hours(0, 3) },
    });
    expect(result.peakQuantity).toBe(101);
    expect(result.fits).toBe(false);
  });

  it('lets an end and a start at the same instant share stock', () => {
    const result = checkStockAvailability({
      capacity: 100,
      unavailableUnits: 0,
      existing: [{ quantity: 100, interval: hours(0, 1) }],
      proposed: { quantity: 100, interval: hours(1, 2) },
    });
    expect(result.fits).toBe(true);
  });

  it('subtracts damaged or maintenance units from serviceable capacity', () => {
    const result = checkStockAvailability({
      capacity: 100,
      unavailableUnits: 5,
      existing: [],
      proposed: { quantity: 96, interval: hours(0, 1) },
    });
    expect(result.serviceableCapacity).toBe(95);
    expect(result.fits).toBe(false);
  });
});

describe('seating counts (exact chairs and tables)', () => {
  it('gives 200 guests at five seats 40 tables and 200 chairs', () => {
    const plan = planSeating(200, 5);
    expect(plan).toMatchObject({ tableCount: 40, chairCount: 200, seatsAtLastTable: 5 });
  });

  it('gives 500 guests at five seats 100 tables and 500 chairs', () => {
    expect(planSeating(500, 5)).toMatchObject({ tableCount: 100, chairCount: 500 });
  });

  it('gives 503 guests 101 tables and 503 chairs with a partial last table of three', () => {
    expect(planSeating(503, 5)).toMatchObject({
      tableCount: 101,
      chairCount: 503,
      seatsAtLastTable: 3,
    });
  });

  it('refuses zero, fractional, negative and oversized guest counts', () => {
    expect(() => planSeating(0, 5)).toThrow(DomainError);
    expect(() => planSeating(12.5, 5)).toThrow(DomainError);
    expect(() => planSeating(-4, 5)).toThrow(DomainError);
    expect(() => planSeating(999_999, 5)).toThrow(DomainError);
  });

  it('refuses unsupported table sizes', () => {
    expect(() => planSeating(100, 6)).toThrow(DomainError);
  });
});

describe('holds', () => {
  it('expires only at or after the expiry instant', () => {
    expect(isHoldExpired(1_000, 999)).toBe(false);
    expect(isHoldExpired(1_000, 1_000)).toBe(true);
  });
});
