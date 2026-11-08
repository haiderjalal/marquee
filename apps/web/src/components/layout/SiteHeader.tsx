import { ChevronDown } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { SiteNav } from './SiteNav';
import { Wordmark } from './Wordmark';

/**
 * Public site header: wordmark, primary navigation, language selector and sign-in.
 * @returns The page banner landmark.
 */
export function SiteHeader(): ReactNode {
  return (
    <header className="border-b border-line bg-cream">
      <div className="mx-auto flex max-w-page flex-wrap items-center gap-x-8 gap-y-2 px-4 py-3 md:px-8">
        <Wordmark />
        <SiteNav />
        <div className="ml-auto flex items-center gap-3">
          <button
            type="button"
            disabled
            aria-label="Language: English. More languages are planned."
            className="inline-flex min-h-11 items-center gap-1 px-2 text-sm text-ink-muted"
          >
            EN <ChevronDown className="size-4" aria-hidden="true" />
          </button>
          <span className="h-6 w-px bg-line" aria-hidden="true" />
          <Link
            href="/sign-in"
            className="inline-flex min-h-11 items-center rounded-lg bg-plum px-4 text-sm font-medium text-on-plum hover:bg-plum-hover"
          >
            Sign in
          </Link>
        </div>
      </div>
    </header>
  );
}
