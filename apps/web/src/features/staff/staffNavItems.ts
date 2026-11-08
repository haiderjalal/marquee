import {
  CalendarDays,
  ClipboardList,
  CreditCard,
  Home,
  Layers,
  MessageSquare,
  Package,
  Settings,
  Users,
  type LucideIcon,
} from 'lucide-react';

/** One entry in the staff sidebar. */
export interface StaffNavItem {
  readonly label: string;
  readonly href: string;
  readonly Icon: LucideIcon;
  /** Whether the screen exists in this release. */
  readonly available: boolean;
}

/** Sidebar entries in display order. Only Overview and Enquiries are built in this slice. */
export const STAFF_NAV_ITEMS: readonly StaffNavItem[] = [
  { label: 'Overview', href: '/workspace', Icon: Home, available: true },
  { label: 'Calendar', href: '/workspace/calendar', Icon: CalendarDays, available: false },
  { label: 'Enquiries', href: '/workspace/enquiries', Icon: MessageSquare, available: true },
  { label: 'Bookings', href: '/workspace/bookings', Icon: Layers, available: false },
  { label: 'Payments', href: '/workspace/payments', Icon: CreditCard, available: false },
  { label: 'Event orders', href: '/workspace/event-orders', Icon: ClipboardList, available: false },
  { label: 'Inventory', href: '/workspace/inventory', Icon: Package, available: false },
  { label: 'Team', href: '/workspace/team', Icon: Users, available: false },
  { label: 'Settings', href: '/workspace/settings', Icon: Settings, available: false },
];
