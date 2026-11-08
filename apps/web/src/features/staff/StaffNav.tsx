'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

import { STAFF_NAV_ITEMS } from './staffNavItems';

/**
 * Staff sidebar navigation with the active section highlighted. Sections that are
 * not built yet still link to a clear "coming later" page.
 * @returns A navigation landmark.
 */
export function StaffNav(): ReactNode {
  const pathname = usePathname();
  return (
    <nav aria-label="Workspace" className="overflow-x-auto lg:overflow-visible">
      <ul className="flex gap-1 lg:flex-col">
        {STAFF_NAV_ITEMS.map(({ label, href, Icon }) => {
          const active = href === '/workspace' ? pathname === href : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex min-h-11 items-center gap-3 whitespace-nowrap rounded-lg px-3 text-sm',
                  active
                    ? 'bg-terracotta text-plum-deep'
                    : 'text-on-plum-muted hover:bg-plum-line hover:text-on-plum',
                )}
              >
                <Icon className="size-5" aria-hidden="true" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
