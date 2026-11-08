import type { ReactNode } from 'react';

/** Platform height used for the illustration, in millimetres. */
const PLATFORM_MM = 600;

/** Props for {@link StageElevation}. */
interface StageElevationProps {
  readonly widthMm: number;
  readonly heightMm: number;
  readonly name: string;
  /** Zoom in percent. */
  readonly zoomPercent: number;
}

/**
 * Illustrative front elevation of a stage preset, drawn to the approved width and
 * height. It is a schematic, not a render of the real set: approved 3D presets and
 * photography arrive later, and the caption says so.
 *
 * @param props Preset dimensions, name and zoom.
 * @returns An SVG elevation inside a scrollable frame.
 */
export function StageElevation({
  widthMm,
  heightMm,
  name,
  zoomPercent,
}: StageElevationProps): ReactNode {
  const margin = 800;
  const totalHeight = heightMm + PLATFORM_MM;
  const archWidth = widthMm * 0.3;
  return (
    <div className="max-h-[60vh] overflow-auto rounded-xl bg-linear-to-b from-cream-deep to-terracotta-soft">
      <svg
        role="img"
        aria-label={`Front elevation of the ${name} stage: ${widthMm / 1000} metres wide and ${heightMm / 1000} metres high.`}
        viewBox={`${-margin} ${-margin} ${widthMm + margin * 2} ${totalHeight + margin * 2}`}
        style={{ width: `${zoomPercent}%` }}
        className="block h-auto"
      >
        <rect
          x={0}
          y={0}
          width={widthMm}
          height={heightMm}
          className="fill-surface stroke-line"
          strokeWidth={40}
        />
        <path
          d={`M ${widthMm / 2 - archWidth / 2} ${heightMm} V ${heightMm * 0.45} A ${archWidth / 2} ${archWidth / 2} 0 0 1 ${widthMm / 2 + archWidth / 2} ${heightMm * 0.45} V ${heightMm} Z`}
          className="fill-terracotta-soft stroke-accent"
          strokeWidth={40}
        />
        <rect
          x={-200}
          y={heightMm}
          width={widthMm + 400}
          height={PLATFORM_MM}
          className="fill-plan-stage stroke-accent"
          strokeWidth={40}
        />
        <text
          x={widthMm / 2}
          y={heightMm + PLATFORM_MM + 600}
          fontSize={420}
          textAnchor="middle"
          className="fill-ink-muted font-sans"
        >
          {name} — illustrative elevation
        </text>
      </svg>
    </div>
  );
}
