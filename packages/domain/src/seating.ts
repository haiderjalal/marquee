import { DomainError } from './errors';

/** Upper bound for a single guest plan, a guard against accidental huge requests. */
export const MAX_REQUESTED_GUESTS = 5_000;

/** Seats per table offered by the configurator. */
export const SUPPORTED_SEATS_PER_TABLE = [5, 8, 10] as const;
export type SeatsPerTable = (typeof SUPPORTED_SEATS_PER_TABLE)[number];

/** Table counts for an exact guest request. Chairs always equal the requested guests. */
export interface SeatingPlan {
  readonly requestedGuests: number;
  readonly seatsPerTable: number;
  readonly tableCount: number;
  readonly chairCount: number;
  /** Seats occupied at the last table; equals seatsPerTable when the count divides evenly. */
  readonly seatsAtLastTable: number;
}

/**
 * Computes the exact table and chair counts for a guest request.
 *
 * Tables are `ceil(guests / seatsPerTable)`. Chairs equal the requested guests, so
 * the last table is partial when the count does not divide evenly. This is the
 * canonical count used by the layout engine, the quote and the event order. Chairs
 * are never inferred from the number of rated seats in a table template.
 *
 * @param requestedGuests Positive integer guest count.
 * @param seatsPerTable One of the supported table sizes.
 * @returns The seating plan.
 * @throws DomainError when the guest count or table size is invalid.
 */
export function planSeating(requestedGuests: number, seatsPerTable: number): SeatingPlan {
  if (!Number.isSafeInteger(requestedGuests) || requestedGuests < 1) {
    throw new DomainError('VALIDATION_FAILED', 'Guest count must be a positive whole number.');
  }
  if (requestedGuests > MAX_REQUESTED_GUESTS) {
    throw new DomainError(
      'VALIDATION_FAILED',
      `Guest count cannot exceed ${MAX_REQUESTED_GUESTS}.`,
    );
  }
  if (!isSupportedSeatsPerTable(seatsPerTable)) {
    throw new DomainError('VALIDATION_FAILED', 'Seats per table must be 5, 8 or 10.');
  }
  const tableCount = Math.ceil(requestedGuests / seatsPerTable);
  const remainder = requestedGuests % seatsPerTable;
  return {
    requestedGuests,
    seatsPerTable,
    tableCount,
    chairCount: requestedGuests,
    seatsAtLastTable: remainder === 0 ? seatsPerTable : remainder,
  };
}

/**
 * Type guard for the supported table sizes.
 * @param value Candidate seats-per-table value.
 * @returns True when the value is one of the supported sizes.
 */
export function isSupportedSeatsPerTable(value: number): value is SeatsPerTable {
  return (SUPPORTED_SEATS_PER_TABLE as readonly number[]).includes(value);
}
