import type { StaffOverviewDto } from '@marquee/contracts';
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Coins,
  MessageSquare,
  ShieldCheck,
  Plus,
  ArrowRight,
  Layers,
  CreditCard,
} from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { ApiErrorPanel } from '@/components/ui/ApiErrorPanel';
import { ButtonLink } from '@/components/ui/Button';
import { KpiCard } from '@/features/staff/KpiCard';
import { ScheduleGrid } from '@/features/staff/ScheduleGrid';
import { getPublicVenues } from '@/lib/api/server';
import { getStaffOverview } from '@/lib/api/staff.server';
import {
  addDaysToLocalDate,
  formatInstant,
  formatLocalDate,
  formatToday,
  greetingFor,
  localDateOf,
} from '@/lib/format';
import { formatMinor } from '@/lib/money';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Overview',
  description:
    'Staff overview: enquiries, holds and what needs attention. Demonstration workspace.',
};

/** Route search parameters (a Promise in Next.js 16). */
interface OverviewProps {
  readonly searchParams: Promise<{ readonly from?: string | string[] }>;
}

/**
 * Reads a valid YYYY-MM-DD value from a search parameter.
 * @param value Raw parameter.
 * @returns The date, or undefined when absent or malformed.
 */
function readDate(value: string | string[] | undefined): string | undefined {
  const text = Array.isArray(value) ? value[0] : value;
  return text && /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : undefined;
}

/**
 * Lists published space labels so empty spaces still get a schedule row.
 * @returns Space labels, or an empty list when venues cannot be loaded.
 */
async function loadKnownSpaces(): Promise<string[]> {
  try {
    const venues = await getPublicVenues();
    return venues.flatMap((venue) =>
      venue.spaces.map((space) =>
        space.name === venue.name ? venue.name : `${venue.name} · ${space.name}`,
      ),
    );
  } catch {
    return [];
  }
}

/**
 * Staff overview: KPIs, seven-day schedule, attention items and upcoming holds.
 * @param props Search params with an optional window start.
 * @returns The overview page.
 */
