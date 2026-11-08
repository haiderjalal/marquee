import { DomainError } from './errors';
import {
  addMoney,
  formatPkr,
  multiplyMoney,
  type Money,
  percentOfHalfUp,
  pkrMinor,
  subtractMoney,
  sumMoney,
  ZERO_PKR,
} from './money';

/**
 * Commercial pricing for one event quote.
 *
 * Every price here is resolved on the server from approved catalogue versions.
 * The browser submits choices (guest count, package, stage, extras) and never a
 * total, rate or discount. Minimum headcount, rent waiver and minimum spend are
 * independent typed strategies; each one is applied once and is shown as an
 * explanation code so the quotation can state the rule that changed a line.
 */

/** Explanation codes attached to quote lines and shown to staff and customers. */
export const PRICING_RULE_CODES = [
  'MIN_HEADCOUNT_APPLIED',
  'RENT_WAIVED',
  'MINIMUM_SPEND_TOPUP',
  'APPROVED_CONCESSION',
  'ADVANCE_PERCENT',
] as const;
export type PricingRuleCode = (typeof PRICING_RULE_CODES)[number];

/** Basis points for the standard advance: 25 percent. */
export const DEMO_ADVANCE_BASIS_POINTS = 2_500;

/** Catalogue inputs for one quote. Amounts are minor units already resolved from approved versions. */
export interface QuoteCatalogueInput {
  readonly guestsRequested: number;
  readonly menu: {
    readonly packageVersionId: string;
    readonly packageName: string;
    readonly pricePerGuest: Money;
  };
  readonly space: {
    readonly spaceName: string;
    readonly rent: Money;
  };
  readonly stage: { readonly stageName: string; readonly price: Money } | null;
  readonly extras: readonly {
    readonly code: string;
    readonly label: string;
    readonly unitPrice: Money;
    readonly quantity: number;
  }[];
}

/** Policy knobs configured per venue and effective date. */
export interface QuotePolicy {
  /** Minimum billable adults regardless of attendance. Null disables the rule. */
  readonly minBillableGuests: number | null;
  /** When food spend reaches this amount the hall rent is waived. Null disables waiver. */
  readonly rentWaiverFoodThreshold: Money | null;
  /** Minimum total spend before tax. A top-up line closes any shortfall. Null disables it. */
  readonly minimumSpend: Money | null;
  /** Advance percentage in basis points. */
  readonly advanceBasisPoints: number;
}

/** Staff-approved concession. Only the server accepts one; public previews never carry it. */
export interface ApprovedConcession {
  readonly amount: Money;
  readonly approvedByUserId: string;
}

/** One priced line on the quotation. */
export interface QuoteLine {
  readonly code: string;
  readonly label: string;
  readonly quantity: number;
  readonly amount: Money;
  readonly ruleCode: PricingRuleCode | null;
}

/** Complete priced quote before tax. Tax lines are added by a later, jurisdiction-specific policy. */
export interface PricedQuote {
  readonly lines: readonly QuoteLine[];
  readonly subtotal: Money;
  readonly concession: Money;
  readonly total: Money;
  readonly advance: Money;
  readonly balance: Money;
  readonly billableGuests: number;
}

/**
 * Prices a quote from catalogue inputs and venue policy.
 *
 * Order of evaluation (each step is applied once):
 * 1. Billable guests = max(requested, minimum headcount).
 * 2. Food = billable guests x price per guest.
 * 3. Space rent, waived when food reaches the waiver threshold.
 * 4. Stage and extras at their approved unit prices.
 * 5. Minimum-spend top-up closes any shortfall below the minimum spend.
 * 6. Approved concession (staff only) is subtracted; it cannot exceed the subtotal.
 * 7. Advance = percentage of the total, rounded half-up on minor units.
 *
 * @param catalogue Resolved catalogue inputs.
 * @param policy Venue commercial policy.
 * @param concession Optional staff-approved concession.
 * @returns The priced quote.
 * @throws DomainError when inputs are invalid or a concession exceeds the subtotal.
 */
