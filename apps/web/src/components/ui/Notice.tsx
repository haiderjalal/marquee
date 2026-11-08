import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

/** Semantic tone of a notice. */
export type NoticeTone = 'info' | 'warning' | 'error' | 'success';

/** Props for {@link Notice}. */
interface NoticeProps {
  readonly tone?: NoticeTone;
  /** Announce changes to assistive technology. Use for validation and estimate updates. */
  readonly live?: boolean;
  readonly id?: string;
  readonly className?: string;
  readonly children: ReactNode;
}

const TONE_CLASSES: Readonly<Record<NoticeTone, string>> = {
  info: 'bg-sage-soft text-ink',
  success: 'bg-sage-soft text-ink',
  warning: 'bg-terracotta-soft text-ink',
  error: 'bg-danger-soft text-ink',
};

const TONE_ICON_CLASSES: Readonly<Record<NoticeTone, string>> = {
  info: 'text-sage-ink',
  success: 'text-sage-ink',
  warning: 'text-accent',
  error: 'text-danger',
};

/**
 * Picks the icon for a tone. Icons never carry meaning alone; the text does.
 * @param tone Notice tone.
 * @returns A decorative icon element.
 */
function ToneIcon({ tone }: { readonly tone: NoticeTone }): ReactNode {
  const className = cn('mt-0.5 size-5 shrink-0', TONE_ICON_CLASSES[tone]);
  if (tone === 'error') {
    return <XCircle className={className} aria-hidden="true" />;
  }
  if (tone === 'warning') {
    return <AlertTriangle className={className} aria-hidden="true" />;
  }
  if (tone === 'success') {
    return <CheckCircle2 className={className} aria-hidden="true" />;
  }
  return <Info className={className} aria-hidden="true" />;
}

/**
 * Inline message box for information, warnings, errors and success.
 * Errors use role="alert"; other live notices use role="status".
 * @param props Tone, optional live announcement and content.
 * @returns A notice element.
 */
export function Notice({
  tone = 'info',
  live = false,
  id,
  className,
  children,
}: NoticeProps): ReactNode {
  const role = tone === 'error' ? 'alert' : live ? 'status' : undefined;
  return (
    <div
      id={id}
      role={role}
      className={cn(
        'flex items-start gap-3 rounded-xl px-4 py-3 text-sm',
        TONE_CLASSES[tone],
        className,
      )}
    >
      <ToneIcon tone={tone} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
