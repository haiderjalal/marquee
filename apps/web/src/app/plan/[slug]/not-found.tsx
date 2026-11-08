import type { ReactNode } from 'react';

import { SiteHeader } from '@/components/layout/SiteHeader';
import { ButtonLink } from '@/components/ui/Button';

/**
 * Shown when the venue slug is not published.
 * @returns A friendly not-found page with a way back.
 */
export default function VenueNotFound(): ReactNode {
  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="text-5xl">We could not find that venue</h1>
        <p className="mt-3 text-ink-muted">
          It may not be published. Please choose from the venues we have.
        </p>
        <div className="mt-6">
          <ButtonLink href="/#venues">Browse venues</ButtonLink>
        </div>
      </main>
    </>
  );
}
