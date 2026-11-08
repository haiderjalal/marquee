import { planSeating } from '@marquee/domain';

import {
  type CircleMm,
  circleInsideRect,
  circleIntersectsRect,
  circlesOverlap,
  type PointMm,
} from './geometry';
import { blockingRects, usableFloor, type VenueShell } from './shell';
import { type TableTemplate } from './templates';

/** Version of the validation rules applied to every layout. Stored with approvals. */
export const LAYOUT_VALIDATOR_VERSION = 'layout-validator-v1';

/** One table on a generated plan. Identifiers are stable for a given shell, template and count. */
export interface TablePlacement {
  readonly id: string;
  readonly centre: PointMm;
  /** Chairs seated at this table; equals the template size except possibly on the last table. */
  readonly seatsOccupied: number;
}

/** A complete seating plan for one guest count, ready for validation and rendering. */
export interface GeneratedLayout {
  readonly shellVersionId: string;
  readonly templateId: string;
  readonly seatsPerTable: number;
  readonly requestedGuests: number;
  readonly tableCount: number;
  readonly chairCount: number;
  readonly placements: readonly TablePlacement[];
  readonly validatorVersion: typeof LAYOUT_VALIDATOR_VERSION;
}

/** Why a requested layout cannot be produced, with the verified capacity that can be offered instead. */
export interface LayoutCapacity {
  readonly maxTables: number;
  readonly maxGuests: number;
  readonly seatsPerTable: number;
}

/** Outcome of seating generation: a plan, or a refusal with a usable alternative. */
export type LayoutOutcome =
  | { readonly ok: true; readonly layout: GeneratedLayout }
  | {
      readonly ok: false;
      readonly code: 'LAYOUT_DOES_NOT_FIT' | 'POLICY_BLOCKED';
      readonly message: string;
      readonly capacity: LayoutCapacity;
    };

/** Options that tune generation without changing the reviewed template. */
export interface GenerateLayoutOptions {
  /** Whether the venue allows a partially seated last table. Defaults to true. */
  readonly partialTableAllowed?: boolean;
}

/**
 * Generates a deterministic seating plan for an exact guest count.
 *
 * The method is a lattice of template-sized cells across the usable floor, centred
 * on both axes. Cells whose footprints touch an obstacle, the central aisle or a
 * wall clearance are discarded. Remaining cells are ordered top-to-bottom then
 * left-to-right, and the first `ceil(guests / seats)` cells receive tables. The
 * last table seats only the remainder, so chairs always equal the requested guests.
 *
 * The engine never shrinks chairs, overlaps objects or silently reduces the count.
 * If the requested tables do not fit, it returns the measured maximum instead.
 *
 * @param shell Measured venue shell (version-pinned by the caller).
 * @param template Reviewed table template; its seats define the seating plan.
 * @param requestedGuests Positive integer guest count.
 * @param options Venue policy options.
 * @returns A layout or a refusal with capacity details.
 * @throws DomainError (from @marquee/domain) when the guest count itself is invalid.
 */
export function generateLayout(
  shell: VenueShell,
  template: TableTemplate,
  requestedGuests: number,
  options: GenerateLayoutOptions = {},
): LayoutOutcome {
  const plan = planSeating(requestedGuests, template.seatsPerTable);
  const partialAllowed = options.partialTableAllowed ?? true;
  const capacity = measureCapacity(shell, template);

  if (!partialAllowed && plan.seatsAtLastTable !== template.seatsPerTable) {
    return {
      ok: false,
      code: 'POLICY_BLOCKED',
      message: `This venue seats ${template.seatsPerTable} per table only. Choose a guest count that divides evenly.`,
      capacity,
    };
  }

  if (plan.tableCount > capacity.maxTables) {
    return {
      ok: false,
      code: 'LAYOUT_DOES_NOT_FIT',
      message: `${plan.requestedGuests} guests need ${plan.tableCount} tables, but this hall fits ${capacity.maxTables} at ${template.seatsPerTable} per table.`,
      capacity,
    };
  }

  const cells = orderedFreeCells(shell, template);
  const placements: TablePlacement[] = [];
  for (let index = 0; index < plan.tableCount; index += 1) {
    const centre = cells[index];
    if (!centre) {
      throw new Error(
        'Layout cell list shorter than measured capacity; generator invariant broken.',
      );
    }
    const isLast = index === plan.tableCount - 1;
    placements.push({
      id: `T-${String(index + 1).padStart(3, '0')}`,
      centre,
      seatsOccupied: isLast ? plan.seatsAtLastTable : template.seatsPerTable,
    });
  }

  return {
    ok: true,
    layout: {
      shellVersionId: shell.shellVersionId,
      templateId: template.id,
      seatsPerTable: template.seatsPerTable,
      requestedGuests: plan.requestedGuests,
      tableCount: plan.tableCount,
      chairCount: plan.chairCount,
      placements,
      validatorVersion: LAYOUT_VALIDATOR_VERSION,
    },
  };
}

