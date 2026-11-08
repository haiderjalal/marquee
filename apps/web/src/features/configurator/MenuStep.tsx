'use client';

import type { PublicMenuPackageDto } from '@marquee/contracts';
import {
  ArrowRight,
  Award,
  Check,
  ChevronLeft,
  ChevronRight,
  UtensilsCrossed,
  UsersRound,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';

import { Button, ButtonLink } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { PhotoPlaceholder, type PlaceholderTone } from '@/components/ui/PhotoPlaceholder';
import { DEMO_DATA_NOTICE } from '@/constants/labels';
import {
  dishMatchesCategory,
  MENU_CATEGORIES,
  type MenuCategory,
} from '@/constants/menuCategories';
import { useQuotePreview } from '@/hooks/useQuotePreview';
import { friendlyErrorMessage, supportLine } from '@/lib/api/errors';
import { cn } from '@/lib/cn';
import { formatMinor } from '@/lib/money';
import { useDraftStore } from '@/store/draftStore';

import type { StepProps } from './layoutState';
import { stepHref } from './steps';
import { buildQuoteInput, useSelections } from './useSelections';

/** Placeholder tones, cycled by package position. */
const TONES: readonly PlaceholderTone[] = ['royal', 'blush', 'garden'];

/**
 * Selects a placeholder tone for a package position.
 * @param index Position in the package list.
 * @returns A gradient tone.
 */
function toneFor(index: number): PlaceholderTone {
  return TONES[index % TONES.length] ?? 'ivory';
}

/**
 * Menu step: package carousel, course filter, package cards and the "Your menu"
 * panel. The menu subtotal is the catering line returned by the server quote
 * preview; the browser never multiplies price by guests.
 *
 * @param props Venue and validation state (validation is used by other steps).
 * @returns The menu step layout.
 */
export function MenuStep({ venue }: StepProps): ReactNode {
  const guests = useDraftStore((state) => state.guests);
  const seatsPerTable = useDraftStore((state) => state.seatsPerTable);
  const setPackage = useDraftStore((state) => state.setPackage);
  const selections = useSelections(venue);
  const [browsedIndex, setBrowsedIndex] = useState<number | null>(null);
  const [category, setCategory] = useState<MenuCategory>('All courses');
  const packages = venue.menuPackages;
  const selectedIndex = packages.findIndex((entry) => entry.id === selections.menuPackage?.id);
  // The carousel follows the chosen package until the visitor browses to another slide.
  const activeIndex = browsedIndex ?? Math.max(0, selectedIndex);
  const slidePackage: PublicMenuPackageDto | null = packages[activeIndex] ?? null;

  const quote = useQuotePreview(
    buildQuoteInput(venue, selections, guests, seatsPerTable, {
      includeStage: false,
      includeExtras: false,
    }),
  );
  const cateringLine =
    quote.status === 'ready'
      ? (quote.data.lines.find((line) => line.code === 'CATERING') ?? null)
      : null;

  /**
   * Moves the carousel by one slide, wrapping at the ends.
   * @param delta -1 for previous, 1 for next.
   */
  function moveSlide(delta: number): void {
    if (packages.length > 0) {
      setBrowsedIndex((activeIndex + delta + packages.length) % packages.length);
    }
  }

  /**
   * Selects a package and brings its slide into view.
   * @param index Position of the package.
   * @param entry The package chosen.
   */
  function choosePackage(index: number, entry: PublicMenuPackageDto): void {
    setPackage(entry.id);
    setBrowsedIndex(index);
  }

  const dishes = slidePackage?.includes.filter((dish) => dishMatchesCategory(dish, category)) ?? [];

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_21rem]">
      <section aria-labelledby="menu-heading" className="min-w-0">
        <h1 id="menu-heading" className="text-4xl md:text-6xl">
          A menu worth celebrating.
        </h1>
        <p className="mt-2 text-lg text-ink-muted">Explore your package, course by course.</p>

        {packages.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-line bg-surface p-10 text-center">
            <p className="font-serif text-2xl">
              No menu packages are published for this venue yet.
            </p>
            <p className="mt-2 text-ink-muted">
              Please check back soon, or send an enquiry and we will help.
            </p>
          </div>
        ) : (
          <>
            <div
              role="group"
              aria-roledescription="carousel"
              aria-label="Menu packages"
              className="relative mt-6 overflow-hidden rounded-2xl"
            >
              {packages.map((entry, index) => (
                <div
                  key={entry.id}
                  role="group"
                  aria-roledescription="slide"
                  aria-label={`${index + 1} of ${packages.length}: ${entry.name}`}
                  hidden={index !== activeIndex}
                >
                  <PhotoPlaceholder
                    label={`${entry.name} menu`}
                    tone={toneFor(index)}
                    className="aspect-[16/8] w-full"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-plum-deep/80 to-transparent p-5 text-on-plum">
                    <p className="font-serif text-3xl">{entry.name}</p>
                    <p className="text-sm text-on-plum-muted">{entry.description}</p>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={() => {
                  moveSlide(-1);
                }}
                aria-label="Previous package"
                className="absolute left-3 top-1/2 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-surface shadow-card"
              >
                <ChevronLeft className="size-5" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => {
                  moveSlide(1);
                }}
                aria-label="Next package"
                className="absolute right-3 top-1/2 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-surface shadow-card"
              >
                <ChevronRight className="size-5" aria-hidden="true" />
              </button>
            </div>
            <div
              className="mt-3 flex justify-center gap-1"
              role="group"
              aria-label="Choose a slide"
            >
              {packages.map((entry, index) => (
                <button
                  key={entry.id}
                  type="button"
                  aria-label={`Show ${entry.name}`}
                  aria-current={index === activeIndex}
                  onClick={() => {
                    setBrowsedIndex(index);
                  }}
                  className="inline-flex size-6 items-center justify-center"
                >
                  <span
                    className={cn(
                      'size-2.5 rounded-full',
                      index === activeIndex ? 'bg-accent' : 'bg-line',
                    )}
                  />
                </button>
              ))}
            </div>

            <div
              role="group"
              aria-label="Filter dishes by course"
              className="mt-5 flex flex-wrap gap-1 rounded-xl border border-line bg-surface p-1"
            >
              {MENU_CATEGORIES.map((entry) => (
                <button
                  key={entry}
                  type="button"
                  aria-pressed={category === entry}
                  onClick={() => {
                    setCategory(entry);
                  }}
                  className={cn(
                    'min-h-10 flex-1 whitespace-nowrap rounded-lg px-3 text-sm',
                    category === entry
                      ? 'bg-terracotta-soft font-medium text-accent'
                      : 'text-ink hover:bg-cream-deep',
                  )}
                >
                  {entry}
                </button>
              ))}
            </div>

            <div aria-live="polite" className="mt-4">
              <p className="text-sm font-medium">
                {slidePackage ? `Included in ${slidePackage.name}` : 'Included dishes'}
              </p>
              {dishes.length > 0 ? (
                <ul className="mt-2 flex flex-wrap gap-2">
                  {dishes.map((dish) => (
                    <li
                      key={dish}
                      className="rounded-full border border-line bg-surface px-3 py-1 text-sm"
                    >
                      {dish}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-ink-muted">
                  No dishes in this course for this package.
                </p>
              )}
            </div>

            <h2 className="mt-8 font-serif text-2xl">Demo packages</h2>
            <p className="text-xs text-ink-muted">{DEMO_DATA_NOTICE}</p>
            <div
              role="radiogroup"
              aria-label="Menu package"
              className="mt-3 grid gap-3 sm:grid-cols-3"
            >
              {packages.map((entry, index) => {
                const selected = selections.menuPackage?.id === entry.id;
                return (
                  <label
                    key={entry.id}
                    className={cn(
                      'relative flex cursor-pointer items-center gap-3 rounded-2xl border bg-surface p-3 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent',
                      selected
                        ? 'border-2 border-terracotta bg-terracotta-soft'
                        : 'border-line hover:bg-cream-deep',
                    )}
                  >
                    <input
                      type="radio"
                      name="menu-package"
                      value={entry.id}
                      checked={selected}
                      onChange={() => {
                        choosePackage(index, entry);
                      }}
                      className="sr-only"
                    />
                    <PhotoPlaceholder
                      label={entry.name}
                      tone={toneFor(index)}
                      caption={false}
                      className="size-16 shrink-0 rounded-lg"
                    />
                    <span className="min-w-0">
                      <span className="block font-serif text-2xl leading-tight">{entry.name}</span>
                      <span className="block text-sm text-accent">
                        {formatMinor(entry.pricePerGuest)} / guest
                      </span>
                    </span>
                    {selected ? (
                      <span className="absolute right-2 top-2 inline-flex size-6 items-center justify-center rounded-full bg-accent text-surface">
                        <Check className="size-4" aria-hidden="true" />
                        <span className="sr-only">Selected</span>
                      </span>
                    ) : null}
                  </label>
                );
              })}
            </div>
          </>
        )}
      </section>

      <aside
        aria-labelledby="your-menu-heading"
        className="h-fit rounded-2xl border border-line bg-surface p-5 shadow-card"
      >
        <h2 id="your-menu-heading" className="text-3xl">
          Your menu
        </h2>
        {selections.menuPackage ? (
          <>
            <div className="mt-4 flex items-center gap-3 rounded-xl bg-cream-deep p-3">
              <Award className="size-7 text-accent" aria-hidden="true" />
              <div>
                <p className="font-serif text-2xl leading-tight">{selections.menuPackage.name}</p>
                <p className="text-sm text-ink-muted">
                  {formatMinor(selections.menuPackage.pricePerGuest)} per guest
                </p>
              </div>
            </div>
            <h3 className="mt-5 font-sans text-sm font-medium text-ink-muted">Includes</h3>
            <ul className="mt-2 divide-y divide-line">
              {selections.menuPackage.includes.map((dish) => (
                <li key={dish} className="flex items-center gap-3 py-2 text-sm">
                  <UtensilsCrossed className="size-4 text-ink-muted" aria-hidden="true" />
                  {dish}
                </li>
              ))}
            </ul>
            <div className="mt-5 border-t border-line pt-4" aria-live="polite">
              <div className="flex items-center justify-between gap-3">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <UsersRound className="size-4 text-ink-muted" aria-hidden="true" />
                  {quote.status === 'ready' ? quote.data.billableGuests : guests} guests
                </p>
                <div className="text-right">
                  <p className="text-xs text-ink-muted">Menu subtotal</p>
                  <p className="font-serif text-3xl">
                    {cateringLine
                      ? formatMinor(cateringLine.amount)
                      : quote.status === 'error'
                        ? '—'
                        : 'Calculating…'}
                  </p>
                </div>
              </div>
              <p className="mt-1 text-right text-xs italic text-ink-muted">
                Before applicable taxes
              </p>
              {quote.status === 'ready' && quote.data.billableGuests !== guests ? (
                <p className="mt-2 text-xs text-ink-muted">
                  Billed for {quote.data.billableGuests} guests under the venue&apos;s minimum
                  headcount.
                </p>
              ) : null}
              {quote.status === 'error' ? (
                <Notice tone="error" className="mt-3">
                  <p>{friendlyErrorMessage(quote.error)}</p>
                  {supportLine(quote.error) ? (
                    <p className="mt-1 text-xs">{supportLine(quote.error)}</p>
                  ) : null}
                </Notice>
              ) : null}
            </div>
          </>
        ) : (
          <p className="mt-4 text-sm text-ink-muted">
            Choose a package to see what it includes and its subtotal.
          </p>
        )}
        <div className="mt-6">
          {selections.menuPackage ? (
            <ButtonLink href={stepHref(venue.slug, 'stage')} size="lg" className="w-full">
              Continue to stage <ArrowRight className="size-4" aria-hidden="true" />
            </ButtonLink>
          ) : (
            <Button size="lg" className="w-full" disabled>
              Continue to stage <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
          )}
        </div>
      </aside>
    </div>
  );
}
