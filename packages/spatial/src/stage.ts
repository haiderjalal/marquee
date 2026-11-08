import {
  inflateRect,
  circleIntersectsRect,
  rectFromSize,
  rectInsideRect,
  type RectMm,
} from './geometry';
import { usableFloor, type VenueShell } from './shell';
import type { TablePlacement } from './layout';
import type { TableTemplate } from './templates';

/**
 * Stage presets against a venue shell. A preset replaces the shell's stage at its anchor, so its
 * footprint is centred on the shell stage and flush with the stage's north edge. Whether the new
 * footprint fits is a spatial question answered here, once, for both the API and the web app.
 */

/** Clearance kept between tables and a stage when the shell does not declare one. */
export const DEFAULT_STAGE_CLEARANCE_MM = 1_000;

/** Physical outcome of placing one stage preset on one layout. */
export interface StageCheck {
  readonly rect: RectMm;
  /** True when the footprint is inside the usable floor and no table intrudes on its clearance. */
  readonly fits: boolean;
  readonly outsideFloor: boolean;
  /** Tables whose footprint intrudes on the stage clearance; these are the furniture to move. */
  readonly conflictingPlacementIds: readonly string[];
}

/**
 * Places a stage preset on the shell's stage anchor.
 * @param shell Venue shell with a stage obstacle.
 * @param widthMm Preset width in millimetres.
 * @param depthMm Preset depth in millimetres.
 * @returns The preset footprint, or null when the shell has no stage anchor.
 */
export function presetStageRect(
  shell: VenueShell,
  widthMm: number,
  depthMm: number,
): RectMm | null {
  const anchor = shell.obstacles.find((obstacle) => obstacle.kind === 'stage')?.rect;
  if (!anchor) {
    return null;
  }
  const centreX = (anchor.minXMm + anchor.maxXMm) / 2;
  return rectFromSize(Math.round(centreX - widthMm / 2), anchor.minYMm, widthMm, depthMm);
}

/**
 * Checks one stage preset against a seated layout.
 * @param shell Venue shell.
 * @param template Table template used by the layout.
 * @param placements Table placements of the layout.
 * @param preset Preset dimensions.
 * @returns The check, or null when the shell has no stage anchor.
 */
export function checkStagePreset(
  shell: VenueShell,
  template: TableTemplate,
  placements: readonly TablePlacement[],
  preset: { readonly widthMm: number; readonly depthMm: number },
): StageCheck | null {
  const rect = presetStageRect(shell, preset.widthMm, preset.depthMm);
  if (!rect) {
    return null;
  }
  const stageObstacle = shell.obstacles.find((obstacle) => obstacle.kind === 'stage');
  const keepOut = inflateRect(rect, stageObstacle?.clearanceMm ?? DEFAULT_STAGE_CLEARANCE_MM);
  const outsideFloor = !rectInsideRect(rect, usableFloor(shell));
  const conflictingPlacementIds = placements
    .filter((placement) =>
      circleIntersectsRect(
        { centre: placement.centre, radiusMm: template.footprintRadiusMm },
        keepOut,
      ),
    )
    .map((placement) => placement.id);
  return {
    rect,
    fits: !outsideFloor && conflictingPlacementIds.length === 0,
    outsideFloor,
    conflictingPlacementIds,
  };
}