/**
 * Measures the largest number of tables this shell holds with this template.
 * @param shell Venue shell.
 * @param template Table template.
 * @returns Capacity in tables, guests and seats per table.
 */
export function measureCapacity(shell: VenueShell, template: TableTemplate): LayoutCapacity {
  const maxTables = orderedFreeCells(shell, template).length;
  return {
    maxTables,
    maxGuests: maxTables * template.seatsPerTable,
    seatsPerTable: template.seatsPerTable,
  };
}

/**
 * Lists every lattice cell whose full footprint is clear, in deterministic order.
 * @param shell Venue shell.
 * @param template Table template defining footprint and pitch.
 * @returns Table centres ordered top-to-bottom then left-to-right.
 */
export function orderedFreeCells(shell: VenueShell, template: TableTemplate): PointMm[] {
  const floor = usableFloor(shell);
  const radius = template.footprintRadiusMm;
  const blockers = blockingRects(shell);

  const xs = latticeAxis(floor.minXMm, floor.maxXMm, radius, template.pitchMm);
  const ys = latticeAxis(floor.minYMm, floor.maxYMm, radius, template.pitchMm);

  const cells: PointMm[] = [];
  for (const yMm of ys) {
    for (const xMm of xs) {
      const footprint: CircleMm = { centre: { xMm, yMm }, radiusMm: radius };
      if (!circleInsideRect(footprint, floor)) {
        continue;
      }
      const blocked = blockers.some(({ rect }) => circleIntersectsRect(footprint, rect));
      if (!blocked) {
        cells.push({ xMm, yMm });
      }
    }
  }
  return cells;
}

/**
 * Places lattice centres along one axis, centred within the span so that spare space
 * is shared evenly at both ends.
 * @param min Lower bound of the usable span.
 * @param max Upper bound of the usable span.
 * @param radius Footprint radius that must fit inside the span.
 * @param pitch Centre-to-centre spacing.
 * @returns Centre coordinates; empty when a single footprint does not fit.
 */
function latticeAxis(min: number, max: number, radius: number, pitch: number): number[] {
  const innerSpan = max - min - 2 * radius;
  if (innerSpan < 0) {
    return [];
  }
  const count = Math.floor(innerSpan / pitch) + 1;
  const used = (count - 1) * pitch;
  const start = min + radius + Math.floor((innerSpan - used) / 2);
  return Array.from({ length: count }, (_, index) => start + index * pitch);
}

/**
 * Checks a plan against the shell, the obstacles and every other table.
 * Used on every save and approval; generation alone is never trusted for approval.
 * @param shell Venue shell the plan references.
 * @param template Template the plan was generated with.
 * @param placements Table placements to verify.
 * @returns Violations; an empty list means the plan passes geometry checks.
 */
export function validatePlacements(
  shell: VenueShell,
  template: TableTemplate,
  placements: readonly TablePlacement[],
): Array<{ readonly placementId: string; readonly rule: string; readonly message: string }> {
  const violations: Array<{ placementId: string; rule: string; message: string }> = [];
  const floor = usableFloor(shell);
  const blockers = blockingRects(shell);
  const footprints = placements.map((placement): { id: string; circle: CircleMm } => ({
    id: placement.id,
    circle: { centre: placement.centre, radiusMm: template.footprintRadiusMm },
  }));

  for (const { id, circle } of footprints) {
    if (!circleInsideRect(circle, floor)) {
      violations.push({
        placementId: id,
        rule: 'inside-floor',
        message: 'Table footprint leaves the usable floor.',
      });
    }
    for (const blocker of blockers) {
      if (circleIntersectsRect(circle, blocker.rect)) {
        violations.push({
          placementId: id,
          rule: 'clear-of-obstacles',
          message: `Table footprint intersects ${blocker.id}.`,
        });
      }
    }
  }

  for (let i = 0; i < footprints.length; i += 1) {
    for (let j = i + 1; j < footprints.length; j += 1) {
      const left = footprints[i];
      const right = footprints[j];
      if (left && right && circlesOverlap(left.circle, right.circle)) {
        violations.push({
          placementId: left.id,
          rule: 'no-table-overlap',
          message: `Table ${left.id} overlaps ${right.id}.`,
        });
      }
    }
  }
  return violations;
}
