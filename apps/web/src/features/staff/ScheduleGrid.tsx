import type { ScheduleHoldDto } from '@marquee/contracts';
import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';
import { addDaysToLocalDate, formatDayHeader, localDateOf } from '@/lib/format';

/** Props for {@link ScheduleGrid}. */
interface ScheduleGridProps {
  /** First local date shown (YYYY-MM-DD). */
  readonly fromDate: string;
  readonly days: number;
  readonly holds: readonly ScheduleHoldDto[];
  /** Space labels to show even when empty, such as published spaces. */
  readonly knownSpaces: readonly string[];
}

/** A hold positioned on the day columns of the grid. */
interface PlacedHold {
  readonly hold: ScheduleHoldDto;
  readonly startColumn: number;
  readonly span: number;
}

/**
 * Builds the row label for a space.
 * @param hold Hold with venue and space names.
 * @returns "Venue" when the space name repeats it, otherwise "Venue · Space".
 */
function rowLabel(hold: Pick<ScheduleHoldDto, 'venueName' | 'spaceName'>): string {
  return hold.spaceName === hold.venueName
    ? hold.venueName
    : `${hold.venueName} · ${hold.spaceName}`;
}

/**
 * Positions a hold on the visible day columns, clamped to the window.
 * @param hold Hold to place.
 * @param dates Local dates shown, in order.
 * @returns Column placement, or null when the hold is outside the window.
 */
function placeHold(hold: ScheduleHoldDto, dates: readonly string[]): PlacedHold | null {
  const startDate = localDateOf(hold.occupiedFrom);
  const endDate = localDateOf(new Date(new Date(hold.occupiedUntil).getTime() - 1));
  const first = dates.findIndex((date) => date >= startDate && date <= endDate);
  if (first < 0) {
    return null;
  }
  let last = first;
  while (last + 1 < dates.length && (dates[last + 1] ?? '') <= endDate) {
    last += 1;
  }
  return { hold, startColumn: first + 1, span: last - first + 1 };
}

/**
 * Seven-day schedule by space. Confirmed holds are green, provisional holds amber,
 * and each block also states its status in text, so colour is never the only cue.
 *
 * @param props Window start, length, holds and extra empty rows.
 * @returns A grid with a horizontal scroll area on narrow screens.
 */
export function ScheduleGrid({ fromDate, days, holds, knownSpaces }: ScheduleGridProps): ReactNode {
  const dates = Array.from({ length: days }, (_, index) => addDaysToLocalDate(fromDate, index));
  const rows = new Map<string, PlacedHold[]>();
  for (const label of knownSpaces) {
    rows.set(label, []);
  }
  for (const hold of holds) {
    const placed = placeHold(hold, dates);
    if (placed) {
      const label = rowLabel(hold);
      rows.set(label, [...(rows.get(label) ?? []), placed]);
    }
  }
  const columns = { gridTemplateColumns: `repeat(${days}, minmax(5.5rem, 1fr))` };

  if (rows.size === 0) {
    return <p className="p-6 text-sm text-ink-muted">No spaces to show for this window.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[40rem] border-collapse text-sm">
        <caption className="sr-only">Venue schedule by space for the selected week</caption>
        <thead>
          <tr>
            <th
              scope="col"
              className="w-32 border-b border-line p-2 text-left font-medium text-ink-muted"
            >
              Space
            </th>
            <th scope="col" className="border-b border-line p-0">
              <div className="grid" style={columns}>
                {dates.map((date) => (
                  <span key={date} className="border-l border-line p-2 text-center font-medium">
                    {formatDayHeader(date)}
                  </span>
                ))}
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          {[...rows.entries()].map(([label, placed]) => (
            <tr key={label}>
              <th scope="row" className="border-b border-line p-2 text-left font-medium">
                {label}
              </th>
              <td className="border-b border-line p-0">
                <div className="relative grid min-h-16 gap-1 py-1" style={columns}>
                  {placed.map(({ hold, startColumn, span }) => (
                    <div
                      key={hold.id}
                      className={cn(
                        'z-10 rounded-md px-2 py-1 text-xs text-ink',
                        hold.status === 'confirmed' ? 'bg-sage' : 'bg-amber',
                      )}
                      style={{ gridColumn: `${startColumn} / span ${span}` }}
                    >
                      <p className="truncate font-medium">{hold.enquiryFullName ?? 'Held space'}</p>
                      <p className="truncate">
                        {hold.status === 'confirmed' ? 'Confirmed' : 'Hold'}
                      </p>
                    </div>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
