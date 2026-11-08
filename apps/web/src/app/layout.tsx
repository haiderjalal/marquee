import { Cormorant_Garamond, Inter } from 'next/font/google';
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

import { DraftHydrator } from '@/hooks/useDraftHydration';

import './globals.css';

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-cormorant',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Event Studio — design your celebration',
    template: '%s · Event Studio',
  },
  description:
    'Explore wedding halls and marquees, plan your seating, menu and stage, and send a booking enquiry. Demonstration data.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

/**
 * Root layout: fonts, skip link and the one-time draft hydrator.
 * @param props Page content.
 * @returns The HTML document shell.
 */
export default function RootLayout({ children }: { readonly children: ReactNode }): ReactNode {
  return (
    <html lang="en" className={`${cormorant.variable} ${inter.variable}`}>
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-plum focus:px-4 focus:py-2 focus:text-on-plum"
        >
          Skip to main content
        </a>
        <DraftHydrator />
        {children}
      </body>
    </html>
  );
}
