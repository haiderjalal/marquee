import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

/** Props for {@link KpiCard}. */
interface KpiCardProps {
  readonly label: string;
  readonly Icon: LucideIcon;
  /** Display value, or null when the module does not exist yet. */
  readonly value: string | null;
  /** Why there is no number, shown when value is null. */
  readonly unavailableReason: string;
}

/**
 * Key figure card. A null value renders "Not yet available" with its reason; the
 * dashboard never shows a placeholder number.
 * @param props Label, icon, value and the reason for a missing value.
 * @returns A card element.
 */
export function KpiCard({ label, Icon, value, unavailableReason }: KpiCardProps): ReactNode {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-4 shadow-card">
      <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-xl bg-terracotta-soft text-accent">
        <Icon className="size-6" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-sm text-ink-muted">{label}</p>
        {value !== null ? (
          <p className="font-serif text-4xl leading-tight">{value}</p>
        ) : (
          <>
            <p className="font-medium">Not yet available</p>
            <p className="text-xs text-ink-muted">{unavailableReason}</p>
          </>
        )}
      </div>
    </div>
  );
}
