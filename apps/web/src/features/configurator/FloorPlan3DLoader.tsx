'use client';

import dynamic from 'next/dynamic';
import type { ReactNode } from 'react';

import { Skeleton } from '@/components/ui/Skeleton';

/**
 * Lazily loaded 3D scene. `ssr: false` keeps three.js out of the server render
 * and out of the base route bundle; it is fetched only when a visitor switches
 * to the 3D view.
 */
export const FloorPlan3D = dynamic(() => import('./FloorPlan3D'), {
  ssr: false,
  loading: (): ReactNode => (
    <div role="status" className="relative aspect-[4/3] w-full sm:aspect-[16/10]">
      <Skeleton className="absolute inset-0" />
      <p className="absolute inset-0 flex items-center justify-center text-sm text-ink-muted">
        Loading 3D view…
      </p>
    </div>
  ),
});
