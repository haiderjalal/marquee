'use client';

import { MAX_REQUESTED_GUESTS } from '@marquee/domain';
import { Minus, Plus } from 'lucide-react';
import { useState, type ReactNode } from 'react';

import { cn } from '@/lib/cn';

/** Step used by the − and + buttons. */
const GUEST_STEP = 10;

/** Props for {@link GuestCountInput}. */
interface GuestCountInputProps {
  readonly id: string;
  readonly label: string;
  readonly value: number;
  /** Called with a whole number between 1 and the platform maximum. */
  readonly onCommit: (guests: number) => void;
  /** Show − and + buttons around the field. */
  readonly stepper?: boolean;
  /** Hide the visible label (an accessible label is still set). */
  readonly hideLabel?: boolean;
  readonly describedBy?: string;
  readonly className?: string;
}

/**
 * Parses text typed into the guest field.
 * @param text Raw input text.
 * @returns A valid guest count, or null when the text is not one.
 */
function parseGuests(text: string): number | null {
  if (!/^\d+$/.test(text)) {
    return null;
  }
  const guests = Number(text);
  return guests >= 1 && guests <= MAX_REQUESTED_GUESTS ? guests : null;
}

/**
 * Guest count field. Typing is free-form while editing and commits only valid
 * whole numbers; the stepper buttons move in steps of ten. Real buttons and a
 * labelled input keep every action available from the keyboard.
 *
 * @param props Field id, label, current value and commit callback.
 * @returns The field with optional stepper buttons.
 */
export function GuestCountInput({
  id,
  label,
  value,
  onCommit,
  stepper = false,
  hideLabel = false,
  describedBy,
  className,
}: GuestCountInputProps): ReactNode {
  const [editingText, setEditingText] = useState<string | null>(null);
  const text = editingText ?? String(value);
  const invalid = editingText !== null && parseGuests(editingText) === null;

  /**
   * Applies a stepper move, clamped to the supported range.
   * @param delta Signed number of guests to add.
   */
  function step(delta: number): void {
    setEditingText(null);
    onCommit(Math.min(MAX_REQUESTED_GUESTS, Math.max(1, value + delta)));
  }

  return (
    <div className={className}>
      <label
        htmlFor={id}
        className={cn('mb-1.5 block text-sm font-medium', hideLabel && 'sr-only')}
      >
        {label}
      </label>
      <div className="flex items-stretch overflow-hidden rounded-lg border border-line bg-surface focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent">
        {stepper ? (
          <button
            type="button"
            onClick={() => {
              step(-GUEST_STEP);
            }}
            disabled={value <= 1}
            aria-label={`Remove ${GUEST_STEP} guests`}
            className="inline-flex w-12 items-center justify-center border-r border-line hover:bg-cream-deep disabled:opacity-40"
          >
            <Minus className="size-4" aria-hidden="true" />
          </button>
        ) : null}
        <input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={text}
          aria-invalid={invalid}
          aria-describedby={describedBy}
          onChange={(event) => {
            const next = event.target.value.replace(/\s+/g, '');
            setEditingText(next);
            const parsed = parseGuests(next);
            if (parsed !== null) {
              onCommit(parsed);
            }
          }}
          onBlur={() => {
            setEditingText(null);
          }}
          className="min-h-11 w-full min-w-0 bg-transparent px-3 text-center outline-none"
        />
        {stepper ? (
          <button
            type="button"
            onClick={() => {
              step(GUEST_STEP);
            }}
            disabled={value >= MAX_REQUESTED_GUESTS}
            aria-label={`Add ${GUEST_STEP} guests`}
            className="inline-flex w-12 items-center justify-center border-l border-line hover:bg-cream-deep disabled:opacity-40"
          >
            <Plus className="size-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>
      {invalid ? (
        <p role="alert" className="mt-1 text-xs text-danger">
          Enter a whole number from 1 to {MAX_REQUESTED_GUESTS}.
        </p>
      ) : null}
    </div>
  );
}
