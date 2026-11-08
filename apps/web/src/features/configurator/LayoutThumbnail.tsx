import type { VenueShell } from '@marquee/spatial';
import type { ReactNode } from 'react';

import type { PlanGeometry } from './planGeometry';

/** Props for {@link LayoutThumbnail}. */
interface LayoutThumbnailProps {
  readonly shell: VenueShell;
  readonly geometry: PlanGeometry | null;
}

/**
 * Small schematic of the layout for the summary panel: stage, aisle and one dot
 * per table. Decorative; the counts beside it are the accessible content.
 *
 * @param props Shell and drawable geometry.
 * @returns A decorative SVG, or an empty frame while no layout exists.
 */
export function LayoutThumbnail({ shell, geometry }: LayoutThumbnailProps): ReactNode {
  const floor = shell.outerRect;
  const width = floor.maxXMm - floor.minXMm;
  const height = floor.maxYMm - floor.minYMm;
  const stage = shell.obstacles.find((obstacle) => obstacle.kind === 'stage')?.rect;
  const aisleWidth = shell.centralAisleWidthMm;
  return (
    <svg
      viewBox={`${floor.minXMm} ${floor.minYMm} ${width} ${height}`}
      aria-hidden="true"
      className="mx-auto h-auto w-full max-w-44 rounded-lg border border-line bg-plan-floor"
    >
      <rect
        x={floor.minXMm + width / 2 - aisleWidth / 2}
        y={floor.minYMm}
        width={aisleWidth}
        height={height}
        className="fill-plan-aisle"
      />
      {stage ? (
        <rect
          x={stage.minXMm}
          y={stage.minYMm}
          width={stage.maxXMm - stage.minXMm}
          height={stage.maxYMm - stage.minYMm}
          className="fill-plan-stage"
        />
      ) : null}
      {geometry?.tables.map((table) => (
        <circle
          key={table.id}
          cx={table.centre.xMm}
          cy={table.centre.yMm}
          r={geometry.template.footprintRadiusMm * 0.7}
          className="fill-plan-table stroke-line"
          strokeWidth={80}
        />
      ))}
    </svg>
  );
}