export function priceQuote(
  catalogue: QuoteCatalogueInput,
  policy: QuotePolicy,
  concession: ApprovedConcession | null = null,
): PricedQuote {
  const requested = catalogue.guestsRequested;
  if (!Number.isSafeInteger(requested) || requested < 1) {
    throw new DomainError('VALIDATION_FAILED', 'Guest count must be a positive whole number.');
  }

  const billableGuests = applyMinimumHeadcount(requested, policy.minBillableGuests);
  const lines: QuoteLine[] = [];

  const food = multiplyMoney(catalogue.menu.pricePerGuest, billableGuests);
  lines.push({
    code: 'CATERING',
    label: `${catalogue.menu.packageName} · ${billableGuests} guests`,
    quantity: billableGuests,
    amount: food,
    ruleCode: billableGuests > requested ? 'MIN_HEADCOUNT_APPLIED' : null,
  });

  const rent = applyRentWaiver(catalogue.space.rent, food, policy.rentWaiverFoodThreshold);
  lines.push({
    code: 'VENUE_RENT',
    label: `Venue rental · ${catalogue.space.spaceName}`,
    quantity: 1,
    amount: rent,
    ruleCode:
      rent.amountMinor === 0n && catalogue.space.rent.amountMinor !== 0n ? 'RENT_WAIVED' : null,
  });

  if (catalogue.stage) {
    lines.push({
      code: 'STAGE',
      label: `${catalogue.stage.stageName} stage`,
      quantity: 1,
      amount: catalogue.stage.price,
      ruleCode: null,
    });
  }

  for (const extra of catalogue.extras) {
    if (extra.quantity === 0) {
      continue;
    }
    lines.push({
      code: `EXTRA_${extra.code}`,
      label: extra.label,
      quantity: extra.quantity,
      amount: multiplyMoney(extra.unitPrice, extra.quantity),
      ruleCode: null,
    });
  }

  const beforeTopUp = sumMoney(lines.map((line) => line.amount));
  const topUp = minimumSpendTopUp(beforeTopUp, policy.minimumSpend);
  if (topUp.amountMinor > 0n) {
    lines.push({
      code: 'MINIMUM_SPEND_TOPUP',
      label: 'Minimum spend adjustment',
      quantity: 1,
      amount: topUp,
      ruleCode: 'MINIMUM_SPEND_TOPUP',
    });
  }

  const subtotal = sumMoney(lines.map((line) => line.amount));
  const appliedConcession = concession ? validateConcession(concession, subtotal) : ZERO_PKR;
  if (appliedConcession.amountMinor > 0n) {
    lines.push({
      code: 'APPROVED_CONCESSION',
      label: 'Approved concession',
      quantity: 1,
      amount: pkrMinor(-appliedConcession.amountMinor),
      ruleCode: 'APPROVED_CONCESSION',
    });
  }

  const total = subtractMoney(subtotal, appliedConcession);
  const advance = percentOfHalfUp(total, policy.advanceBasisPoints);
  return {
    lines,
    subtotal,
    concession: appliedConcession,
    total,
    advance,
    balance: subtractMoney(total, advance),
    billableGuests,
  };
}

/**
 * Applies the minimum-headcount strategy.
 * @param requested Guests requested by the customer.
 * @param minimum Minimum billable adults, or null when the venue has none.
 * @returns Billable guests.
 */
function applyMinimumHeadcount(requested: number, minimum: number | null): number {
  if (minimum === null) {
    return requested;
  }
  if (!Number.isSafeInteger(minimum) || minimum < 1) {
    throw new DomainError(
      'VALIDATION_FAILED',
      'Minimum billable guests must be a positive whole number.',
    );
  }
  return Math.max(requested, minimum);
}

/**
 * Applies the hall-rent waiver strategy.
 * @param rent Configured hall rent.
 * @param food Food amount after headcount rules.
 * @param threshold Food amount that triggers the waiver, or null when waiver is disabled.
 * @returns Rent to charge (zero when waived).
 */
function applyRentWaiver(rent: Money, food: Money, threshold: Money | null): Money {
  if (threshold === null) {
    return rent;
  }
  return food.amountMinor >= threshold.amountMinor ? ZERO_PKR : rent;
}

/**
 * Calculates the top-up needed to reach the minimum spend.
 * @param spendBeforeTopUp Subtotal before any top-up.
 * @param minimumSpend Required minimum, or null when disabled.
 * @returns Top-up amount, zero when the minimum is already met.
 */
function minimumSpendTopUp(spendBeforeTopUp: Money, minimumSpend: Money | null): Money {
  if (minimumSpend === null || spendBeforeTopUp.amountMinor >= minimumSpend.amountMinor) {
    return ZERO_PKR;
  }
  return subtractMoney(minimumSpend, spendBeforeTopUp);
}

/**
 * Checks a staff concession against the subtotal it reduces.
 * @param concession Concession to apply.
 * @param subtotal Subtotal before the concession.
 * @returns The validated concession amount.
 * @throws DomainError for negative or oversized concessions.
 */
function validateConcession(concession: ApprovedConcession, subtotal: Money): Money {
  if (concession.amount.amountMinor < 0n) {
    throw new DomainError('POLICY_BLOCKED', 'A concession cannot be negative.');
  }
  if (concession.amount.amountMinor > subtotal.amountMinor) {
    throw new DomainError(
      'POLICY_BLOCKED',
      `A concession of ${formatPkr(concession.amount)} exceeds the quoted subtotal.`,
    );
  }
  return concession.amount;
}

/**
 * Returns the sum of a list of already-priced lines, used to verify a stored quote.
 * @param lines Priced lines.
 * @returns Their total.
 */
export function totalOfLines(lines: readonly QuoteLine[]): Money {
  return lines.reduce<Money>((total, line) => addMoney(total, line.amount), ZERO_PKR);
}
