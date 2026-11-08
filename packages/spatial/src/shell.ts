import { inflateRect, rectFromSize, type RectMm } from './geometry';

/**
 * A measured venue shell: the outer floor, its fixed obstacles and protected zones.
 * Shells are versioned; a published shell is immutable and every layout references
 * the exact shell version it was validated against.
 */
export interface VenueShell {
  readonly shellVersionId: string;
  /** Human label, shown to staff. */
  readonly label: string;
  readonly outerRect: RectMm;
  /** Clearance kept free from every wall. */
  readonly wallClearanceMm: number;
  /** Fixed objects such as the stage, pillars and service stations. */
  readonly obstacles: readonly ShellObstacle[];
  /** Central aisle used for guest access; tables may never intrude on it. */
  readonly centralAisleWidthMm: number;
}

/** A fixed obstacle with the clearance tables must keep from it. */
export interface ShellObstacle {
  readonly id: string;
  readonly kind: 'stage' | 'pillar' | 'protected-entrance' | 'service';
  readonly rect: RectMm;
  readonly clearanceMm: number;
}

/**
 * Builds the rectangle that tables may use: the outer floor inset by the wall clearance.
 * @param shell Venue shell.
 * @returns Usable floor rectangle.
 */
export function usableFloor(shell: VenueShell): RectMm {
  return inflateRect(shell.outerRect, -shell.wallClearanceMm);
}

/**
 * Returns the central aisle rectangle, centred on the usable floor and running its full depth.
 * @param shell Venue shell.
 * @returns Aisle rectangle in millimetres.
 */
export function centralAisleRect(shell: VenueShell): RectMm {
  const floor = usableFloor(shell);
  const centreX = Math.round((floor.minXMm + floor.maxXMm) / 2);
  const half = Math.round(shell.centralAisleWidthMm / 2);
  return rectFromSize(
    centreX - half,
    floor.minYMm,
    shell.centralAisleWidthMm,
    floor.maxYMm - floor.minYMm,
  );
}

/**
 * Lists every obstacle a table footprint must avoid, including the central aisle.
 * The aisle carries no clearance because its guests already keep the footprint radius free.
 * @param shell Venue shell.
 * @returns Inflated obstacle rectangles with their identifiers.
 */
export function blockingRects(
  shell: VenueShell,
): ReadonlyArray<{ readonly id: string; readonly rect: RectMm }> {
  const obstacles = shell.obstacles.map((obstacle) => ({
    id: obstacle.id,
    rect: inflateRect(obstacle.rect, obstacle.clearanceMm),
  }));
  return [...obstacles, { id: 'central-aisle', rect: centralAisleRect(shell) }];
}
