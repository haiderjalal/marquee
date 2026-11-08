'use client';

import { createEnquirySchema } from '@marquee/contracts';
import { EVENT_TYPES, type EventType } from '@marquee/domain';
import { CheckCircle2 } from 'lucide-react';
import { useState, type SubmitEvent, type ReactNode } from 'react';

import { CONTROL_CLASSES, Field } from '@/components/forms/Field';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { EVENT_TYPE_LABELS, QUOTATION_NOTE } from '@/constants/labels';
import { submitEnquiry } from '@/lib/api/client';
import { ApiRequestError, friendlyErrorMessage, supportLine } from '@/lib/api/errors';
import { useDraftStore } from '@/store/draftStore';

/** Props for {@link EnquiryForm}. */
interface EnquiryFormProps {
  readonly venueSlug: string;
  /** One-line summary of the configuration, sent as the enquiry message. */
  readonly configurationSummary: string;
}

/** Receipt shown after a successful submission. */
interface Receipt {
  readonly reference: string;
  readonly message: string;
}

/** Field errors keyed by form field name. */
type FieldErrors = Readonly<Record<string, string>>;

/** Maximum characters for the optional note, leaving room for the summary. */
const NOTE_MAX = 400;

/**
 * Narrows a select value to an event type.
 * @param value Raw option value.
 * @returns The event type, or null.
 */
function toEventType(value: string): EventType | null {
  return EVENT_TYPES.find((type) => type === value) ?? null;
}

/**
 * Booking request form. Validates with the shared Zod schema before sending, then
 * shows server field errors if the API disagrees. Submitting never reserves a date.
 *
 * @param props Venue slug and the configuration summary text.
 * @returns The form, or the receipt after success.
 */
