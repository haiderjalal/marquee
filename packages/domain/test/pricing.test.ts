import { describe, expect, it } from 'vitest';

import {
  DomainError,
  formatPkr,
  pkrRupees,
  priceQuote,
  type QuoteCatalogueInput,
  type QuotePolicy,
} from '../src';

/** Independent expected values from the planning specification's worked example (fictional demo data). */
const WORKED_EXAMPLE_CATALOGUE: QuoteCatalogueInput = {
  guestsRequested: 500,
  menu: {
    packageVersionId: 'demo-1100-v1',
    packageName: 'Signature',
    pricePerGuest: pkrRupees(1_100),
  },
  space: { spaceName: 'Marquee A', rent: pkrRupees(100_000) },
  stage: { stageName: 'Floral Garden', price: pkrRupees(60_000) },
  extras: [{ code: 'AC', label: 'AC service', unitPrice: pkrRupees(25_000), quantity: 1 }],
};

const NO_RULES_POLICY: QuotePolicy = {
  minBillableGuests: null,
  rentWaiverFoodThreshold: null,
  minimumSpend: null,
  advanceBasisPoints: 2_500,
};

describe('priceQuote (server-side pricing)', () => {
  it('prices the worked example to PKR 735,000 before concession', () => {
    const quote = priceQuote(WORKED_EXAMPLE_CATALOGUE, NO_RULES_POLICY);
    expect(quote.subtotal).toEqual(pkrRupees(735_000));
    expect(quote.total).toEqual(pkrRupees(735_000));
  });

  it('applies a staff-approved PKR 10,000 concession to reach PKR 725,000 with a PKR 181,250 advance', () => {
    const quote = priceQuote(WORKED_EXAMPLE_CATALOGUE, NO_RULES_POLICY, {
      amount: pkrRupees(10_000),
      approvedByUserId: 'manager-1',
    });
    expect(quote.total).toEqual(pkrRupees(725_000));
    expect(quote.advance).toEqual(pkrRupees(181_250));
    expect(quote.balance).toEqual(pkrRupees(543_750));
    expect(formatPkr(quote.total)).toBe('PKR 725,000');
    expect(quote.lines.map((line) => line.code)).toEqual([
      'CATERING',
      'VENUE_RENT',
      'STAGE',
      'EXTRA_AC',
      'APPROVED_CONCESSION',
    ]);
  });

  it('prices catering on guaranteed guests and never on chair count', () => {
    const quote = priceQuote(
      { ...WORKED_EXAMPLE_CATALOGUE, guestsRequested: 200 },
      NO_RULES_POLICY,
    );
    expect(quote.billableGuests).toBe(200);
    expect(quote.lines[0]?.amount).toEqual(pkrRupees(220_000));
  });

  it('applies the minimum headcount once, without also charging the requested count', () => {
    const quote = priceQuote(
      { ...WORKED_EXAMPLE_CATALOGUE, guestsRequested: 100 },
      { ...NO_RULES_POLICY, minBillableGuests: 150 },
    );
    expect(quote.billableGuests).toBe(150);
    expect(quote.lines[0]?.amount).toEqual(pkrRupees(165_000));
    expect(quote.lines[0]?.ruleCode).toBe('MIN_HEADCOUNT_APPLIED');
    expect(quote.subtotal).toEqual(pkrRupees(165_000 + 100_000 + 60_000 + 25_000));
  });

  it('waives hall rent when food spend reaches the threshold and charges it otherwise', () => {
    const waiverPolicy: QuotePolicy = {
      ...NO_RULES_POLICY,
      rentWaiverFoodThreshold: pkrRupees(500_000),
    };
    const waived = priceQuote(WORKED_EXAMPLE_CATALOGUE, waiverPolicy);
    expect(waived.lines.find((line) => line.code === 'VENUE_RENT')?.amount).toEqual(pkrRupees(0));
    expect(waived.lines.find((line) => line.code === 'VENUE_RENT')?.ruleCode).toBe('RENT_WAIVED');

    const charged = priceQuote({ ...WORKED_EXAMPLE_CATALOGUE, guestsRequested: 200 }, waiverPolicy);
    expect(charged.lines.find((line) => line.code === 'VENUE_RENT')?.amount).toEqual(
      pkrRupees(100_000),
    );
  });

  it('tops up to the minimum spend exactly once and never double counts the top-up', () => {
    const quote = priceQuote(
      { ...WORKED_EXAMPLE_CATALOGUE, guestsRequested: 50, stage: null, extras: [] },
      { ...NO_RULES_POLICY, minimumSpend: pkrRupees(300_000) },
    );
    // Catering 50 x 1,100 = 55,000; rent 100,000; subtotal 155,000; top-up 145,000 to 300,000.
    expect(quote.lines.find((line) => line.code === 'MINIMUM_SPEND_TOPUP')?.amount).toEqual(
      pkrRupees(145_000),
    );
    expect(quote.subtotal).toEqual(pkrRupees(300_000));
  });

  it('rejects a concession larger than the subtotal', () => {
    expect(() =>
      priceQuote(WORKED_EXAMPLE_CATALOGUE, NO_RULES_POLICY, {
        amount: pkrRupees(999_999),
        approvedByUserId: 'manager-1',
      }),
    ).toThrow(DomainError);
  });

  it('rejects a non-positive guest count', () => {
    expect(() =>
      priceQuote({ ...WORKED_EXAMPLE_CATALOGUE, guestsRequested: 0 }, NO_RULES_POLICY),
    ).toThrow(DomainError);
  });
});
