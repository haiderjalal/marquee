import { ImageOff } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

/** Gradient flavours so neighbouring placeholders are distinguishable. */
export type PlaceholderTone = 'ivory' | 'blush' | 'garden' | 'royal';

const TONE_CLASSES: Readonly<Record<PlaceholderTone, string>> = {
  ivory: 'bg-linear-to-br from-cream-deep via-surface to-terracotta-soft',
  blush: 'bg-linear-to-br from-terracotta-soft via-cream-deep to-amber',
  garden: 'bg-linear-to-br from-sage-soft via-cream-deep to-sage',
  royal: 'bg-linear-to-br from-amber via-terracotta-soft to-plan-stage',
};

/** Props for {@link PhotoPlaceholder}. */
interface PhotoPlaceholderProps {
  readonly tone?: PlaceholderTone;
  /** Accessible description of what the photo will show once approved. */
  readonly label: string;
  /** Show the "Photo pending approval" caption. Hide it on small thumbnails. */
  readonly caption?: boolean;
  readonly className?: string;
}

/**
 * Labelled stand-in for photography that has not been approved yet. The product
 * never shows invented photographs; this block says so plainly.
 * @param props Tone, accessible label and sizing classes.
 * @returns A gradient block with an optional caption.
 */
export function PhotoPlaceholder({
  tone = 'ivory',
  label,
  caption = true,
  className,
}: PhotoPlaceholderProps): ReactNode {
  return (
    <div
      role="img"
      aria-label={`${label} — photo pending approval`}
      className={cn(
        'flex flex-col items-center justify-center gap-1 text-center text-ink-muted',
        TONE_CLASSES[tone],
        className,
      )}
    >
      <ImageOff className="size-5" aria-hidden="true" />
      {caption ? <span className="text-xs font-medium">Photo pending approval</span> : null}
    </div>
  );
}
