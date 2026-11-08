'use client';

import type { ReactNode } from 'react';

import { Button } from '@/components/ui/Button';

/** Props Next.js passes to an error boundary. */
interface ErrorProps {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}

/**
 * Last-resort error boundary. Shows friendly copy and a retry; the digest is the
 * only identifier shown, in a small support line.
 * @param props Error and reset callback.
 * @returns An error page.
 */
export default function GlobalError({ error, reset }: ErrorProps): ReactNode {
  return (
    <main id="main" className="mx-auto max-w-xl px-4 py-16 text-center">
      <h1 className="text-5xl">Something went wrong</h1>
      <p className="mt-3 text-ink-muted">We could not show this page. Please try again.</p>
      <div className="mt-6">
        <Button onClick={reset}>Try again</Button>
      </div>
      {error.digest ? (
        <p className="mt-4 text-xs text-ink-muted">Support reference: {error.digest}</p>
      ) : null}
    </main>
  );
}
