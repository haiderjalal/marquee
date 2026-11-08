import {
  ENQUIRY_STATUSES,
  EVENT_TYPES,
  isSupportedSeatsPerTable,
  MAX_REQUESTED_GUESTS,
  normalisePakistaniMobile,
} from '@marquee/domain';
import { z } from 'zod';

/**
 * Runtime input schemas for every public and staff command. Each schema is the
 * single validation point for its endpoint; handlers never re-implement these
 * rules. Unknown keys are rejected so clients cannot smuggle totals, discounts
 * or tenant identifiers into a command.
 */

/** URL-safe venue identifier used in public routes. Slugs are display keys, never authorisation. */
export const venueSlugSchema = z
  .string()
  .min(2)
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Venue slug must be lowercase words separated by hyphens.');

/** Whole-number guest count within the platform guard limit. */
export const guestCountSchema = z
  .int('Guest count must be a whole number.')
  .min(1, 'Enter at least one guest.')
  .max(MAX_REQUESTED_GUESTS, `Guest count cannot exceed ${MAX_REQUESTED_GUESTS}.`);

/** Supported table sizes from the configurator. */
export const seatsPerTableSchema = z
  .int()
  .refine(isSupportedSeatsPerTable, 'Seats per table must be 5, 8 or 10.');

/** Identifier of a catalogue item (package, stage, extra) within the venue's approved catalogue. */
export const catalogueIdSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9][a-z0-9-]*$/);

/** Calendar date in the venue's local timezone, formatted YYYY-MM-DD. */
export const localDateSchema = z.iso.date();

/** Instant in UTC, formatted as ISO 8601 with a timezone designator. */
export const utcInstantSchema = z.iso.datetime({ offset: true });

/** Money on the wire: integer minor units as a decimal string. */
export const minorAmountSchema = z
  .string()
  .regex(/^-?\d+$/, 'Amounts are integer minor-unit strings.');

/** Public enquiry from the venue website or a visitor form. */
export const createEnquirySchema = z
  .strictObject({
    venueSlug: venueSlugSchema,
    fullName: z.string().trim().min(2, 'Enter your full name.').max(120),
    mobile: z
      .string()
      .trim()
      .transform((value, context) => {
        try {
          return normalisePakistaniMobile(value);
        } catch {
          context.addIssue({
            code: 'custom',
            message: 'Enter a Pakistani mobile number such as 0300 1234567.',
          });
          return z.NEVER;
        }
      }),
    email: z.email('Enter a valid email address.').max(254).optional(),
    eventType: z.enum(EVENT_TYPES),
    preferredDate: localDateSchema,
    guestsExpected: guestCountSchema,
    message: z.string().trim().max(1000).optional(),
    consentToContact: z.literal(true, {
      error: 'Please confirm we may contact you about this enquiry.',
    }),
  })
  .meta({ title: 'CreateEnquiry' });

export type CreateEnquiryInput = z.infer<typeof createEnquirySchema>;

/** Layout validation request: the customer's counts and template, never the seat totals. */
export const configurationValidateSchema = z
  .strictObject({
    venueSlug: venueSlugSchema,
    requestedGuests: guestCountSchema,
    seatsPerTable: seatsPerTableSchema,
    /** Stage preset to check against the seating; null checks the seating alone. */
    stageId: catalogueIdSchema.nullable().default(null),
  })
  .meta({ title: 'ConfigurationValidate' });

export type ConfigurationValidateInput = z.infer<typeof configurationValidateSchema>;

/** Non-binding quote preview. The server prices every line from approved catalogue versions. */
export const quotePreviewSchema = z
  .strictObject({
    venueSlug: venueSlugSchema,
    requestedGuests: guestCountSchema,
    seatsPerTable: seatsPerTableSchema,
    packageId: catalogueIdSchema,
    stageId: catalogueIdSchema.nullable(),
    extras: z
      .array(
        z.strictObject({
          code: catalogueIdSchema,
          quantity: z.int().min(0).max(100),
        }),
      )
      .max(20),
  })
  .meta({ title: 'QuotePreview' });

export type QuotePreviewInput = z.infer<typeof quotePreviewSchema>;

/**
 * Staff request to place a temporary hold on one physical space for an interval.
 * Times are UTC instants; the server expands them with setup and teardown.
 */
export const createHoldSchema = z
  .strictObject({
    spaceId: z.uuid(),
    startsAt: utcInstantSchema,
    endsAt: utcInstantSchema,
    setupMinutes: z.int().min(0).max(720),
    teardownMinutes: z.int().min(0).max(720),
    ttlMinutes: z.int().min(5).max(1440),
    enquiryId: z.uuid().nullable(),
  })
  .meta({ title: 'CreateHold' });

export type CreateHoldInput = z.infer<typeof createHoldSchema>;

/** Staff lead-status change. The revision guards against overwriting a colleague's edit. */
export const changeEnquiryStatusSchema = z
  .strictObject({
    status: z.enum(ENQUIRY_STATUSES),
    expectedRevision: z.int().min(1),
  })
  .meta({ title: 'ChangeEnquiryStatus' });

export type ChangeEnquiryStatusInput = z.infer<typeof changeEnquiryStatusSchema>;

/** Query for listing recent enquiries. */
export const listLimitQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

/** Optional first day of the staff schedule window, as a venue-local calendar date. */
export const staffOverviewQuerySchema = z.object({
  from: localDateSchema.optional(),
});
