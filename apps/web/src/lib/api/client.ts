import type {
  ConfigurationValidateInput,
  ConfigurationValidationDto,
  CreateEnquiryInput,
  EnquiryReceiptDto,
  QuotePreviewDto,
  QuotePreviewInput,
} from '@marquee/contracts';

import { browserApiBase } from '@/lib/env.public';

import { isConfigurationValidation, isEnquiryReceipt, isQuotePreview } from './guards';
import { requestJson } from './http';

/**
 * Asks the server to validate the seating plan for a guest count.
 * @param input Venue slug, requested guests and seats per table.
 * @param signal Cancels a superseded request.
 * @returns Server counts and placements, or a refusal with capacity.
 * @throws ApiRequestError on transport or contract failures.
 */
export function validateConfiguration(
  input: ConfigurationValidateInput,
  signal?: AbortSignal,
): Promise<ConfigurationValidationDto> {
  return requestJson(`${browserApiBase()}/public/configurations/validate`, {
    method: 'POST',
    body: input,
    guard: isConfigurationValidation,
    ...(signal ? { signal } : {}),
  });
}

/**
 * Requests a server-priced, non-binding quote preview.
 * @param input Configuration selections; the server ignores any client totals.
 * @param signal Cancels a superseded request.
 * @returns The estimate lines and totals priced by the server.
 * @throws ApiRequestError, including LAYOUT_DOES_NOT_FIT (409).
 */
export function fetchQuotePreview(
  input: QuotePreviewInput,
  signal?: AbortSignal,
): Promise<QuotePreviewDto> {
  return requestJson(`${browserApiBase()}/public/quotes/preview`, {
    method: 'POST',
    body: input,
    guard: isQuotePreview,
    ...(signal ? { signal } : {}),
  });
}

/**
 * Submits a customer enquiry. This never reserves a date.
 * @param input Parsed enquiry fields.
 * @returns The receipt with the enquiry reference.
 * @throws ApiRequestError, including VALIDATION_FAILED with field errors and rate limiting.
 */
export function submitEnquiry(input: CreateEnquiryInput): Promise<EnquiryReceiptDto> {
  return requestJson(`${browserApiBase()}/public/enquiries`, {
    method: 'POST',
    body: input,
    guard: isEnquiryReceipt,
  });
}
