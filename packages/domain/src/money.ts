import { DomainError } from './errors';

/**
 * Money is stored as integer minor units (paisa for PKR) in a bigint.
 * 1 PKR = 100 paisa, so PKR 1,100 is 110000n. Binary floating point is never
 * used for accounting; JSON carries the minor-unit value as a decimal string.
 */
export const SUPPORTED_CURRENCIES = ['PKR'] as const;
export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number];

/** Number of minor units in one major unit for every supported currency. */
export const MINOR_UNITS_PER_MAJOR = 100n;

/** Basis points denominator: 10,000 basis points equal 100 percent. */
const BASIS_POINTS_DENOMINATOR = 10_000n;

/** Immutable money value. Two Money values are comparable only with equal currency. */
export interface Money {
  readonly amountMinor: bigint;
  readonly currency: CurrencyCode;
}

/**
 * Creates a PKR amount from integer paisa.
 * @param amountMinor Integer paisa, may be negative for credits and adjustments.
 * @returns Money in PKR.
 */
export function pkrMinor(amountMinor: bigint): Money {
  return { amountMinor, currency: 'PKR' };
}

/**
 * Creates a PKR amount from whole rupees, the unit used in quotations and fixtures.
 * @param rupees Non-negative or negative whole rupees.
 * @returns Money in PKR.
 */
export function pkrRupees(rupees: number): Money {
  if (!Number.isSafeInteger(rupees)) {
    throw new DomainError('VALIDATION_FAILED', 'Rupee amounts must be whole numbers.');
  }
  return pkrMinor(BigInt(rupees) * MINOR_UNITS_PER_MAJOR);
}

/** Zero PKR. */
export const ZERO_PKR: Money = pkrMinor(0n);

/**
 * Adds two amounts of the same currency.
 * @param left First amount.
 * @param right Second amount.
 * @returns The sum.
 * @throws DomainError when currencies differ.
 */
export function addMoney(left: Money, right: Money): Money {
  assertSameCurrency(left, right);
  return pkrMinor(left.amountMinor + right.amountMinor);
}

/**
 * Subtracts the right amount from the left one.
 * @param left Minuend.
 * @param right Subtrahend.
 * @returns The difference, possibly negative.
 * @throws DomainError when currencies differ.
 */
export function subtractMoney(left: Money, right: Money): Money {
  assertSameCurrency(left, right);
  return pkrMinor(left.amountMinor - right.amountMinor);
}

/**
 * Multiplies an amount by a whole quantity (guests, chairs, units).
 * @param money Unit amount.
 * @param quantity Non-negative safe integer quantity.
 * @returns Extended amount.
 * @throws DomainError for fractional or negative quantities.
 */
export function multiplyMoney(money: Money, quantity: number): Money {
  if (!Number.isSafeInteger(quantity) || quantity < 0) {
    throw new DomainError('VALIDATION_FAILED', 'Quantity must be a non-negative whole number.');
  }
  return pkrMinor(money.amountMinor * BigInt(quantity));
}

/**
 * Sums a list of amounts that share the PKR currency.
 * @param amounts Amounts to add; an empty list yields zero.
 * @returns Total.
 */
export function sumMoney(amounts: readonly Money[]): Money {
  return amounts.reduce<Money>((total, amount) => addMoney(total, amount), ZERO_PKR);
}

/**
 * Calculates a percentage of a non-negative amount using round-half-up on minor units.
 * Example: 25 percent (2500 basis points) of PKR 725,000 = PKR 181,250 exactly.
 * @param money Non-negative base amount.
 * @param basisPoints Integer basis points between 0 and 10,000.
 * @returns The rounded share.
 * @throws DomainError for negative bases or out-of-range basis points.
 */
export function percentOfHalfUp(money: Money, basisPoints: number): Money {
  if (money.amountMinor < 0n) {
    throw new DomainError(
      'VALIDATION_FAILED',
      'A percentage can only be taken of a non-negative amount.',
    );
  }
  if (!Number.isSafeInteger(basisPoints) || basisPoints < 0 || basisPoints > 10_000) {
    throw new DomainError('VALIDATION_FAILED', 'Basis points must be an integer from 0 to 10000.');
  }
  const scaled = money.amountMinor * BigInt(basisPoints) + BASIS_POINTS_DENOMINATOR / 2n;
  return pkrMinor(scaled / BASIS_POINTS_DENOMINATOR);
}

/**
 * Parses a decimal rupee string such as "1100" or "1100.5" into minor units without floats.
 * @param text Decimal string with at most two fractional digits.
 * @returns Money in PKR.
 * @throws DomainError when the text is not a valid amount.
 */
export function parsePkrDecimal(text: string): Money {
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(text.trim());
  if (!match) {
    throw new DomainError(
      'VALIDATION_FAILED',
      'Amount must be a decimal number with at most two places.',
    );
  }
  const [, sign = '', whole = '0', fraction = ''] = match;
  const paisa = BigInt(whole) * MINOR_UNITS_PER_MAJOR + BigInt(fraction.padEnd(2, '0'));
  return pkrMinor(sign === '-' ? -paisa : paisa);
}

/**
 * Formats an amount for people: "PKR 725,000", or "PKR 725,000.50" when paisa exist.
 * Uses western digit grouping to match the quotation layout.
 * @param money Amount to format.
 * @returns Display string.
 */
export function formatPkr(money: Money): string {
  const negative = money.amountMinor < 0n;
  const absolute = negative ? -money.amountMinor : money.amountMinor;
  const rupees = absolute / MINOR_UNITS_PER_MAJOR;
  const paisa = absolute % MINOR_UNITS_PER_MAJOR;
  const grouped = rupees.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const body = paisa === 0n ? grouped : `${grouped}.${paisa.toString().padStart(2, '0')}`;
  return `${negative ? '-' : ''}PKR ${body}`;
}

/**
 * Converts money to the decimal-string wire format used by the API.
 * @param money Amount to serialise.
 * @returns Integer minor units as a string.
 */
export function toMinorString(money: Money): string {
  return money.amountMinor.toString();
}

/**
 * Restores money from the decimal-string wire format.
 * @param minor Integer minor units as a decimal string.
 * @returns Money in PKR.
 * @throws DomainError when the string is not an integer.
 */
export function fromMinorString(minor: string): Money {
  if (!/^-?\d+$/.test(minor)) {
    throw new DomainError('VALIDATION_FAILED', 'Minor-unit amounts must be integer strings.');
  }
  return pkrMinor(BigInt(minor));
}

/**
 * Guards arithmetic against mixed currencies.
 * @param left First amount.
 * @param right Second amount.
 * @throws DomainError when the currencies differ.
 */
function assertSameCurrency(left: Money, right: Money): void {
  // Typed as string on purpose: a Money value that came from JSON may carry any code.
  const leftCode: string = left.currency;
  if (leftCode !== right.currency) {
    throw new DomainError('VALIDATION_FAILED', 'Amounts must share a currency.');
  }
}
