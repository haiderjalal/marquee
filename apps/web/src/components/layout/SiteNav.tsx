'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import { useDraftHydrated } from '@/hooks/useDraftHydration';
import { cn } from '@/lib/cn';
import { useDraftStore } from '@/store/draftStore';

/**
 * Primary navigation with the active page underlined. "Plan your event" and
 * "My event" open the configurator for the venue in the browser draft, or the
 * venue list when no venue has been chosen yet.
 * @returns A navigation landmark.
 */
export function SiteNav(): ReactNode {
  const pathname = usePathname();
  const hydrated = useDraftHydrated();
  const venueSlug = useDraftStore((state) => state.venueSlug);
  const planHref = hydrated && venueSlug ? `/plan/${venueSlug}` : '/#venues';

  const items = [
    { label: 'Venues', href: '/', active: pathname === '/' },
    { label: 'Plan your event', href: planHref, active: pathname.startsWith('/plan') },
    { label: 'My event', href: planHref, active: false },
  ];

  return (
    <nav aria-label="Primary" className="order-last w-full md:order-none md:w-auto">
      <ul className="flex items-center gap-6 text-sm">
        {items.map((item) => (
          <li key={item.label}>
            <Link
              href={item.href}
              aria-current={item.active ? 'page' : undefined}
              className={cn(
                'inline-flex min-h-11 items-center border-b-2 border-transparent',
                item.active
                  ? 'border-accent font-medium text-ink'
                  : 'text-ink-muted hover:text-ink',
              )}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
