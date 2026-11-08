import type { PublicVenueSummaryDto } from '@marquee/contracts';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { SiteHeader } from '@/components/layout/SiteHeader';
import { ApiErrorPanel } from '@/components/ui/ApiErrorPanel';
import { getPublicVenues } from '@/lib/api/server';
import { VenueDiscovery } from '@/features/venues/VenueDiscovery';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Find your perfect setting',
  description:
    'Choose a wedding hall or marquee, then design your seating, menu and stage. Demonstration venues and prices.',
  alternates: { canonical: '/' },
};

/**
 * Discovery page: hero, search bar and published venue cards.
 * @returns The home page.
 */
export default async function HomePage(): Promise<ReactNode> {
  let venues: PublicVenueSummaryDto[] = [];
  let failure: unknown = null;
  try {
    venues = await getPublicVenues();
  } catch (error) {
    failure = error;
  }

  return (
    <>
      <SiteHeader />
      <main id="main" className="bg-linear-to-b from-cream-deep/60 to-cream">
        <div className="mx-auto max-w-page px-4 pb-32 pt-10 md:px-8 md:pt-14">
          <p className="flex items-center gap-3 font-serif text-lg italic text-accent">
            <span className="h-px w-8 bg-accent" aria-hidden="true" />
            Your celebration starts here
          </p>
          <h1 className="mt-3 text-5xl md:text-7xl">Find your perfect setting.</h1>
          <p className="mt-3 text-lg text-ink-muted md:text-xl">Choose a space. Make it yours.</p>

          {failure ? (
            <div className="mt-12">
              <ApiErrorPanel title="Venues are not loading" error={failure} retryHref="/" />
            </div>
          ) : (
            <VenueDiscovery venues={venues} />
          )}
        </div>
      </main>
    </>
  );
}
