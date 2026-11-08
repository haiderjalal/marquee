'use client';

import type { RectMm, VenueShell } from '@marquee/spatial';
import { Minus, Plus, RotateCcw } from 'lucide-react';
import { useState, type ReactNode } from 'react';

import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { useWebGlSupport } from '@/hooks/useBrowserCapabilities';
import { cn } from '@/lib/cn';

import { FloorPlan3D } from './FloorPlan3DLoader';
import { FloorPlanSvg } from './FloorPlanSvg';
import type { PlanGeometry } from './planGeometry';
import { ZOOM_LEVELS, zoomPercent, type PlanView, type PlanViewActions } from './usePlanView';

/** Props for {@link PlanViewport}. */
interface PlanViewportProps {
  readonly shell: VenueShell;
  /** False when the shell is an approximation rather than the approved geometry. */
  readonly shellIsExact: boolean;
  readonly geometry: PlanGeometry | null;
  readonly view: PlanView;
  readonly actions: PlanViewActions;
  /** Describes the drawing for assistive technology, including counts. */
  readonly summary: string;
  /** Overlay text while the layout is updating or unavailable. */
  readonly overlayMessage?: string | null;
  readonly updating?: boolean;
  /** Footprint that replaces the shell stage (stage preview). */
  readonly stageOverride?: RectMm | null;
  readonly stageHeightMm?: number;
  readonly emphasiseStage?: boolean;
}

/** Legend entries; swatch classes come from the design tokens. */
const LEGEND = [
  { label: 'Tables', swatch: 'rounded-full border border-line bg-plan-table' },
  { label: 'Stage', swatch: 'rounded bg-plan-stage' },
  { label: 'Aisles', swatch: 'rounded bg-plan-aisle' },
] as const;

/** Default stage backdrop height when no preset is chosen. */
const DEFAULT_STAGE_HEIGHT_MM = 3_500;

/**
 * Plan canvas with the 3D / 2D toggle, zoom, reset and legend. 2D is the default
 * and the fallback: it is used when WebGL is unavailable, when the WebGL context is
 * lost, and whenever a visitor prefers it. The base route never imports three.js;
 * the 3D scene is loaded only on request.
 *
 * @param props Shell, geometry, view state and optional stage preview.
 * @returns The plan region with its toolbar.
 */
export function PlanViewport({
  shell,
  shellIsExact,
  geometry,
  view,
  actions,
  summary,
  overlayMessage = null,
  updating = false,
  stageOverride = null,
  stageHeightMm = DEFAULT_STAGE_HEIGHT_MM,
  emphasiseStage = false,
}: PlanViewportProps): ReactNode {
  const webGl = useWebGlSupport();
  const [contextLost, setContextLost] = useState(false);
  const wants3d = view.mode === '3d';
  const show3d = wants3d && webGl === true && !contextLost;
  const stageRect =
    stageOverride ?? shell.obstacles.find((obstacle) => obstacle.kind === 'stage')?.rect ?? null;
  const percent = zoomPercent(view);

  return (
    <section
      aria-label="Floor plan"
      className="rounded-2xl border border-line bg-surface p-2 shadow-card"
    >
      <div className="relative">
        <div
          className="absolute left-3 top-3 z-10 inline-flex rounded-lg bg-surface p-1 shadow-card"
          role="group"
          aria-label="Plan view"
        >
          {(['3d', '2d'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              aria-pressed={view.mode === mode}
              onClick={() => {
                actions.setMode(mode);
                setContextLost(false);
              }}
              className={cn(
                'min-h-9 min-w-12 rounded-md px-3 text-sm font-medium',
                view.mode === mode ? 'bg-accent text-surface' : 'text-ink hover:bg-cream-deep',
              )}
            >
              {mode === '3d' ? '3D' : '2D'}
            </button>
          ))}
        </div>

        {show3d ? (
          <FloorPlan3D
            shell={shell}
            geometry={geometry}
            quarter={view.quarter}
            zoomPercent={percent}
            resetToken={view.resetToken}
            stageRect={stageRect}
            stageHeightMm={stageHeightMm}
            ariaLabel={summary}
            onContextLost={() => {
              setContextLost(true);
            }}
          />
        ) : (
          <FloorPlanSvg
            shell={shell}
            geometry={geometry}
            quarter={view.quarter}
            zoomPercent={percent}
            stageOverride={stageOverride}
            emphasiseStage={emphasiseStage}
            ariaLabel={summary}
            dimmed={updating}
          />
        )}

        {overlayMessage ? (
          <p
            role="status"
            className="pointer-events-none absolute inset-x-4 bottom-4 rounded-lg bg-surface/95 px-3 py-2 text-center text-sm shadow-card"
          >
            {overlayMessage}
          </p>
        ) : null}
      </div>

      {wants3d && webGl === false ? (
        <Notice tone="info" live className="mt-2">
          3D view needs WebGL, which this browser does not provide. Showing the 2D plan instead; you
          can finish your plan without 3D.
        </Notice>
      ) : null}
      {wants3d && contextLost ? (
        <Notice tone="warning" live className="mt-2">
          The 3D view stopped because the graphics context was lost. Showing the 2D plan instead.
        </Notice>
      ) : null}
      {!shellIsExact ? (
        <Notice tone="info" className="mt-2">
          Hall outline is approximate until the measured shell is published.
        </Notice>
      ) : null}

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 px-2 pb-1">
        <div className="flex items-center gap-1" role="group" aria-label="Zoom">
          <Button
            variant="secondary"
            aria-label="Zoom out"
            onClick={actions.zoomOut}
            disabled={view.zoomIndex === 0}
            className="px-3"
          >
            <Minus className="size-4" aria-hidden="true" />
          </Button>
          <label className="sr-only" htmlFor="plan-zoom">
            Zoom level
          </label>
          <select
            id="plan-zoom"
            value={view.zoomIndex}
            onChange={(event) => {
              actions.setZoomIndex(Number(event.target.value));
            }}
            className="min-h-11 rounded-lg border border-line bg-surface px-2 text-sm"
          >
            {ZOOM_LEVELS.map((level, index) => (
              <option key={level} value={index}>
                {level}%
              </option>
            ))}
          </select>
          <Button
            variant="secondary"
            aria-label="Zoom in"
            onClick={actions.zoomIn}
            disabled={view.zoomIndex === ZOOM_LEVELS.length - 1}
            className="px-3"
          >
            <Plus className="size-4" aria-hidden="true" />
          </Button>
        </div>
        <Button variant="secondary" onClick={actions.reset}>
          <RotateCcw className="size-4" aria-hidden="true" /> Reset view
        </Button>
        <ul
          className="ml-auto flex flex-wrap items-center gap-4 text-sm text-ink-muted"
          aria-label="Legend"
        >
          {LEGEND.map((entry) => (
            <li key={entry.label} className="inline-flex items-center gap-2">
              <span className={cn('inline-block size-4', entry.swatch)} aria-hidden="true" />
              {entry.label}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
