import { describe, expect, it } from 'vitest';

import {
  formatPkr,
  fromMinorString,
  percentOfHalfUp,
  parsePkrDecimal,
  pkrRupees,
  toMinorString,
  DomainError,
} from '../src';

describe('money (integer minor units)', () => {
  it('stores PKR 1,100 as 110000 paisa, not a float', () => {
    expect(pkrRupees(1100).amountMinor).toBe(110_000n);
  });

  it('computes the demo advance exactly: 25 percent of PKR 725,000 is PKR 181,250', () => {
    const total = pkrRupees(725_000);
    expect(percentOfHalfUp(total, 2_500)).toEqual(pkrRupees(181_250));
  });

  it('rounds half-up on minor units at the boundary', () => {
    // 0.5 paisa rounds up to 1 paisa; 0.4 paisa rounds down to 0.
    expect(percentOfHalfUp({ amountMinor: 1n, currency: 'PKR' }, 5_000).amountMinor).toBe(1n);
    expect(percentOfHalfUp({ amountMinor: 1n, currency: 'PKR' }, 4_000).amountMinor).toBe(0n);
  });

  it('formats for people with western grouping and omits zero paisa', () => {
    expect(formatPkr(pkrRupees(725_000))).toBe('PKR 725,000');
    expect(formatPkr(parsePkrDecimal('1234.5'))).toBe('PKR 1,234.50');
    expect(formatPkr(pkrRupees(-10_000))).toBe('-PKR 10,000');
  });

  it('round-trips the decimal-string wire format', () => {
    const amount = pkrRupees(550_000);
    expect(toMinorString(amount)).toBe('55000000');
    expect(fromMinorString(toMinorString(amount))).toEqual(amount);
  });

  it('rejects fractional or malformed input instead of guessing', () => {
    expect(() => parsePkrDecimal('12.345')).toThrow(DomainError);
    expect(() => parsePkrDecimal('abc')).toThrow(DomainError);
    expect(() => fromMinorString('1.5')).toThrow(DomainError);
    expect(() => pkrRupees(1.5)).toThrow(DomainError);
  });
});
