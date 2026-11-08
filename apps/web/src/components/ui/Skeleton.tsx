import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

/** Props for {@link Skeleton}. */
interface SkeletonProps {
  readonly className?: string;
}

/**
 * Pulsing placeholder block for loading states. Hidden from assistive technology;
 * pair it with a visible or screen-reader loading message.
 * @param props Optional sizing classes.
 * @returns A placeholder element.
 */
export function Skeleton({ className }: SkeletonProps): ReactNode {
  return (
    <div aria-hidden="true" className={cn('animate-pulse rounded-lg bg-cream-deep', className)} />
  );
}