export function EnquiryForm({ venueSlug, configurationSummary }: EnquiryFormProps): ReactNode {
  const guests = useDraftStore((state) => state.guests);
  const eventType = useDraftStore((state) => state.eventType);
  const eventDate = useDraftStore((state) => state.eventDate);
  const setEventType = useDraftStore((state) => state.setEventType);
  const setEventDate = useDraftStore((state) => state.setEventDate);
  const resetDraft = useDraftStore((state) => state.resetDraft);
  const [fullName, setFullName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [note, setNote] = useState('');
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<unknown>(null);
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);

  /**
   * Validates and submits the enquiry.
   * @param event Form submit event.
   */
  async function handleSubmit(event: SubmitEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSubmitError(null);
    const trimmedNote = note.trim();
    const candidate = {
      venueSlug,
      fullName,
      mobile,
      ...(email.trim() ? { email: email.trim() } : {}),
      eventType,
      preferredDate: eventDate ?? '',
      guestsExpected: guests,
      message: trimmedNote ? `${configurationSummary}\nNote: ${trimmedNote}` : configurationSummary,
      consentToContact: consent,
    };
    const parsed = createEnquirySchema.safeParse(candidate);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? 'form');
        next[key] ??= issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      setReceipt(await submitEnquiry(parsed.data));
    } catch (error) {
      if (error instanceof ApiRequestError && error.fieldErrors.length > 0) {
        const next: Record<string, string> = {};
        for (const item of error.fieldErrors) {
          next[item.field] ??= item.message;
        }
        setErrors(next);
      }
      setSubmitError(error);
    } finally {
      setSubmitting(false);
    }
  }

  if (receipt) {
    return (
      <section
        id="request"
        aria-labelledby="receipt-heading"
        className="rounded-2xl border border-line bg-surface p-6 shadow-card"
      >
        <CheckCircle2 className="size-8 text-sage-ink" aria-hidden="true" />
        <h2 id="receipt-heading" className="mt-2 text-3xl">
          Request received
        </h2>
        <p className="mt-2">
          Your reference is <strong className="font-mono">{receipt.reference}</strong>.
        </p>
        <p className="mt-1 text-ink-muted">
          Our team will contact you. Your date is reserved only after confirmation.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <ButtonLink href="/" variant="secondary">
            Back to venues
          </ButtonLink>
          <Button
            variant="ghost"
            onClick={() => {
              resetDraft();
            }}
          >
            Start a new plan
          </Button>
        </div>
      </section>
    );
  }

  const errorList = Object.entries(errors);
  return (
    <section
      id="request"
      aria-labelledby="request-heading"
      className="rounded-2xl border border-line bg-surface p-6 shadow-card"
    >
      <h2 id="request-heading" tabIndex={-1} className="text-3xl outline-none">
        Request booking
      </h2>
      <p className="mt-1 text-sm text-ink-muted">{QUOTATION_NOTE}</p>
      <form
        noValidate
        onSubmit={(event) => {
          void handleSubmit(event);
        }}
        className="mt-5 grid gap-4 sm:grid-cols-2"
      >
        {errorList.length > 0 ? (
          <Notice tone="error" className="sm:col-span-2">
            <p className="font-medium">Please check these details.</p>
            <ul className="mt-1 list-disc pl-5">
              {errorList.map(([field, message]) => (
                <li key={field}>{message}</li>
              ))}
            </ul>
          </Notice>
        ) : null}
        <Field id="enq-name" label="Full name" required error={errors.fullName}>
          {(props) => (
            <input
              {...props}
              type="text"
              autoComplete="name"
              value={fullName}
              onChange={(e) => {
                setFullName(e.target.value);
              }}
              className={CONTROL_CLASSES}
            />
          )}
        </Field>
        <Field
          id="enq-mobile"
          label="Mobile number"
          required
          hint="For example 0300 1234567"
          error={errors.mobile}
        >
          {(props) => (
            <input
              {...props}
              type="tel"
              autoComplete="tel"
              value={mobile}
              onChange={(e) => {
                setMobile(e.target.value);
              }}
              className={CONTROL_CLASSES}
            />
          )}
        </Field>
        <Field id="enq-email" label="Email (optional)" error={errors.email}>
          {(props) => (
            <input
              {...props}
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
              }}
              className={CONTROL_CLASSES}
            />
          )}
        </Field>
        <Field id="enq-type" label="Event type" required error={errors.eventType}>
          {(props) => (
            <select
              {...props}
              value={eventType}
              onChange={(e) => {
                const next = toEventType(e.target.value);
                if (next) {
                  setEventType(next);
                }
              }}
              className={CONTROL_CLASSES}
            >
              {EVENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {EVENT_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field
          id="enq-date"
          label="Preferred date"
          required
          error={errors.preferredDate}
          hint="Confirmed by our team, not reserved."
        >
          {(props) => (
            <input
              {...props}
              type="date"
              value={eventDate ?? ''}
              onChange={(e) => {
                setEventDate(e.target.value || null);
              }}
              className={CONTROL_CLASSES}
            />
          )}
        </Field>
        <p className="self-end pb-2 text-sm text-ink-muted">Guests: {guests} (from your plan)</p>
        <Field
          id="enq-note"
          label="Note for our team (optional)"
          className="sm:col-span-2"
          error={errors.message}
        >
          {(props) => (
            <textarea
              {...props}
              rows={3}
              maxLength={NOTE_MAX}
              value={note}
              onChange={(e) => {
                setNote(e.target.value);
              }}
              className={CONTROL_CLASSES}
            />
          )}
        </Field>
        <div className="sm:col-span-2">
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={consent}
              aria-invalid={errors.consentToContact !== undefined}
              aria-describedby={errors.consentToContact ? 'enq-consent-error' : undefined}
              onChange={(e) => {
                setConsent(e.target.checked);
              }}
              className="mt-1 size-5 accent-accent"
            />
            <span>I agree that Event Studio may contact me about this enquiry.</span>
          </label>
          {errors.consentToContact ? (
            <p id="enq-consent-error" className="mt-1 text-sm text-danger">
              {errors.consentToContact}
            </p>
          ) : null}
        </div>
        {submitError ? (
          <Notice tone="error" className="sm:col-span-2">
            <p>{friendlyErrorMessage(submitError)}</p>
            {supportLine(submitError) ? (
              <p className="mt-1 text-xs">{supportLine(submitError)}</p>
            ) : null}
          </Notice>
        ) : null}
        <div className="sm:col-span-2">
          <Button
            type="submit"
            variant="accent"
            size="lg"
            disabled={submitting}
            className="w-full sm:w-auto"
          >
            {submitting ? 'Sending…' : 'Send booking request'}
          </Button>
        </div>
      </form>
    </section>
  );
}
