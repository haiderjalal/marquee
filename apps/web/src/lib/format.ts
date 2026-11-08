/** Locale used for dates throughout the product. */
const LOCALE = 'en-GB';

/** Timezone of the demo venues; local dates are interpreted in it. */
const VENUE_TIMEZONE = 'Asia/Karachi';

/**
 * Formats a YYYY-MM-DD local date as "12 Dec 2026" without timezone drift.
 * @param isoDate Local calendar date.
 * @returns Display text, or the input when it cannot be parsed.
 */
export function formatLocalDate(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) {
    return isoDate;
  }
  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return new Intl.DateTimeFormat(LOCALE, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

/**
 * Formats a UTC instant in the venue timezone, for example "Mon 14 Dec, 18:30".
 * @param instant ISO 8601 instant.
 * @returns Display text, or the input when it cannot be parsed.
 */
export function formatInstant(instant: string): string {
  const date = new Date(instant);
  if (Number.isNaN(date.getTime())) {
    return instant;
  }
  return new Intl.DateTimeFormat(LOCALE, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: VENUE_TIMEZONE,
  }).format(date);
}

/**
 * Formats a day for the staff header, for example "14 Dec 2026".
 * @param now Instant to format.
 * @returns Display text in the venue timezone.
 */
export function formatToday(now: Date): string {
  return new Intl.DateTimeFormat(LOCALE, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: VENUE_TIMEZONE,
  }).format(now);
}

/**
 * Chooses a greeting for the staff header from the hour in the venue timezone.
 * @param now Instant to evaluate.
 * @returns "Good morning", "Good afternoon" or "Good evening".
 */
export function greetingFor(now: Date): string {
  const hour = Number(
    new Intl.DateTimeFormat(LOCALE, {
      hour: '2-digit',
      hour12: false,
      timeZone: VENUE_TIMEZONE,
    }).format(now),
  );
  if (hour < 12) {
    return 'Good morning';
  }
  return hour < 17 ? 'Good afternoon' : 'Good evening';
}

/**
 * Converts millimetres to a metre label such as "8 m" or "3.5 m".
 * @param millimetres Length in millimetres.
 * @returns Display text.
 */
export function formatMetres(millimetres: number): string {
  const metres = millimetres / 1000;
  return `${Number.isInteger(metres) ? metres.toString() : metres.toFixed(1)} m`;
}

/**
 * Turns a snake_case or lowercase code into a readable label.
 * @param code Stable code such as "visit_scheduled".
 * @returns Capitalised words such as "Visit scheduled".
 */
export function humaniseCode(code: string): string {
  const text = code.replace(/[_-]+/g, ' ').trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Returns the venue-local calendar date (YYYY-MM-DD) of an instant.
 * @param instant ISO 8601 instant or Date.
 * @returns Local date string in the venue timezone.
 */
export function localDateOf(instant: string | Date): string {
  const date = typeof instant === 'string' ? new Date(instant) : instant;
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: VENUE_TIMEZONE,
  }).format(date);
}

/**
 * Adds whole days to a local calendar date without timezone drift.
 * @param isoDate Local date, YYYY-MM-DD.
 * @param days Days to add (may be negative).
 * @returns The resulting local date.
 */
export function addDaysToLocalDate(isoDate: string, days: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) {
    return isoDate;
  }
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + days));
  return date.toISOString().slice(0, 10);
}

/**
 * Formats a local date as a short weekday label such as "Mon 14".
 * @param isoDate Local date, YYYY-MM-DD.
 * @returns Weekday and day-of-month.
 */
export function formatDayHeader(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) {
    return isoDate;
  }
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return new Intl.DateTimeFormat(LOCALE, {
    weekday: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}
