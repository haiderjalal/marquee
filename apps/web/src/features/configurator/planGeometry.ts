import type { ConfigurationValidationDto, LayoutPlacementDto } from '@marquee/contracts';
import {
  chairPositions,
  rectFromSize,
  templateForSeats,
  type PointMm,
  type RectMm,
  type TableTemplate,
  type VenueShell,
} from '@marquee/spatial';

/** Stage placement is computed by the spatial package, shared with the server. */
export { presetStageRect } from '@marquee/spatial';

/** A table with its chair centres, ready to draw in 2D or 3D. */
export interface PlanTable {
  readonly id: string;
  readonly centre: PointMm;
  readonly chairs: readonly PointMm[];
}

/** Everything the renderers need for one validated layout. */
export interface PlanGeometry {
  readonly template: TableTemplate;
  readonly tables: readonly PlanTable[];
}

/** Margin added around placements when the venue's shell geometry is not available. */
const FALLBACK_MARGIN_MM = 4_000;

/**
 * Chooses the shell to draw. The approved shell comes from the venue detail response, so the
 * drawing always matches the server's measured geometry. When it is missing, a plain rectangle
 * around the placements is drawn and labelled as approximate.
 *
 * @param shell Approved shell from the venue detail, or null when unavailable.
 * @param placements Table placements, used only for the fallback bounds.
 * @returns A shell to draw, and whether it is the exact approved shell.
 */
export function resolveShell(
  shell: VenueShell | null,
  placements: readonly LayoutPlacementDto[],
): { readonly shell: VenueShell; readonly exact: boolean } {
  if (shell) {
    return { shell, exact: true };
  }
  const maxX = Math.max(...placements.map((placement) => placement.xMm), 20_000);
  const maxY = Math.max(...placements.map((placement) => placement.yMm), 20_000);
  return {
    shell: {
      shellVersionId: 'unknown-shell',
      label: 'Approximate hall outline',
      outerRect: rectFromSize(0, 0, maxX + FALLBACK_MARGIN_MM, maxY + FALLBACK_MARGIN_MM),
      wallClearanceMm: 1_000,
      obstacles: [],
      centralAisleWidthMm: 2_400,
    },
    exact: false,
  };
}

/**
 * Expands server placements into tables with chair positions, using the same spatial helper as
 * the server so the drawing matches the validated layout.
 *
 * @param validation Layout validation result.
 * @returns Drawable geometry, or null when the result is a refusal or the template is unknown.
 */
export function buildPlanGeometry(
  validation: ConfigurationValidationDto | null,
): PlanGeometry | null {
  if (!validation?.ok) {
    return null;
  }
  const template = templateForSeats(validation.seatsPerTable);
  if (!template) {
    return null;
  }
  try {
    const tables = validation.placements.map((placement) => {
      const centre: PointMm = { xMm: placement.xMm, yMm: placement.yMm };
      return {
        id: placement.id,
        centre,
        chairs: chairPositions(template, centre, placement.seatsOccupied),
      };
    });
    return { template, tables };
  } catch {
    return null;
  }
}

/**
 * Finds the stage obstacle drawn in a shell.
 * @param shell Venue shell.
 * @returns The stage rectangle, or null when the shell has none.
 */
export function shellStageRect(shell: VenueShell): RectMm | null {
  return shell.obstacles.find((obstacle) => obstacle.kind === 'stage')?.rect ?? null;
}
