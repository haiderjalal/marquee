import { DomainError } from './errors';

/** Lead lifecycle. A lead moves forward through these states; closed states are terminal. */
export const ENQUIRY_STATUSES = [
  'new',
  'contacted',
  'visit_scheduled',
  'qualified',
  'lost',
] as const;
export type EnquiryStatus = (typeof ENQUIRY_STATUSES)[number];

/** Allowed status transitions. Terminal states have no outgoing transitions. */
const ALLOWED_TRANSITIONS: Readonly<Record<EnquiryStatus, readonly EnquiryStatus[]>> = {
  new: ['contacted', 'lost'],
  contacted: ['visit_scheduled', 'qualified', 'lost'],
  visit_scheduled: ['contacted', 'qualified', 'lost'],
  qualified: ['lost'],
  lost: [],
};

/**
 * Reports whether a lead may move from one status to another.
 * @param from Current status.
 * @param to Requested status.
 * @returns True when the transition is allowed.
 */
export function canTransitionEnquiry(from: EnquiryStatus, to: EnquiryStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

/** Pakistani mobile number in canonical E.164 form, for example +923001234567. */
const PAKISTAN_MOBILE_E164 = /^\+923\d{9}$/;

/**
 * Normalises a Pakistani mobile number to E.164.
 * Accepts "03001234567", "+92 300 1234567", "0092-300-1234567" and similar.
 * @param input Raw phone text from a form or staff entry.
 * @returns Canonical +92 number.
 * @throws DomainError when the text is not a Pakistani mobile number.
 */
export function normalisePakistaniMobile(input: string): string {
  const digits = input.replace(/[\s()-]/g, '');
  let candidate: string;
  if (/^03\d{9}$/.test(digits)) {
    candidate = `+92${digits.slice(1)}`;
  } else if (/^00923\d{9}$/.test(digits)) {
    candidate = `+${digits.slice(2)}`;
  } else if (/^\+923\d{9}$/.test(digits)) {
    candidate = digits;
  } else {
    throw new DomainError(
      'VALIDATION_FAILED',
      'Enter a Pakistani mobile number such as 0300 1234567.',
    );
  }
  if (!PAKISTAN_MOBILE_E164.test(candidate)) {
    throw new DomainError(
      'VALIDATION_FAILED',
      'Enter a Pakistani mobile number such as 0300 1234567.',
    );
  }
  return candidate;
}

/** Purposes a visitor can state when making an enquiry. */
export const EVENT_TYPES = [
  'walima',
  'barat',
  'nikah',
  'mehndi',
  'valima',
  'corporate',
  'other',
] as const;
export type EventType = (typeof EVENT_TYPES)[number];
