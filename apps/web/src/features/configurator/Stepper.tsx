import Link from 'next/link';
import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

import { STEP_IDS, STEP_LABELS, stepHref, type StepId } from './steps';

/** Props for {@link Stepper}. */
interface StepperProps {
  readonly slug: string;
  readonly current: StepId;
}

/**
 * Six-step progress navigation. Every step is a real link, so keyboard and screen
 * reader users can move freely; the current step is marked with aria-current.
 * On narrow screens only the current label is shown to keep the bar on one line.
 *
 * @param props Venue slug and the current step.
 * @returns A navigation landmark.
 */
export function Stepper({ slug, current }: StepperProps): ReactNode {
  const items: ReadonlyArray<{
    readonly key: string;
    readonly label: string;
    readonly href: string;
    readonly active: boolean;
  }> = [
    { key: 'venue', label: 'Venue', href: '/#venues', active: false },
    ...STEP_IDS.map((id) => ({
      key: id,
      label: STEP_LABELS[id],
      href: stepHref(slug, id),
      active: id === current,
    })),
  ];
  return (
    <nav aria-label="Planning steps" className="border-b border-line bg-cream">
      <ol className="mx-auto flex max-w-page items-center justify-between gap-1 px-4 py-2 md:px-8">
        {items.map((item, index) => (
          <li key={item.key} className="flex flex-1 items-center gap-2 last:flex-none">
            <Link
              href={item.href}
              aria-current={item.active ? 'step' : undefined}
              className="inline-flex min-h-11 items-center gap-2 text-sm"
            >
              <span
                className={cn(
                  'inline-flex size-8 shrink-0 items-center justify-center rounded-full border text-sm',
                  item.active
                    ? 'border-accent bg-accent font-medium text-surface'
                    : 'border-line bg-surface text-ink',
                )}
              >
                {index + 1}
              </span>
              <span
                className={cn(
                  item.active ? 'font-medium text-accent' : 'hidden text-ink sm:inline',
                )}
              >
                {item.label}
              </span>
            </Link>
            {index < items.length - 1 ? (
              <span className="hidden h-px flex-1 bg-line sm:block" aria-hidden="true" />
            ) : null}
          </li>
        ))}
      </ol>
    </nav>
  );
}
