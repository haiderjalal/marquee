'use client';

import { ArrowRight, Armchair, RotateCw, Undo2, UsersRound } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';

import { GuestCountInput } from '@/components/forms/GuestCountInput';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { PhotoPlaceholder } from '@/components/ui/PhotoPlaceholder';
import { DRAFT_LABEL, SEATS_PER_TABLE_OPTIONS } from '@/constants/labels';
import { cn } from '@/lib/cn';
import { friendlyErrorMessage, supportLine } from '@/lib/api/errors';
import { useDraftStore } from '@/store/draftStore';

import { LayoutThumbnail } from './LayoutThumbnail';
import { useLayoutState, type StepProps } from './layoutState';
import { PlanViewport } from './PlanViewport';
import { stepHref } from './steps';
import { usePlanView } from './usePlanView';

/**
 * Seating step: guests, table size and the live plan. Counts come from the server
 * validation; a refusal shows the server message and the verified capacity, and
 * disables Continue.
 *
 * @param props Venue, venue list and the shared validation request.
 * @returns The seating step layout.
 */
export function SeatingStep({ venue, venues, validation }: StepProps): ReactNode {
  const router = useRouter();
  const guests = useDraftStore((state) => state.guests);
  const seatsPerTable = useDraftStore((state) => state.seatsPerTable);
  const canUndo = useDraftStore((state) => state.history.length > 0);
  const setGuests = useDraftStore((state) => state.setGuests);
  const setSeatsPerTable = useDraftStore((state) => state.setSeatsPerTable);
  const undoSeating = useDraftStore((state) => state.undoSeating);
  const { view, actions } = usePlanView();
  const state = useLayoutState(venue, validation);
  const { layout, refusal, loading, error } = state;

  const countsText = layout ? `${layout.tableCount} tables · ${layout.chairCount} chairs` : null;
  const canContinue = state.layoutIsCurrent && !loading;
  const summary = layout
    ? `Floor plan of ${venue.name}: ${layout.tableCount} tables and ${layout.chairCount} chairs for ${layout.requestedGuests} guests.`
    : `Floor plan of ${venue.name}. No seating layout is shown for the current count.`;
  const overlay = refusal
    ? 'No layout fits this guest count.'
    : loading
      ? 'Updating layout…'
      : error
        ? 'Layout unavailable right now.'
        : null;

  return (
    <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)_19rem]">
      <section aria-labelledby="seating-heading" className="space-y-5">
        <div>
          <h1 id="seating-heading" className="text-4xl md:text-5xl">
            A place for everyone.
          </h1>
          <p className="mt-2 text-sm text-ink-muted">
            Plan your seating, choose a layout, and arrange tables for a seamless celebration.
          </p>
        </div>

        <div>
          <label htmlFor="venue-select" className="mb-1.5 block text-sm font-medium">
            Venue
          </label>
          <select
            id="venue-select"
            value={venue.slug}
            onChange={(event) => {
              router.push(stepHref(event.target.value, 'seating'));
            }}
            className="min-h-11 w-full rounded-lg border border-line bg-surface px-3"
          >
            {venues.map((entry) => (
              <option key={entry.slug} value={entry.slug}>
                {entry.name}
              </option>
            ))}
          </select>
        </div>

        <GuestCountInput
          id="guests"
          label="Guests"
          value={guests}
          onCommit={setGuests}
          stepper
          describedBy="seating-status"
        />

        <fieldset>
          <legend className="mb-1.5 text-sm font-medium">Seats per table</legend>
          <div className="grid grid-cols-3 gap-2">
            {SEATS_PER_TABLE_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={seatsPerTable === option}
                onClick={() => {
                  setSeatsPerTable(option);
                }}
                className={cn(
                  'min-h-11 rounded-lg border text-sm font-medium',
                  seatsPerTable === option
                    ? 'border-accent bg-accent text-surface'
                    : 'border-line bg-surface hover:bg-cream-deep',
                )}
              >
                {option}
              </button>
            ))}
          </div>
        </fieldset>

        <div id="seating-status" aria-live="polite" className="space-y-3">
          {countsText ? (
            <p
              className={cn(
                'flex items-center gap-3 rounded-lg bg-cream-deep px-4 py-3 text-sm font-medium',
                !state.layoutIsCurrent && 'opacity-60',
              )}
            >
              <Armchair className="size-5 text-ink-muted" aria-hidden="true" />
              {countsText}
            </p>
          ) : loading ? (
            <p className="rounded-lg bg-cream-deep px-4 py-3 text-sm text-ink-muted">
              Checking the layout…
            </p>
          ) : null}
          {refusal ? (
            <Notice tone="warning">
              <p className="font-medium">{refusal.message}</p>
              <p className="mt-1">
                This hall seats at most {refusal.capacity.maxGuests.toLocaleString('en-GB')} guests
                with {refusal.capacity.seatsPerTable} per table ({refusal.capacity.maxTables}{' '}
                tables).
              </p>
              <Button
                variant="secondary"
                className="mt-3"
                onClick={() => {
                  setGuests(refusal.capacity.maxGuests);
                }}
              >
                Use {refusal.capacity.maxGuests.toLocaleString('en-GB')} guests
              </Button>
            </Notice>
          ) : null}
          {error ? (
            <Notice tone="error">
              <p>{friendlyErrorMessage(error)}</p>
              {supportLine(error) ? <p className="mt-1 text-xs">{supportLine(error)}</p> : null}
            </Notice>
          ) : null}
        </div>

        <div>
          <label htmlFor="layout-preset" className="mb-1.5 block text-sm font-medium">
            Layout preset
          </label>
          <select
            id="layout-preset"
            defaultValue="central-aisle"
            className="min-h-11 w-full rounded-lg border border-line bg-surface px-3"
          >
            <option value="central-aisle">Central aisle</option>
          </select>
          <p className="mt-1 text-xs text-ink-muted">More presets arrive in a later release.</p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={actions.rotate}>
            <RotateCw className="size-4" aria-hidden="true" /> Rotate view
          </Button>
          <Button variant="secondary" onClick={undoSeating} disabled={!canUndo}>
            <Undo2 className="size-4" aria-hidden="true" /> Undo
          </Button>
        </div>
      </section>

      <PlanViewport
        shell={state.shell}
        shellIsExact={state.shellIsExact}
        geometry={state.geometry}
        view={view}
        actions={actions}
        summary={summary}
        overlayMessage={overlay}
        updating={loading}
      />

      <aside aria-labelledby="your-event-heading" className="space-y-4">
        <div className="rounded-2xl border border-line bg-surface p-4 shadow-card">
          <h2 id="your-event-heading" className="text-3xl">
            Your event
          </h2>
          <PhotoPlaceholder label={venue.name} className="mt-3 aspect-[16/9] w-full rounded-lg" />
          <p className="mt-3 font-serif text-2xl">{venue.name}</p>
          <p className="text-sm text-ink-muted">{venue.tagline}</p>
          <dl className="mt-3 divide-y divide-line border-y border-line text-sm">
            <div className="flex items-center gap-3 py-2.5">
              <UsersRound className="size-4 text-ink-muted" aria-hidden="true" />
              <dt className="sr-only">Guests</dt>
              <dd>{layout?.requestedGuests ?? guests} guests</dd>
            </div>
            <div className="flex items-center gap-3 py-2.5">
              <Armchair className="size-4 text-ink-muted" aria-hidden="true" />
              <dt className="sr-only">Tables</dt>
              <dd>{layout ? `${layout.tableCount} tables` : 'Tables: waiting for the server'}</dd>
            </div>
            <div className="flex items-center gap-3 py-2.5">
              <span
                className="inline-flex size-4 items-center justify-center text-xs text-ink-muted"
                aria-hidden="true"
              >
                #
              </span>
              <dt className="sr-only">Seats per table</dt>
              <dd>{seatsPerTable} seats per table</dd>
            </div>
          </dl>
          <p className="mt-4 text-sm font-medium">Layout preview</p>
          <div className="mt-2">
            <LayoutThumbnail shell={state.shell} geometry={state.geometry} />
          </div>
          <p className="mt-3 text-xs text-ink-muted">
            {DRAFT_LABEL}. Nothing is saved on our servers yet.
          </p>
        </div>
        {canContinue ? (
          <ButtonLink href={stepHref(venue.slug, 'menu')} size="lg" className="w-full">
            Continue to menu <ArrowRight className="size-4" aria-hidden="true" />
          </ButtonLink>
        ) : (
          <Button size="lg" className="w-full" disabled aria-describedby="seating-status">
            Continue to menu <ArrowRight className="size-4" aria-hidden="true" />
          </Button>
        )}
      </aside>
    </div>
  );
}
