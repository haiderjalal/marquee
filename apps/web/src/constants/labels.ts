import type { EventType, SeatsPerTable } from '@marquee/domain';

/** Customer-facing labels for event types. */
export const EVENT_TYPE_LABELS: Readonly<Record<EventType, string>> = {
  walima: 'Walima',
  barat: 'Barat',
  nikah: 'Nikah',
  mehndi: 'Mehndi',
  valima: 'Valima',
  corporate: 'Corporate event',
  other: 'Other celebration',
};

/** Shown wherever demo catalogue data or fictional venues appear. */
export const DEMO_DATA_NOTICE = 'Demonstration data — fictional venues and prices';

/** Shown when the draft is held only in this browser. */
export const DRAFT_LABEL = 'Draft in this browser';

/** Honest helper text for the discovery search bar. */
export const AVAILABILITY_HELPER = 'Availability is confirmed when you request a booking.';

/** Quotation reminder required on the review step and receipt. */
export const QUOTATION_NOTE = 'This is a quotation. Your date is reserved only after confirmation.';

/** Seats-per-table options offered by the configurator (mirrors the domain constant). */
export const SEATS_PER_TABLE_OPTIONS = [5, 8, 10] as const satisfies readonly SeatsPerTable[];