export default async function OverviewPage({ searchParams }: OverviewProps): Promise<ReactNode> {
  const { from } = await searchParams;
  const fromParam = readDate(from);
  let overview: StaffOverviewDto | null = null;
  let failure: unknown = null;
  try {
    overview = await getStaffOverview(fromParam);
  } catch (error) {
    failure = error;
  }
  const now = new Date();

  if (!overview) {
    return (
      <main id="main" className="px-4 py-10 md:px-8">
        <h1 className="sr-only">Overview</h1>
        <ApiErrorPanel title="The overview is not loading" error={failure} retryHref="/workspace" />
      </main>
    );
  }

  const knownSpaces = await loadKnownSpaces();

  const fromDate = localDateOf(overview.window.fromIso);
  const toDate = addDaysToLocalDate(fromDate, overview.window.days - 1);
  const upcoming = overview.schedule
    .filter((hold) => hold.status === 'held' || hold.status === 'confirmed')
    .slice(0, 8);
  const { kpis, attention } = overview;

  return (
    <main id="main" className="pb-10">
      <div className="bg-linear-to-br from-terracotta-soft via-cream-deep to-cream px-4 pb-6 pt-4 md:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-ink-muted">
            Workspace / <span className="font-medium text-ink">Overview</span>
          </p>
          <ButtonLink href="/workspace/new-booking" variant="primary">
            <Plus className="size-4" aria-hidden="true" /> New booking
          </ButtonLink>
        </div>
        <div className="mt-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-5xl md:text-6xl">{greetingFor(now)}.</h1>
            <p className="mt-2 text-lg text-ink-muted">Here is what needs your attention today.</p>
          </div>
          <div className="border-l border-line pl-4 text-sm">
            <p className="font-medium">{formatToday(now)}</p>
            <p className="text-ink-muted">Demo workspace</p>
          </div>
        </div>
      </div>

      <div className="space-y-6 px-4 pt-6 md:px-8">
        <section
          aria-label="Key figures"
          className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2 xl:grid-cols-4"
        >
          <KpiCard
            label="Upcoming events"
            Icon={CalendarDays}
            value={String(kpis.upcomingEvents)}
            unavailableReason=""
          />
          <KpiCard
            label="New enquiries"
            Icon={MessageSquare}
            value={String(kpis.newEnquiries)}
            unavailableReason=""
          />
          <KpiCard
            label="Awaiting verification"
            Icon={ShieldCheck}
            value={kpis.awaitingVerification === null ? null : String(kpis.awaitingVerification)}
            unavailableReason="Payments arrive in a later release."
          />
          <KpiCard
            label="Outstanding balance"
            Icon={Coins}
            value={kpis.outstandingBalance === null ? null : formatMinor(kpis.outstandingBalance)}
            unavailableReason="Billing arrives in a later release."
          />
        </section>

        <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <section
            aria-labelledby="schedule-heading"
            className="min-w-0 rounded-2xl border border-line bg-surface shadow-card"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 p-4">
              <h2 id="schedule-heading" className="text-3xl">
                Venue schedule
              </h2>
              <div className="flex items-center gap-2">
                <Link
                  href={`/workspace?from=${addDaysToLocalDate(fromDate, -7)}`}
                  aria-label="Previous week"
                  className="inline-flex size-11 items-center justify-center rounded-lg border border-line bg-surface hover:bg-cream-deep"
                >
                  <ChevronLeft className="size-5" aria-hidden="true" />
                </Link>
                <p className="min-w-36 text-center text-sm font-medium">
                  {formatLocalDate(fromDate)} – {formatLocalDate(toDate)}
                </p>
                <Link
                  href={`/workspace?from=${addDaysToLocalDate(fromDate, 7)}`}
                  aria-label="Next week"
                  className="inline-flex size-11 items-center justify-center rounded-lg border border-line bg-surface hover:bg-cream-deep"
                >
                  <ChevronRight className="size-5" aria-hidden="true" />
                </Link>
              </div>
            </div>
            <ul className="flex gap-4 px-4 pb-3 text-sm" aria-label="Legend">
              <li className="inline-flex items-center gap-2">
                <span className="size-3 rounded-full bg-sage" aria-hidden="true" /> Confirmed
              </li>
              <li className="inline-flex items-center gap-2">
                <span className="size-3 rounded-full bg-amber" aria-hidden="true" /> Hold
              </li>
            </ul>
            <ScheduleGrid
              fromDate={fromDate}
              days={overview.window.days}
              holds={overview.schedule}
              knownSpaces={knownSpaces}
            />
            {overview.schedule.length === 0 ? (
              <p className="p-4 text-sm text-ink-muted">
                No holds or confirmed events in this week.
              </p>
            ) : null}
          </section>

          <section
            aria-labelledby="attention-heading"
            className="h-fit rounded-2xl border border-line bg-surface p-4 shadow-card"
          >
            <h2 id="attention-heading" className="text-3xl">
              Needs attention
            </h2>
            <ul className="mt-3 divide-y divide-line text-sm">
              <AttentionItem
                Icon={CalendarDays}
                text={
                  attention.holdsExpiringToday === 0
                    ? 'No holds expire today'
                    : `${attention.holdsExpiringToday} ${attention.holdsExpiringToday === 1 ? 'hold expires' : 'holds expire'} today`
                }
                href="/workspace/bookings"
              />
              <AttentionItem
                Icon={MessageSquare}
                text={
                  attention.newEnquiries === 0
                    ? 'No new enquiries'
                    : `${attention.newEnquiries} new ${attention.newEnquiries === 1 ? 'enquiry' : 'enquiries'} to answer`
                }
                href="/workspace/enquiries"
              />
              <AttentionItem
                Icon={CreditCard}
                text={
                  attention.paymentsToVerify === null
                    ? 'Payments to verify: not yet available'
                    : `${attention.paymentsToVerify} payments to verify`
                }
                href="/workspace/payments"
              />
              <AttentionItem
                Icon={Layers}
                text={
                  attention.eventOrdersAwaitingApproval === null
                    ? 'Event orders: not yet available'
                    : `${attention.eventOrdersAwaitingApproval} event orders awaiting approval`
                }
                href="/workspace/event-orders"
              />
            </ul>
          </section>
        </div>

        <section
          aria-labelledby="upcoming-heading"
          className="rounded-2xl border border-line bg-surface p-4 shadow-card"
        >
          <h2 id="upcoming-heading" className="text-3xl">
            Upcoming events
          </h2>
          {upcoming.length === 0 ? (
            <p className="mt-3 text-sm text-ink-muted">
              No holds or confirmed events in this window.
            </p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[32rem] text-left text-sm">
                <thead className="bg-cream-deep text-ink-muted">
                  <tr>
                    <th scope="col" className="p-3 font-medium">
                      Event
                    </th>
                    <th scope="col" className="p-3 font-medium">
                      Venue
                    </th>
                    <th scope="col" className="p-3 font-medium">
                      Starts
                    </th>
                    <th scope="col" className="p-3 font-medium">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {upcoming.map((hold) => (
                    <tr key={hold.id} className="border-b border-line last:border-0">
                      <th scope="row" className="p-3 font-medium">
                        {hold.enquiryFullName ?? 'Held space'}
                      </th>
                      <td className="p-3">
                        {hold.venueName === hold.spaceName
                          ? hold.venueName
                          : `${hold.venueName} · ${hold.spaceName}`}
                      </td>
                      <td className="p-3">{formatInstant(hold.occupiedFrom)}</td>
                      <td className="p-3">
                        <span
                          className={
                            hold.status === 'confirmed'
                              ? 'rounded-full bg-sage px-3 py-1'
                              : 'rounded-full bg-amber px-3 py-1'
                          }
                        >
                          {hold.status === 'confirmed' ? 'Confirmed' : 'Held'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

/** Props for {@link AttentionItem}. */
interface AttentionItemProps {
  readonly Icon: typeof CalendarDays;
  readonly text: string;
  readonly href: string;
}

/**
 * One row in the "Needs attention" list.
 * @param props Icon, text and target.
 * @returns A list item with a link.
 */
function AttentionItem({ Icon, text, href }: AttentionItemProps): ReactNode {
  return (
    <li>
      <Link href={href} className="flex min-h-14 items-center gap-3 py-2 hover:text-accent">
        <span className="inline-flex size-9 items-center justify-center rounded-lg bg-terracotta-soft text-accent">
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <span className="flex-1">{text}</span>
        <ArrowRight className="size-4 text-ink-muted" aria-hidden="true" />
      </Link>
    </li>
  );
}
