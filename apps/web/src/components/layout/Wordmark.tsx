import Link from 'next/link';
import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

/** Props for {@link Wordmark}. */
interface WordmarkProps {
  readonly href?: string;
  /** Use light text on dark backgrounds such as the staff sidebar. */
  readonly onDark?: boolean;
  readonly className?: string;
}

/**
 * Product wordmark ("Event Studio" is the working name).
 * @param props Link target and colour mode.
 * @returns A link containing the wordmark.
 */
export function Wordmark({ href = '/', onDark = false, className }: WordmarkProps): ReactNode {
  return (
    <Link
      href={href}
      className={cn(
        'font-serif text-2xl font-medium uppercase tracking-[0.12em]',
        onDark ? 'text-on-plum' : 'text-ink',
        className,
      )}
    >
      Event Studio
    </Link>
  );
}
