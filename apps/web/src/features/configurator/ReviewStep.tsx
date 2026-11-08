'use client';

import { CalendarDays, Info, Tent, UsersRound } from 'lucide-react';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';

import { Button, ButtonLink } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { PhotoPlaceholder } from '@/components/ui/PhotoPlaceholder';
import { DEMO_DATA_NOTICE, EVENT_TYPE_LABELS, QUOTATION_NOTE } from '@/constants/labels';
import { useQuotePreview } from '@/hooks/useQuotePreview';
import { ApiRequestError, friendlyErrorMessage, supportLine } from '@/lib/api/errors';
import { formatLocalDate } from '@/lib/format';
import { formatMinor } from '@/lib/money';
import { cn } from '@/lib/cn';
import { useDraftStore } from '@/store/draftStore';

import { EnquiryForm } from './EnquiryForm';
import { useLayoutState, type StepProps } from './layoutState';
import { stepHref } from './steps';
import { buildQuoteInput, useSelections } from './useSelections';

/**
 * Review step: summary cards with Edit links, the server-priced estimate and the
 * booking request form. Every amount comes from the quote preview; nothing is
 * calculated in the browser.
 *
 * @param props Venue and validation state.
 * @returns The review step layout.
 */
export function ReviewStep({ venue, validation }: StepProps): ReactNode {
  const guests = useDraftStore((state) => state.guests);
  const seatsPerTable = useDraftStore((state) => state.seatsPerTable);
  const eventDate = useDraftStore((state) => state.eventDate);
  const eventType = useDraftStore((state) => state.eventType);
  const selections = useSelections(venue);
  const layout = useLayoutState(venue, validation);
  const [formOpen, setFormOpen] = useState(false);
  const quote = useQuotePreview(
    buildQuoteInput(venue, selections, guests, seatsPerTable, {
      includeStage: true,
      includeExtras: true,
    }),
  );

  const seatingText = layout.layout
    ? `${layout.layout.tableCount} tables · ${seatsPerTable} seats per table`
    : `${seatsPerTable} seats per table`;
  const summary = [
    `${guests} guests`,
    `${seatsPerTable} seats per table`,
    layout.layout ? `${layout.layout.tableCount} tables` : null,
    selections.menuPackage ? `package ${selections.menuPackage.name}` : null,
    selections.stage ? `stage ${selections.stage.name}` : 'no stage preset',
    selections.extras.length > 0
      ? `extras: ${selections.extras.map((entry) => entry.extra.label).join(', ')}`
      : 'no extras',
  ]
    .filter((part): part is string => part !== null)
    .join('; ');

  const doesNotFit =
    quote.status === 'error' &&
    quote.error instanceof ApiRequestError &&
    quote.error.code === 'LAYOUT_DOES_NOT_FIT';
  const canRequest = quote.status === 'ready';

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_24rem]">
      <section aria-labelledby="review-heading" className="min-w-0">
        <h1 id="review-heading" className="text-4xl md:text-6xl">
          Your celebration, considered.
        </h1>
        <p className="mt-2 text-lg text-ink-muted">
          Review every detail before requesting your booking.
        </p>

        <PhotoPlaceholder label={venue.name} className="mt-6 aspect-[16/7] w-full rounded-2xl" />
        <dl className="mt-2 grid grid-cols-2 gap-2 rounded-xl border border-line bg-surface p-3 text-sm sm:grid-cols-4">
          <MetaItem
            icon={<Tent className="size-4" aria-hidden="true" />}
            label="Venue"
            value={venue.name}
          />
          <MetaItem
            icon={<CalendarDays className="size-4" aria-hidden="true" />}
            label="Date"
            value={eventDate ? formatLocalDate(eventDate) : 'Not chosen yet'}
          />
          <MetaItem
            icon={<Info className="size-4" aria-hidden="true" />}
            label="Event"
            value={EVENT_TYPE_LABELS[eventType]}
          />
          <MetaItem
            icon={<UsersRound className="size-4" aria-hidden="true" />}
            label="Guests"
            value={`${guests} guests`}
          />
        </dl>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <SummaryCard
            title="Seating"
            editHref={stepHref(venue.slug, 'seating')}
            body={seatingText}
          />
          <SummaryCard
            title="Menu"
            editHref={stepHref(venue.slug, 'menu')}
            body={
              selections.menuPackage
                ? `${selections.menuPackage.name} · ${formatMinor(selections.menuPackage.pricePerGuest)} / guest`
                : 'No package chosen'
            }
          />
          <SummaryCard
            title="Stage"
            editHref={stepHref(venue.slug, 'stage')}
            body={selections.stage ? selections.stage.name : 'No stage preset'}
          />
        </div>
        {selections.extras.length > 0 ? (
          <p className="mt-3 text-sm text-ink-muted">
            Extras: {selections.extras.map((entry) => entry.extra.label).join(', ')}.{' '}
            <Link href={stepHref(venue.slug, 'extras')} className="text-accent underline">
              Edit
            </Link>
          </p>
        ) : null}
        <Notice tone="info" className="mt-4">
          {QUOTATION_NOTE}
        </Notice>
        <p className="mt-2 text-xs text-ink-muted">{DEMO_DATA_NOTICE}</p>

        {formOpen ? (
          <div className="mt-8">
            <EnquiryForm venueSlug={venue.slug} configurationSummary={summary} />
          </div>
        ) : null}
      </section>

      <aside
        aria-labelledby="estimate-heading"
        className="h-fit rounded-2xl border border-line bg-surface p-6 shadow-card"
      >
        <h2 id="estimate-heading" className="border-b border-line pb-3 text-3xl">
          Your estimate
        </h2>
        <div aria-live="polite" className="mt-4">
          {!selections.menuPackage ? (
            <Notice tone="warning">
              Choose a menu package to see your estimate.{' '}
              <Link href={stepHref(venue.slug, 'menu')} className="underline">
                Go to menu
              </Link>
            </Notice>
          ) : quote.status === 'ready' ? (
            <>
              <ul className="space-y-3 text-sm">
                {quote.data.lines.map((line) => {
                  const discount =
                    line.ruleCode === 'APPROVED_CONCESSION' || line.amount.startsWith('-');
                  return (
                    <li key={line.code} className="flex justify-between gap-3">
                      <span className={cn(discount && 'text-sage-ink')}>
                        {line.label}
                        {line.ruleCode === 'MIN_HEADCOUNT_APPLIED' ? (
                          <span className="block text-xs text-ink-muted">
                            Minimum headcount applied
                          </span>
                        ) : null}
                        {line.ruleCode === 'RENT_WAIVED' ? (
                          <span className="block text-xs text-ink-muted">
                            Rent waived under venue rule
                          </span>
                        ) : null}
                      </span>
                      <span className={cn('whitespace-nowrap', discount && 'text-sage-ink')}>
                        {formatMinor(line.amount)}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-5 flex items-end justify-between gap-3 border-t border-line pt-4">
                <div>
                  <p className="font-serif text-3xl">Total</p>
                  <p className="text-xs text-ink-muted">Before applicable taxes</p>
                </div>
                <p className="font-serif text-4xl">{formatMinor(quote.data.total)}</p>
              </div>
              <dl className="mt-4 space-y-2 border-t border-line pt-4 text-sm">
                <div className="flex justify-between">
                  <dt>Advance · {quote.data.advancePercent}%</dt>
                  <dd>{formatMinor(quote.data.advance)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Remaining balance</dt>
                  <dd>{formatMinor(quote.data.balance)}</dd>
                </div>
              </dl>
              <p className="mt-3 text-xs text-ink-muted">{quote.data.note}</p>
            </>
          ) : quote.status === 'error' ? (
            <Notice tone="error">
              <p>{friendlyErrorMessage(quote.error)}</p>
              {doesNotFit ? (
                <p className="mt-1">
                  <Link href={stepHref(venue.slug, 'seating')} className="underline">
                    Adjust your seating
                  </Link>
                </p>
              ) : null}
              {supportLine(quote.error) ? (
                <p className="mt-1 text-xs">{supportLine(quote.error)}</p>
              ) : null}
            </Notice>
          ) : (
            <p className="text-sm text-ink-muted">Calculating your estimate…</p>
          )}
        </div>
        <div className="mt-6 space-y-3">
          <Button
            size="lg"
            className="w-full"
            disabled={!canRequest}
            onClick={() => {
              setFormOpen(true);
              requestAnimationFrame(() => {
                document.getElementById('request')?.scrollIntoView({ block: 'start' });
                document.getElementById('request-heading')?.focus();
              });
            }}
          >
            Request booking
          </Button>
          <ButtonLink href={stepHref(venue.slug, 'seating')} variant="ghost" className="w-full">
            Change my plan
          </ButtonLink>
        </div>
      </aside>
    </div>
  );
}

/** Props for {@link MetaItem}. */
interface MetaItemProps {
  readonly icon: ReactNode;
  readonly label: string;
  readonly value: string;
}

/**
 * One cell in the venue metadata strip.
 * @param props Icon, label and value.
 * @returns A definition-list group.
 */
function MetaItem({ icon, label, value }: MetaItemProps): ReactNode {
  return (
    <div className="flex items-center gap-2">
      <span className="text-ink-muted">{icon}</span>
      <dt className="sr-only">{label}</dt>
      <dd className="truncate">{value}</dd>
    </div>
  );
}

/** Props for {@link SummaryCard}. */
interface SummaryCardProps {
  readonly title: string;
  readonly editHref: string;
  readonly body: string;
}

/**
 * Summary card with an Edit link back to its step.
 * @param props Title, edit target and text.
 * @returns A card element.
 */
function SummaryCard({ title, editHref, body }: SummaryCardProps): ReactNode {
  return (
    <article className="rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-2xl">{title}</h3>
        <Link href={editHref} className="text-sm text-accent underline">
          Edit<span className="sr-only"> {title}</span>
        </Link>
      </div>
      <p className="mt-2 text-sm text-ink-muted">{body}</p>
    </article>
  );
}
