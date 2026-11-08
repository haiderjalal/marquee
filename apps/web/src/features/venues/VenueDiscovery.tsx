'use client';

import type { PublicVenueSummaryDto } from '@marquee/contracts';
import { EVENT_TYPES, type EventType } from '@marquee/domain';
import { ArrowRight, Calendar, Info, Layers } from 'lucide-react';
import { useState, type SubmitEvent, type ReactNode } from 'react';

import { GuestCountInput } from '@/components/forms/GuestCountInput';
import { ButtonLink, Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { PhotoPlaceholder } from '@/components/ui/PhotoPlaceholder';
import { AVAILABILITY_HELPER, DEMO_DATA_NOTICE, EVENT_TYPE_LABELS } from '@/constants/labels';
import { formatLocalDate } from '@/lib/format';
import { useDraftStore } from '@/store/draftStore';

import { VenueCard } from './VenueCard';

/** Props for {@link VenueDiscovery}. */
interface VenueDiscoveryProps {
  readonly venues: readonly PublicVenueSummaryDto[];
}

/**
 * Narrows a select value to an event type.
 * @param value Raw option value.
 * @returns The event type, or null when unrecognised.
 */
function toEventType(value: string): EventType | null {
  return EVENT_TYPES.find((type) => type === value) ?? null;
}

/**
 * Discovery search bar, venue cards and the sticky "Design this event" bar.
 * The search bar stores event details in the browser draft; it does not query
 * availability, which is confirmed only when a booking is requested.
 *
 * @param props Published venues loaded on the server.
 * @returns Search form, venue list and sticky action bar.
 */
export function VenueDiscovery({ venues }: VenueDiscoveryProps): ReactNode {
  const eventDate = useDraftStore((state) => state.eventDate);
  const eventType = useDraftStore((state) => state.eventType);
  const guests = useDraftStore((state) => state.guests);
  const storedSlug = useDraftStore((state) => state.venueSlug);
  const setVenue = useDraftStore((state) => state.setVenue);
  const setEventDate = useDraftStore((state) => state.setEventDate);
  const setEventType = useDraftStore((state) => state.setEventType);
  const setGuests = useDraftStore((state) => state.setGuests);
  const [confirmed, setConfirmed] = useState(false);

  const selected = venues.find((venue) => venue.slug === storedSlug) ?? venues[0] ?? null;

  /**
   * Keeps the entered details in the draft and shows the honest availability note.
   * @param event Form submit event.
   */
  function handleSubmit(event: SubmitEvent<HTMLFormElement>): void {
    event.preventDefault();
    setConfirmed(true);
  }

  return (
    <>
      <form
        onSubmit={handleSubmit}
        aria-label="Event details"
        className="mt-8 grid gap-3 rounded-2xl border border-line bg-surface p-3 shadow-card md:grid-cols-[1fr_1fr_1fr_auto] md:items-end"
      >
        <div>
          <label
            htmlFor="search-date"
            className="mb-1 flex items-center gap-2 px-1 text-sm font-medium"
          >
            <Calendar className="size-4 text-ink-muted" aria-hidden="true" /> Event date
          </label>
          <input
            id="search-date"
            type="date"
            value={eventDate ?? ''}
            onChange={(event) => {
              setEventDate(event.target.value || null);
              setConfirmed(false);
            }}
            className="min-h-11 w-full rounded-lg border border-line bg-cream px-3"
          />
        </div>
        <div>
          <label
            htmlFor="search-type"
            className="mb-1 flex items-center gap-2 px-1 text-sm font-medium"
          >
            <Layers className="size-4 text-ink-muted" aria-hidden="true" /> Event type
          </label>
          <select
            id="search-type"
            value={eventType}
            onChange={(event) => {
              const next = toEventType(event.target.value);
              if (next) {
                setEventType(next);
                setConfirmed(false);
              }
            }}
            className="min-h-11 w-full rounded-lg border border-line bg-cream px-3"
          >
            {EVENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {EVENT_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </div>
        <GuestCountInput
          id="search-guests"
          label="Guests"
          value={guests}
          onCommit={(next) => {
            setGuests(next);
            setConfirmed(false);
          }}
        />
        <Button type="submit" size="lg" className="md:min-w-48">
          Check availability
        </Button>
      </form>
      <p className="mt-3 flex items-center gap-2 text-sm text-ink-muted">
        <Info className="size-4" aria-hidden="true" />
        {AVAILABILITY_HELPER}
      </p>
      <div aria-live="polite">
        {confirmed ? (
          <Notice tone="info" className="mt-3">
            Details kept in your draft. We do not check live availability yet — send a booking
            request and our team will confirm your date.
          </Notice>
        ) : null}
      </div>

      <section id="venues" aria-labelledby="venues-heading" className="mt-10 scroll-mt-6">
        <div className="flex items-center gap-4">
          <h2
            id="venues-heading"
            className="whitespace-nowrap font-sans text-base font-medium text-ink-muted"
          >
            {venues.length === 1 ? '1 venue to explore' : `${venues.length} venues to explore`}
          </h2>
          <span className="h-px flex-1 bg-line" aria-hidden="true" />
        </div>
        <p className="mt-2 text-xs text-ink-muted">{DEMO_DATA_NOTICE}</p>

        {venues.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-line bg-surface p-10 text-center">
            <p className="font-serif text-2xl">No venues are published yet.</p>
            <p className="mt-2 text-ink-muted">Please check back soon.</p>
          </div>
        ) : (
          <div
            role="radiogroup"
            aria-label="Choose a venue"
            className="mt-6 grid gap-6 md:grid-cols-2"
          >
            {venues.map((venue) => (
              <VenueCard
                key={venue.slug}
                venue={venue}
                groupName="venue"
                selected={selected?.slug === venue.slug}
                onSelect={setVenue}
              />
            ))}
          </div>
        )}
      </section>

      {selected ? (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 backdrop-blur">
          <div className="mx-auto flex max-w-page flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 md:px-8">
            <PhotoPlaceholder
              label={selected.name}
              caption={false}
              className="size-12 shrink-0 rounded-lg"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate font-serif text-2xl leading-none">{selected.name}</p>
              <p className="mt-1 truncate text-sm text-ink-muted">
                {eventDate ? `${formatLocalDate(eventDate)} · ` : ''}
                {EVENT_TYPE_LABELS[eventType]} · {guests} guests
              </p>
            </div>
            <p className="hidden items-center gap-2 text-sm text-ink-muted lg:flex">
              <Info className="size-4" aria-hidden="true" />
              {AVAILABILITY_HELPER}
            </p>
            <ButtonLink
              href={`/plan/${selected.slug}`}
              size="lg"
              className="w-full sm:w-auto"
              onClick={() => {
                setVenue(selected.slug);
              }}
            >
              Design this event <ArrowRight className="size-4" aria-hidden="true" />
            </ButtonLink>
          </div>
        </div>
      ) : null}
    </>
  );
}
