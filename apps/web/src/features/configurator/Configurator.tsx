'use client';

import type { PublicVenueDetailDto, PublicVenueSummaryDto } from '@marquee/contracts';
import { useEffect, type ReactNode } from 'react';

import { Wordmark } from '@/components/layout/Wordmark';
import { Skeleton } from '@/components/ui/Skeleton';
import { DEMO_DATA_NOTICE, DRAFT_LABEL, EVENT_TYPE_LABELS } from '@/constants/labels';
import { useConfigurationValidation } from '@/hooks/useConfigurationValidation';
import { useDraftHydrated } from '@/hooks/useDraftHydration';
import { useDraftStore } from '@/store/draftStore';

import { ExtrasStep } from './ExtrasStep';
import { MenuStep } from './MenuStep';
import { ReviewStep } from './ReviewStep';
import { SeatingStep } from './SeatingStep';
import { StageStep } from './StageStep';
import { Stepper } from './Stepper';
import type { StepId } from './steps';

/** Props for {@link Configurator}. */
interface ConfiguratorProps {
  readonly venue: PublicVenueDetailDto;
  readonly venues: readonly PublicVenueSummaryDto[];
  /** Current step, read on the server from the URL so the first render needs no client search params. */
  readonly step: StepId;
}

/**
 * Configurator shell: header, stepper and the current step. The step lives in the
 * URL (?step=); choices live in the browser-only draft store. Seating validation
 * runs once here so every step shares the server's answer.
 *
 * @param props Venue detail loaded on the server and the venue list.
 * @returns The configurator page content.
 */
export function Configurator({ venue, venues, step }: ConfiguratorProps): ReactNode {
  const hydrated = useDraftHydrated();
  const guests = useDraftStore((state) => state.guests);
  const seatsPerTable = useDraftStore((state) => state.seatsPerTable);
  const stageId = useDraftStore((state) => state.stageId);
  const eventType = useDraftStore((state) => state.eventType);
  const setVenue = useDraftStore((state) => state.setVenue);
  const validation = useConfigurationValidation(
    hydrated ? venue.slug : null,
    guests,
    seatsPerTable,
    stageId,
  );

  useEffect(() => {
    if (hydrated) {
      setVenue(venue.slug);
    }
  }, [hydrated, venue.slug, setVenue]);

  const props = { venue, venues, validation };

  return (
    <>
      <header className="border-b border-line bg-cream">
        <div className="mx-auto flex max-w-page flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 md:px-8">
          <Wordmark />
          <span className="hidden h-6 w-px bg-line sm:block" aria-hidden="true" />
          <p className="font-serif text-xl">Your event · {EVENT_TYPE_LABELS[eventType]}</p>
          <span className="rounded-md bg-cream-deep px-2.5 py-1 text-xs text-ink-muted">
            {DRAFT_LABEL}
          </span>
          <p className="ml-auto text-xs text-ink-muted">{DEMO_DATA_NOTICE}</p>
        </div>
      </header>
      <Stepper slug={venue.slug} current={step} />
      <main id="main" className="mx-auto max-w-page px-4 py-6 md:px-8 md:py-8">
        {!hydrated ? (
          <div role="status" aria-label="Loading your draft">
            <Skeleton className="h-12 w-72" />
            <Skeleton className="mt-6 h-96 w-full" />
          </div>
        ) : step === 'seating' ? (
          <SeatingStep {...props} />
        ) : step === 'menu' ? (
          <MenuStep {...props} />
        ) : step === 'stage' ? (
          <StageStep {...props} />
        ) : step === 'extras' ? (
          <ExtrasStep {...props} />
        ) : (
          <ReviewStep {...props} />
        )}
      </main>
    </>
  );
}
