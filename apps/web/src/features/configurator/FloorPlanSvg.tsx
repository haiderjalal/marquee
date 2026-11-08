import { centralAisleRect, type RectMm, type VenueShell } from '@marquee/spatial';
import type { ReactNode } from 'react';

import type { PlanGeometry } from './planGeometry';
import type { Quarter } from './usePlanView';

/** Chair marker radius in millimetres (illustrative; the server owns chair positions). */
const CHAIR_RADIUS_MM = 230;

/** Label size in millimetres on the plan coordinate system. */
const LABEL_SIZE_MM = 900;

/** Props for {@link FloorPlanSvg}. */
interface FloorPlanSvgProps {
  readonly shell: VenueShell;
  readonly geometry: PlanGeometry | null;
  readonly quarter: Quarter;
  /** Zoom in percent; scrolls inside the frame rather than the page. */
  readonly zoomPercent: number;
  /** Replaces the shell's stage rectangle, used to preview a stage preset. */
  readonly stageOverride?: RectMm | null;
  /** Draws the stage with an emphasised outline. */
  readonly emphasiseStage?: boolean;
  readonly ariaLabel: string;
  /** Dim the drawing while a new layout is being requested. */
  readonly dimmed?: boolean;
}

/**
 * Draws a text label that stays upright when the plan is rotated.
 * @param props Position, rotation to cancel and text.
 * @returns An SVG text element.
 */
function PlanLabel({
  x,
  y,
  quarter,
  children,
}: {
  readonly x: number;
  readonly y: number;
  readonly quarter: Quarter;
  readonly children: string;
}): ReactNode {
  return (
    <text
      x={x}
      y={y}
      fontSize={LABEL_SIZE_MM}
      textAnchor="middle"
      dominantBaseline="middle"
      transform={`rotate(${-90 * quarter} ${x} ${y})`}
      className="fill-ink font-sans"
    >
      {children}
    </text>
  );
}

/**
 * Two-dimensional plan of the hall: floor, central aisle, stage, protected
 * entrance, tables and chairs. Chairs use the spatial package's ring positions,
 * so the picture matches the server layout exactly. This view works without
 * WebGL and is the accessible fallback for the 3D view.
 *
 * @param props Shell, geometry, view rotation, zoom and options.
 * @returns A scrollable SVG frame.
 */
export function FloorPlanSvg({
  shell,
  geometry,
  quarter,
  zoomPercent,
  stageOverride = null,
  emphasiseStage = false,
  ariaLabel,
  dimmed = false,
}: FloorPlanSvgProps): ReactNode {
  const floor = shell.outerRect;
  const width = floor.maxXMm - floor.minXMm;
  const height = floor.maxYMm - floor.minYMm;
  const centreX = floor.minXMm + width / 2;
  const centreY = floor.minYMm + height / 2;
  const sideways = quarter % 2 === 1;
  const viewWidth = sideways ? height : width;
  const viewHeight = sideways ? width : height;
  const viewBox = `${centreX - viewWidth / 2} ${centreY - viewHeight / 2} ${viewWidth} ${viewHeight}`;
  const aisle = centralAisleRect(shell);
  const stageObstacle = shell.obstacles.find((obstacle) => obstacle.kind === 'stage');
  const stageRect = stageOverride ?? stageObstacle?.rect ?? null;

  return (
    <div className="max-h-[70vh] overflow-auto rounded-xl bg-cream-deep">
      <svg
        role="img"
        aria-label={ariaLabel}
        viewBox={viewBox}
        style={{ width: `${zoomPercent}%` }}
        className={
          dimmed ? 'block h-auto opacity-60 transition-opacity' : 'block h-auto transition-opacity'
        }
      >
        <g transform={`rotate(${90 * quarter} ${centreX} ${centreY})`}>
          <rect
            x={floor.minXMm}
            y={floor.minYMm}
            width={width}
            height={height}
            className="fill-plan-floor stroke-line"
            strokeWidth={120}
          />
          <rect
            x={aisle.minXMm}
            y={aisle.minYMm}
            width={aisle.maxXMm - aisle.minXMm}
            height={aisle.maxYMm - aisle.minYMm}
            className="fill-plan-aisle"
            opacity={0.7}
          />
          {shell.obstacles
            .filter((obstacle) => obstacle.kind !== 'stage')
            .map((obstacle) => {
              const x = (obstacle.rect.minXMm + obstacle.rect.maxXMm) / 2;
              const y = (obstacle.rect.minYMm + obstacle.rect.maxYMm) / 2;
              return (
                <g key={obstacle.id}>
                  <rect
                    x={obstacle.rect.minXMm}
                    y={obstacle.rect.minYMm}
                    width={obstacle.rect.maxXMm - obstacle.rect.minXMm}
                    height={obstacle.rect.maxYMm - obstacle.rect.minYMm}
                    className="fill-plan-entrance"
                  />
                  {obstacle.kind === 'protected-entrance' ? (
                    <PlanLabel x={x} y={y} quarter={quarter}>
                      Entrance
                    </PlanLabel>
                  ) : null}
                </g>
              );
            })}
          {stageRect ? (
            <g>
              <rect
                x={stageRect.minXMm}
                y={stageRect.minYMm}
                width={stageRect.maxXMm - stageRect.minXMm}
                height={stageRect.maxYMm - stageRect.minYMm}
                className="fill-plan-stage stroke-accent"
                strokeWidth={emphasiseStage ? 220 : 60}
              />
              <PlanLabel
                x={(stageRect.minXMm + stageRect.maxXMm) / 2}
                y={(stageRect.minYMm + stageRect.maxYMm) / 2}
                quarter={quarter}
              >
                Stage
              </PlanLabel>
            </g>
          ) : null}
          {geometry?.tables.map((table) => (
            <g key={table.id}>
              {table.chairs.map((chair, index) => (
                <circle
                  key={`${table.id}-c${index}`}
                  cx={chair.xMm}
                  cy={chair.yMm}
                  r={CHAIR_RADIUS_MM}
                  className="fill-plan-chair"
                />
              ))}
              <circle
                cx={table.centre.xMm}
                cy={table.centre.yMm}
                r={geometry.template.tableRadiusMm}
                className="fill-plan-table stroke-line"
                strokeWidth={50}
              />
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}
