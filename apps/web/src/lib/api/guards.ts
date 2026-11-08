import type {
  ConfigurationValidationDto,
  EnquiryReceiptDto,
  EnquiryStatusDto,
  ScheduleHoldDto,
  StaffOverviewDto,
  PublicVenueDetailDto,
  PublicVenueSummaryDto,
  QuotePreviewDto,
  StaffEnquiryDto,
} from '@marquee/contracts';

/**
 * Runtime guards for API responses. They check the fields the UI depends on so a
 * malformed or mismatched payload becomes a controlled error instead of a crash.
 * They are intentionally shallow: the API owns full validation.
 */

/**
 * Narrows an unknown value to a plain object.
 * @param value Candidate value.
 * @returns True for non-null, non-array objects.
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Checks that every listed key holds a string.
 * @param record Object to inspect.
 * @param keys Keys that must be strings.
 * @returns True when all are strings.
 */
export function hasStrings(record: Record<string, unknown>, keys: readonly string[]): boolean {
  return keys.every((key) => typeof record[key] === 'string');
}

/**
 * Checks that every listed key holds a finite number.
 * @param record Object to inspect.
 * @param keys Keys that must be numbers.
 * @returns True when all are finite numbers.
 */
export function hasNumbers(record: Record<string, unknown>, keys: readonly string[]): boolean {
  return keys.every((key) => typeof record[key] === 'number' && Number.isFinite(record[key]));
}

/**
 * Checks that a value is an array whose items all satisfy a predicate.
 * @param value Candidate array.
 * @param predicate Item check.
 * @returns True when the value is an array of matching items.
 */
export function isArrayOf<T>(
  value: unknown,
  predicate: (item: unknown) => item is T,
): value is T[] {
  return Array.isArray(value) && value.every((item) => predicate(item));
}

/**
 * Guard for a published venue card.
 * @param value Candidate value.
 * @returns True when it has the venue summary fields the UI renders.
 */
export function isVenueSummary(value: unknown): value is PublicVenueSummaryDto {
  return (
    isRecord(value) &&
    hasStrings(value, ['slug', 'name', 'tagline']) &&
    hasNumbers(value, ['publishedCapacityGuests']) &&
    typeof value.indoor === 'boolean' &&
    Array.isArray(value.facilities) &&
    Array.isArray(value.spaces)
  );
}

/**
 * Guard for venue detail including the catalogue.
 * @param value Candidate value.
 * @returns True when summary fields and catalogue arrays are present.
 */
export function isVenueDetail(value: unknown): value is PublicVenueDetailDto {
  return (
    isVenueSummary(value) &&
    isRecord(value) &&
    Array.isArray(value.stages) &&
    Array.isArray(value.menuPackages) &&
    Array.isArray(value.extras) &&
    typeof value.disclaimer === 'string'
  );
}

/**
 * Guard for the layout validation result (both ok and refusal shapes).
 * @param value Candidate value.
 * @returns True when the discriminant and the fields of that branch are present.
 */
export function isConfigurationValidation(value: unknown): value is ConfigurationValidationDto {
  if (!isRecord(value) || typeof value.ok !== 'boolean') {
    return false;
  }
  if (value.ok) {
    return (
      hasStrings(value, ['shellVersionId', 'templateId', 'contentHash']) &&
      hasNumbers(value, ['seatsPerTable', 'requestedGuests', 'tableCount', 'chairCount']) &&
      Array.isArray(value.placements)
    );
  }
  return (
    typeof value.message === 'string' &&
    isRecord(value.capacity) &&
    hasNumbers(value.capacity, ['maxGuests', 'maxTables'])
  );
}

/**
 * Guard for the quote preview.
 * @param value Candidate value.
 * @returns True when totals and lines are present.
 */
export function isQuotePreview(value: unknown): value is QuotePreviewDto {
  return (
    isRecord(value) &&
    hasStrings(value, ['total', 'advance', 'balance', 'subtotal', 'note']) &&
    hasNumbers(value, ['billableGuests', 'advancePercent']) &&
    Array.isArray(value.lines) &&
    value.lines.every((line) => isRecord(line) && hasStrings(line, ['code', 'label', 'amount']))
  );
}

/**
 * Guard for the enquiry receipt.
 * @param value Candidate value.
 * @returns True when a reference and message are present.
 */
export function isEnquiryReceipt(value: unknown): value is EnquiryReceiptDto {
  return isRecord(value) && hasStrings(value, ['reference', 'message']);
}

/**
 * Guard for one staff enquiry row.
 * @param value Candidate value.
 * @returns True when the displayed fields are present.
 */
export function isStaffEnquiry(value: unknown): value is StaffEnquiryDto {
  return (
    isRecord(value) &&
    hasStrings(value, [
      'id',
      'reference',
      'status',
      'venueName',
      'fullName',
      'mobile',
      'eventType',
      'preferredDate',
      'createdAt',
    ]) &&
    hasNumbers(value, ['guestsExpected', 'revision'])
  );
}

/**
 * Guard for one schedule hold.
 * @param value Candidate value.
 * @returns True when the fields the schedule renders are present.
 */
export function isScheduleHold(value: unknown): value is ScheduleHoldDto {
  return (
    isRecord(value) &&
    hasStrings(value, [
      'id',
      'status',
      'spaceId',
      'spaceName',
      'venueName',
      'occupiedFrom',
      'occupiedUntil',
    ]) &&
    (value.enquiryFullName === null || typeof value.enquiryFullName === 'string')
  );
}

/**
 * Guard for the staff overview.
 * @param value Candidate value.
 * @returns True when window, KPIs, schedule and attention blocks are present.
 */
export function isStaffOverview(value: unknown): value is StaffOverviewDto {
  return (
    isRecord(value) &&
    typeof value.generatedAt === 'string' &&
    isRecord(value.window) &&
    hasStrings(value.window, ['fromIso', 'toIso']) &&
    hasNumbers(value.window, ['days']) &&
    isRecord(value.kpis) &&
    hasNumbers(value.kpis, ['upcomingEvents', 'newEnquiries']) &&
    isRecord(value.attention) &&
    hasNumbers(value.attention, ['holdsExpiringToday', 'newEnquiries']) &&
    isArrayOf(value.schedule, isScheduleHold)
  );
}

/**
 * Guard for the result of a status change.
 * @param value Candidate value.
 * @returns True when id, status and revision are present.
 */
export function isEnquiryStatus(value: unknown): value is EnquiryStatusDto {
  return isRecord(value) && hasStrings(value, ['id', 'status']) && hasNumbers(value, ['revision']);
}
