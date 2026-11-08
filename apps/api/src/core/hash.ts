import { createHash } from 'node:crypto';

/**
 * Serialises a JSON-compatible value deterministically: object keys are sorted at every
 * level and bigint values become decimal strings. Two equal values always produce the
 * same text, which makes it safe to hash for idempotency and content approval.
 *
 * @param value Value to serialise.
 * @returns Canonical JSON text.
 */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeys(value), (_key, nested: unknown) =>
    typeof nested === 'bigint' ? nested.toString() : nested,
  );
}

/**
 * Hashes text with SHA-256 and returns lowercase hexadecimal.
 * @param text Input text.
 * @returns 64-character hex digest.
 */
export function sha256Hex(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

/**
 * Recursively copies objects with sorted keys. Arrays keep their order.
 * @param value Any value.
 * @returns A structurally equal value with sorted object keys.
 */
function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item: unknown) => sortKeys(item));
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
        .map(([key, nested]) => [key, sortKeys(nested)]),
    );
  }
  return value;
}
