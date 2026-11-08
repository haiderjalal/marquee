'use client';

import { ArrowRight, Check } from 'lucide-react';
import type { ReactNode } from 'react';

import { ButtonLink } from '@/components/ui/Button';
import { DEMO_DATA_NOTICE } from '@/constants/labels';
import { cn } from '@/lib/cn';
import { formatMinor } from '@/lib/money';
import { useDraftStore } from '@/store/draftStore';

import type { StepProps } from './layoutState';
import { stepHref } from './steps';
import { useSelections } from './useSelections';

/**
 * Extras step: optional services from the approved catalogue. Each extra is a
 * checkbox with quantity one; the estimate on the review step prices them.
 *
 * @param props Venue and validation state.
 * @returns The extras step layout.
 */
export function ExtrasStep({ venue }: StepProps): ReactNode {
  const extras = useDraftStore((state) => state.extras);
  const setExtraQuantity = useDraftStore((state) => state.setExtraQuantity);
  const selections = useSelections(venue);

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_21rem]">
      <section aria-labelledby="extras-heading">
        <h1 id="extras-heading" className="text-4xl md:text-6xl">
          The finishing touches.
        </h1>
        <p className="mt-2 text-lg text-ink-muted">
          Add the services your celebration needs. All are optional.
        </p>

        {venue.extras.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-line bg-surface p-10 text-center">
            <p className="font-serif text-2xl">
              No extra services are published for this venue yet.
            </p>
            <p className="mt-2 text-ink-muted">You can continue to the review.</p>
          </div>
        ) : (
          <fieldset className="mt-6">
            <legend className="sr-only">Extra services</legend>
            <ul className="space-y-3">
              {venue.extras.map((extra) => {
                const checked = (extras[extra.code] ?? 0) > 0;
                return (
                  <li key={extra.code}>
                    <label
                      className={cn(
                        'flex cursor-pointer items-center gap-4 rounded-2xl border bg-surface p-4 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent',
                        checked
                          ? 'border-2 border-terracotta bg-terracotta-soft'
                          : 'border-line hover:bg-cream-deep',
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) => {
                          setExtraQuantity(extra.code, event.target.checked ? 1 : 0);
                        }}
                        className="sr-only"
                      />
                      <span
                        aria-hidden="true"
                        className={cn(
                          'inline-flex size-6 shrink-0 items-center justify-center rounded-md border',
                          checked
                            ? 'border-accent bg-accent text-surface'
                            : 'border-ink-muted bg-surface',
                        )}
                      >
                        {checked ? <Check className="size-4" /> : null}
                      </span>
                      <span className="flex-1 font-medium">{extra.label}</span>
                      <span className="text-sm text-ink-muted">{formatMinor(extra.unitPrice)}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 text-xs text-ink-muted">{DEMO_DATA_NOTICE}</p>
          </fieldset>
        )}
      </section>

      <aside
        aria-labelledby="your-extras-heading"
        className="h-fit space-y-4 rounded-2xl border border-line bg-surface p-5 shadow-card"
      >
        <h2 id="your-extras-heading" className="text-3xl">
          Your extras
        </h2>
        {selections.extras.length > 0 ? (
          <ul className="divide-y divide-line text-sm">
            {selections.extras.map((entry) => (
              <li key={entry.extra.code} className="flex justify-between gap-3 py-2">
                <span>{entry.extra.label}</span>
                <span className="text-ink-muted">{formatMinor(entry.extra.unitPrice)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-muted">No extras selected.</p>
        )}
        <p className="text-xs text-ink-muted">
          Your estimate on the next step shows the priced total.
        </p>
        <ButtonLink href={stepHref(venue.slug, 'review')} size="lg" className="w-full">
          Continue to review <ArrowRight className="size-4" aria-hidden="true" />
        </ButtonLink>
      </aside>
    </div>
  );
}
