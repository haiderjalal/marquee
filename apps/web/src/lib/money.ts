import { formatPkr, fromMinorString } from '@marquee/domain';

/**
 * Formats a wire-format minor-unit string for display. The only money formatter
 * the UI uses; it never performs arithmetic.
 * @param minor Integer minor-unit decimal string from the API, such as "55000000".
 * @returns Display text such as "PKR 550,000", or an em dash when the value is malformed.
 */
export function formatMinor(minor: string): string {
  try {
    return formatPkr(fromMinorString(minor));
  } catch {
    return '—';
  }
}
