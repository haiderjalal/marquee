import { RefreshCw } from 'lucide-react';
import type { ReactNode } from 'react';

import { friendlyErrorMessage, supportLine } from '@/lib/api/errors';

import { ButtonLink } from './Button';

/** Props for {@link ApiErrorPanel}. */
interface ApiErrorPanelProps {
  readonly title: string;
  readonly error: unknown;
  /** Where "Try again" navigates; usually the current page. */
  readonly retryHref: string;
}

/**
 * Friendly full-section error for a failed server-side data load. Shows safe copy
 * and, in a small line, the correlation id so support can trace the request.
 * @param props Heading, caught error and retry target.
 * @returns An alert region with a retry link.
 */
export function ApiErrorPanel({ title, error, retryHref }: ApiErrorPanelProps): ReactNode {
  const support = supportLine(error);
  return (
    <section
      role="alert"
      className="mx-auto max-w-xl rounded-2xl border border-line bg-surface p-8 text-center shadow-card"
    >
      <h2 className="text-3xl">{title}</h2>
      <p className="mt-3 text-ink-muted">{friendlyErrorMessage(error)}</p>
      <div className="mt-6">
        <ButtonLink href={retryHref} variant="primary" prefetch={false}>
          <RefreshCw className="size-4" aria-hidden="true" /> Try again
        </ButtonLink>
      </div>
      {support ? <p className="mt-4 text-xs text-ink-muted">{support}</p> : null}
    </section>
  );
}
