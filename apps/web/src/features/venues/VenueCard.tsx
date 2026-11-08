import type { PublicVenueSummaryDto } from '@marquee/contracts';
import { Check, Home, Trees, Users } from 'lucide-react';
import Image from 'next/image';
import type { ReactNode } from 'react';

import { PhotoPlaceholder } from '@/components/ui/PhotoPlaceholder';
import { cn } from '@/lib/cn';

/** Props for {@link VenueCard}. */
interface VenueCardProps {
  readonly venue: PublicVenueSummaryDto;
  readonly selected: boolean;
  /** Radio group name shared by every card. */
  readonly groupName: string;
  readonly onSelect: (slug: string) => void;
}

/** Facilities shown on a card before the rest are summarised. */
const MAX_FACILITIES_SHOWN = 3;

/**
 * Describes a venue's setting from published facts only.
 * @param venue Published venue card data.
 * @returns "Indoor", "Indoor + lawn" or "Outdoor".
 */
function settingLabel(venue: PublicVenueSummaryDto): string {
  const hasLawn = venue.facilities.some((facility) => /lawn|garden/i.test(facility));
  if (venue.indoor) {
    return hasLawn ? 'Indoor + lawn' : 'Indoor';
  }
  return 'Outdoor';
}

/**
 * Selectable venue card. It is a labelled radio input, so selection works with the
 * keyboard (arrow keys within the group) and screen readers announce the state.
 * @param props Venue data, selection state and handler.
 * @returns A card element.
 */
export function VenueCard({ venue, selected, groupName, onSelect }: VenueCardProps): ReactNode {
  const SettingIcon = venue.indoor ? Home : Trees;
  const facilities = venue.facilities.filter(
    (facility) => !/lawn|garden|^indoor$|^outdoor$/i.test(facility),
  );
  return (
    <label
      className={cn(
        'relative block overflow-hidden rounded-2xl border bg-surface shadow-card transition-shadow focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent hover:shadow-md',
        selected ? 'border-2 border-terracotta' : 'border-line',
      )}
    >
      <input
        type="radio"
        name={groupName}
        value={venue.slug}
        checked={selected}
        onChange={() => {
          onSelect(venue.slug);
        }}
        className="sr-only"
      />
      <div className="relative aspect-[16/9]">
        {venue.photo ? (
          <Image
            src={venue.photo.url}
            alt={venue.photo.alt}
            fill
            unoptimized
            sizes="(min-width: 768px) 50vw, 100vw"
            className="object-cover"
          />
        ) : (
          <PhotoPlaceholder
            label={venue.name}
            tone={venue.indoor ? 'ivory' : 'garden'}
            className="absolute inset-0"
          />
        )}
        {selected ? (
          <span className="absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-surface">
            <Check className="size-4" aria-hidden="true" /> Selected
          </span>
        ) : null}
      </div>
      <div className="px-5 pb-5 pt-4">
        <h3 className="text-3xl">{venue.name}</h3>
        <p className="mt-1 text-sm text-ink-muted">{venue.tagline}</p>
        <ul className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          <li className="inline-flex items-center gap-2">
            <Users className="size-4 text-ink-muted" aria-hidden="true" />
            Up to {venue.publishedCapacityGuests.toLocaleString('en-GB')} guests
          </li>
          <li className="inline-flex items-center gap-2">
            <SettingIcon className="size-4 text-ink-muted" aria-hidden="true" />
            {settingLabel(venue)}
          </li>
          {facilities.slice(0, MAX_FACILITIES_SHOWN).map((facility) => (
            <li key={facility} className="inline-flex items-center gap-2">
              <Check className="size-4 text-ink-muted" aria-hidden="true" />
              {facility}
            </li>
          ))}
        </ul>
      </div>
    </label>
  );
}
