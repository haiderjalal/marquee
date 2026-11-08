import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { Wordmark } from '@/components/layout/Wordmark';
import { StaffNav } from '@/features/staff/StaffNav';

export const metadata: Metadata = {
  title: { default: 'Workspace', template: '%s · Workspace · Event Studio' },
  robots: { index: false, follow: false },
};

/**
 * Staff workspace shell: dark sidebar with the venue selector and navigation.
 * @param props Page content.
 * @returns The two-column workspace layout.
 */
export default function WorkspaceLayout({ children }: { readonly children: ReactNode }): ReactNode {
  return (
    <div className="lg:grid lg:min-h-dvh lg:grid-cols-[16rem_minmax(0,1fr)]">
      <aside className="bg-plum-deep px-4 py-4 text-on-plum lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:py-6">
        <Wordmark href="/workspace" onDark className="block text-xl" />
        <div className="mt-4">
          <label htmlFor="venue-filter" className="sr-only">
            Venue
          </label>
          <select
            id="venue-filter"
            defaultValue="all"
            className="min-h-11 w-full rounded-lg border border-plum-line bg-plum-deep px-3 text-sm text-on-plum"
          >
            <option value="all">All venues</option>
          </select>
        </div>
        <div className="mt-4 lg:mt-6">
          <StaffNav />
        </div>
        <p className="mt-4 hidden text-xs text-on-plum-muted lg:mt-auto lg:block">
          Development sign-in. Real staff sign-in arrives with the identity provider.
        </p>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
