'use client';

import type { QuotePreviewDto, QuotePreviewInput } from '@marquee/contracts';

import { fetchQuotePreview } from '@/lib/api/client';

import { useDebouncedRequest, type RequestState } from './useDebouncedRequest';

/** Debounce for quote previews. */
const QUOTE_DEBOUNCE_MS = 250;

/**
 * Requests a server-priced estimate for the current selections.
 * @param input Selections, or null to stay idle (for example before a package is chosen).
 * @returns Request state holding the server quote; totals are never computed locally.
 */
export function useQuotePreview(input: QuotePreviewInput | null): RequestState<QuotePreviewDto> {
  return useDebouncedRequest(input, fetchQuotePreview, QUOTE_DEBOUNCE_MS);
}
