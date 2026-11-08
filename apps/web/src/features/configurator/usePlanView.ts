'use client';

import { useCallback, useState } from 'react';

/** Zoom steps offered by the plan toolbar, in percent. */
export const ZOOM_LEVELS = [50, 75, 100, 125, 150, 200] as const;

/** Index of the 100 percent zoom level. */
const DEFAULT_ZOOM_INDEX = 2;

/** Which renderer shows the plan. */
export type PlanMode = '2d' | '3d';

/** Quarter turns applied to the view (0 to 3). Rotation changes the view only, never the layout. */
export type Quarter = 0 | 1 | 2 | 3;

/** All quarter-turn values, used to advance the rotation without casts. */
const QUARTERS: readonly Quarter[] = [0, 1, 2, 3];

/** View state shared between the side panel buttons and the plan canvas. */
export interface PlanView {
  readonly mode: PlanMode;
  readonly zoomIndex: number;
  readonly quarter: Quarter;
  /** Incremented by "Reset view" so renderers can restore their camera. */
  readonly resetToken: number;
}

/** Actions that change the {@link PlanView}. */
export interface PlanViewActions {
  setMode: (mode: PlanMode) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  setZoomIndex: (index: number) => void;
  rotate: () => void;
  reset: () => void;
}

/**
 * Holds the plan view state: renderer, zoom, rotation and reset signal.
 * The default renderer is 2D, which is always available.
 * @returns The current view and its actions.
 */
export function usePlanView(): { readonly view: PlanView; readonly actions: PlanViewActions } {
  const [view, setView] = useState<PlanView>({
    mode: '2d',
    zoomIndex: DEFAULT_ZOOM_INDEX,
    quarter: 0,
    resetToken: 0,
  });

  const setMode = useCallback((mode: PlanMode) => {
    setView((current) => ({ ...current, mode }));
  }, []);
  const setZoomIndex = useCallback((index: number) => {
    setView((current) => ({
      ...current,
      zoomIndex: Math.min(ZOOM_LEVELS.length - 1, Math.max(0, index)),
    }));
  }, []);
  const zoomIn = useCallback(() => {
    setView((current) => ({
      ...current,
      zoomIndex: Math.min(ZOOM_LEVELS.length - 1, current.zoomIndex + 1),
    }));
  }, []);
  const zoomOut = useCallback(() => {
    setView((current) => ({ ...current, zoomIndex: Math.max(0, current.zoomIndex - 1) }));
  }, []);
  const rotate = useCallback(() => {
    setView((current) => ({
      ...current,
      quarter: QUARTERS[(current.quarter + 1) % QUARTERS.length] ?? 0,
    }));
  }, []);
  const reset = useCallback(() => {
    setView((current) => ({
      ...current,
      zoomIndex: DEFAULT_ZOOM_INDEX,
      quarter: 0,
      resetToken: current.resetToken + 1,
    }));
  }, []);

  return { view, actions: { setMode, zoomIn, zoomOut, setZoomIndex, rotate, reset } };
}

/**
 * Reads the zoom percentage for a view.
 * @param view Current view.
 * @returns Zoom in percent (50 to 200).
 */
export function zoomPercent(view: PlanView): number {
  return ZOOM_LEVELS[view.zoomIndex] ?? 100;
}
