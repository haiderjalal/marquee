import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { SiteHeader } from '@/components/layout/SiteHeader';
import { ButtonLink } from '@/components/ui/Button';

export const metadata: Metadata = {
  title: 'Sign in',
  description:
    'Accounts for customers arrive in a later release. You can plan an event without signing in.',
};

/**
 * Placeholder explaining that customer sign-in is not available yet.
 * @returns The sign-in placeholder page.
 */
export default function SignInPage(): ReactNode {
  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto max-w-xl px-4 py-16 md:px-8">
        <div className="rounded-2xl border border-line bg-surface p-8 shadow-card">
          <h1 className="text-4xl">Sign in arrives later</h1>
          <p className="mt-4 text-ink-muted">
            Customer accounts are not part of this release. You can still explore venues and send an
            enquiry without signing in. Your plan is kept as a draft in this browser only.
          </p>
          <p className="mt-3 text-ink-muted">
            Venue staff use a separate workspace that signs in through the owner&apos;s identity
            provider once it is connected.
          </p>
          <div className="mt-6">
            <ButtonLink href="/" variant="primary">
              Back to venues
            </ButtonLink>
          </div>
        </div>
      </main>
    </>
  );
}
