import Link from 'next/link';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';

import { cn } from '@/lib/cn';

/** Visual hierarchy of a button. */
export type ButtonVariant = 'primary' | 'accent' | 'secondary' | 'ghost';

/** Size scale for buttons. */
export type ButtonSize = 'md' | 'lg';

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50';

const VARIANTS: Readonly<Record<ButtonVariant, string>> = {
  primary: 'bg-plum text-on-plum hover:bg-plum-hover',
  accent: 'bg-accent text-surface hover:bg-accent-hover',
  secondary: 'border border-line bg-surface text-ink hover:bg-cream-deep',
  ghost: 'text-ink hover:bg-cream-deep',
};

const SIZES: Readonly<Record<ButtonSize, string>> = {
  md: 'min-h-11 px-4 text-sm',
  lg: 'min-h-12 px-5 text-base',
};

/**
 * Builds the class list shared by buttons and button-styled links.
 * @param variant Visual hierarchy.
 * @param size Size step.
 * @param extra Additional classes appended last.
 * @returns A class string.
 */
export function buttonClasses(
  variant: ButtonVariant,
  size: ButtonSize = 'md',
  extra?: string,
): string {
  return cn(BASE, VARIANTS[variant], SIZES[size], extra);
}

/** Props for {@link Button}. */
interface ButtonProps extends ComponentPropsWithoutRef<'button'> {
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
}

/**
 * Standard button. Defaults to type="button" so it never submits a form by accident.
 * @param props Native button props plus variant and size.
 * @returns A styled button element.
 */
export function Button({
  variant = 'primary',
  size = 'md',
  className,
  type = 'button',
  ...rest
}: ButtonProps): ReactNode {
  return <button type={type} className={buttonClasses(variant, size, className)} {...rest} />;
}

/** Props for {@link ButtonLink}. */
interface ButtonLinkProps extends Omit<ComponentPropsWithoutRef<typeof Link>, 'className'> {
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
  readonly className?: string;
}

/**
 * Link styled as a button, for navigation that should look like an action.
 * @param props Next.js Link props plus variant and size.
 * @returns A styled link.
 */
export function ButtonLink({
  variant = 'primary',
  size = 'md',
  className,
  ...rest
}: ButtonLinkProps): ReactNode {
  return <Link className={buttonClasses(variant, size, className)} {...rest} />;
}
