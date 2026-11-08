import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

import { ButtonLink } from '@/components/ui/Button';
import { STAFF_NAV_ITEMS } from '@/features/staff/staffNavItems';

export const dynamic = 'force-dynamic';

/** Route parameters (a Promise in Next.js 16). */
interface SectionProps {
  readonly params: Promise<{ readonly section: string }>;
}

/** Titles for workspace routes that are not in the sidebar. */
const EXTRA_TITLES: Readonly<Record<string, string>> = { 'new-booking': 'New booking' };

/**
 * Resolves the display title of a workspace section.
 * @param section Route segment.
 * @returns The title, or null for an unknown section.
 */
function titleFor(section: string): string | null {
  const item = STAFF_NAV_ITEMS.find((entry) => entry.href === `/workspace/${section}`);
  return item?.label ?? EXTRA_TITLES[section] ?? null;
}

/**
 * Builds metadata for a section page.
 * @param props Route params.
 * @returns Title and description.
 */
export async function generateMetadata({ params }: SectionProps): Promise<Metadata> {
  const { section } = await params;
  return {
    title: titleFor(section) ?? 'Not found',
    description: 'This part of the workspace arrives in a later release.',
  };
}

/**
 * Placeholder for workspace sections that are not built yet.
 * @param props Route params.
 * @returns A clear "coming in a later release" page, or 404 for unknown sections.
 */
export default async function SectionPage({ params }: SectionProps): Promise<ReactNode> {
  const { section } = await params;
  const title = titleFor(section);
  if (!title) {
    notFound();
  }
  return (
    <main id="main" className="px-4 py-10 md:px-8">
      <div className="max-w-xl rounded-2xl border border-line bg-surface p-8 shadow-card">
        <h1 className="text-5xl">{title}</h1>
        <p className="mt-4 font-medium">Coming in a later release</p>
        <p className="mt-2 text-ink-muted">
          This screen is not built yet. Nothing on it is hidden or fake; it simply does not exist in
          this version.
        </p>
        <div className="mt-6">
          <ButtonLink href="/workspace" variant="secondary">
            Back to overview
          </ButtonLink>
        </div>
      </div>
    </main>
  );
}
