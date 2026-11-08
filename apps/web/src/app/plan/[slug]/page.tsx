import type { PublicVenueDetailDto, PublicVenueSummaryDto } from '@marquee/contracts';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense, type ReactNode } from 'react';

import { SiteHeader } from '@/components/layout/SiteHeader';
import { ApiErrorPanel } from '@/components/ui/ApiErrorPanel';
import { Skeleton } from '@/components/ui/Skeleton';
import { Configurator } from '@/features/configurator/Configurator';
import { parseStep } from '@/features/configurator/steps';
import { getPublicVenue, getPublicVenues } from '@/lib/api/server';

export const dynamic = 'force-dynamic';

/** Route parameters (a Promise in Next.js 16). */
interface PlanPageProps {
  readonly params: Promise<{ readonly slug: string }>;
  readonly searchParams: Promise<{ readonly step?: string | string[] | undefined }>;
}

/**
 * Builds page metadata from the route slug without needing the API.
 * @param props Route params.
 * @returns Title and description for the planner.
 */
export async function generateMetadata({ params }: PlanPageProps): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: `Plan your event · ${slug}`,
    description: 'Design your seating, menu and stage, then request a booking. Demonstration data.',
  };
}

/**
 * Planner page: loads the venue and venue list on the server and hands them to the
 * client configurator.
 * @param props Route params.
 * @returns The configurator, a friendly error, or a 404.
 */
export default async function PlanPage({
  params,
  searchParams,
}: PlanPageProps): Promise<ReactNode> {
  const { slug } = await params;
  const query = await searchParams;
  const step = parseStep(typeof query.step === 'string' ? query.step : null);
  let venue: PublicVenueDetailDto | null;
  let venues: PublicVenueSummaryDto[];
  try {
    [venue, venues] = await Promise.all([getPublicVenue(slug), getPublicVenues()]);
  } catch (error) {
    return (
      <>
        <SiteHeader />
        <main id="main" className="px-4 py-16">
          <h1 className="sr-only">Planner unavailable</h1>
          <ApiErrorPanel
            title="The planner is not loading"
            error={error}
            retryHref={`/plan/${slug}`}
          />
        </main>
      </>
    );
  }
  if (!venue) {
    notFound();
  }
  return (
    <Suspense
      fallback={
        <div role="status" className="m-8">
          <span className="sr-only">Loading the planner…</span>
          <Skeleton className="h-96" />
        </div>
      }
    >
      <Configurator venue={venue} venues={venues} step={step} />
    </Suspense>
  );
}
