/**
 * Joins class names, skipping falsy entries.
 * @param parts Class strings or falsy placeholders.
 * @returns A single space-separated class string.
 */
export function cn(...parts: readonly (string | false | null | undefined)[]): string {
  return parts
    .filter((part): part is string => typeof part === 'string' && part.length > 0)
    .join(' ');
}
