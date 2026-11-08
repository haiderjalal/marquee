import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

/** Accessibility attributes passed to the control rendered inside a {@link Field}. */
export interface FieldControlProps {
  readonly id: string;
  readonly 'aria-describedby': string | undefined;
  readonly 'aria-invalid': boolean;
}

/** Props for {@link Field}. */
interface FieldProps {
  readonly id: string;
  readonly label: string;
  readonly error?: string | undefined;
  readonly hint?: string | undefined;
  readonly required?: boolean;
  readonly className?: string;
  /** Renders the control with the generated id and aria attributes. */
  readonly children: (props: FieldControlProps) => ReactNode;
}

/**
 * Label, control, hint and error text wired together with aria-describedby, so
 * every form field announces its error to screen readers.
 *
 * @param props Field id, label, optional hint and error, and a render function for the control.
 * @returns A labelled form field.
 */
export function Field({
  id,
  label,
  error,
  hint,
  required = false,
  className,
  children,
}: FieldProps): ReactNode {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy =
    [hintId, errorId].filter((value): value is string => value !== undefined).join(' ') ||
    undefined;
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
        {label}
        {required ? (
          <span aria-hidden="true" className="text-danger">
            {' '}
            *
          </span>
        ) : null}
      </label>
      {children({ id, 'aria-describedby': describedBy, 'aria-invalid': error !== undefined })}
      {hint ? (
        <p id={hintId} className="mt-1 text-xs text-ink-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className={cn('mt-1 text-sm text-danger')}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Shared classes for text-like inputs, selects and textareas. */
export const CONTROL_CLASSES =
  'min-h-11 w-full rounded-lg border border-line bg-surface px-3 py-2 aria-[invalid=true]:border-danger';
