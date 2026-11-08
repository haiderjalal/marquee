import type { PointMm } from './geometry';

/**
 * Reviewed table templates. Each template fixes the table size, chair ring and
 * the lattice pitch used by the seating engine. Dimensions are demonstration
 * values until a venue's measured furniture template is approved; they are
 * versioned by id so an approved layout always references the template it used.
 */
export interface TableTemplate {
  readonly id: string;
  readonly seatsPerTable: number;
  /** Radius of the table top. */
  readonly tableRadiusMm: number;
  /** Distance from table centre to each chair centre. */
  readonly chairRingRadiusMm: number;
  /** Conservative footprint radius covering the table and its chairs. */
  readonly footprintRadiusMm: number;
  /** Centre-to-centre spacing used by the lattice. Always above two footprint radii. */
  readonly pitchMm: number;
}

/** Five-seat round table, the standard template in the configurator. */
export const ROUND_FIVE_V1: TableTemplate = {
  id: 'round-five-v1',
  seatsPerTable: 5,
  tableRadiusMm: 700,
  chairRingRadiusMm: 1_000,
  footprintRadiusMm: 1_250,
  pitchMm: 2_800,
};

/** Eight-seat round table. */
export const ROUND_EIGHT_V1: TableTemplate = {
  id: 'round-eight-v1',
  seatsPerTable: 8,
  tableRadiusMm: 900,
  chairRingRadiusMm: 1_300,
  footprintRadiusMm: 1_550,
  pitchMm: 3_400,
};

/** Ten-seat round table. */
export const ROUND_TEN_V1: TableTemplate = {
  id: 'round-ten-v1',
  seatsPerTable: 10,
  tableRadiusMm: 1_000,
  chairRingRadiusMm: 1_450,
  footprintRadiusMm: 1_700,
  pitchMm: 3_700,
};

/** All templates offered to the configurator, keyed by seats per table. */
export const TABLE_TEMPLATES: readonly TableTemplate[] = [
  ROUND_FIVE_V1,
  ROUND_EIGHT_V1,
  ROUND_TEN_V1,
];

/**
 * Looks up the template for a seats-per-table value.
 * @param seatsPerTable Supported table size.
 * @returns The matching template, or undefined when none exists.
 */
export function templateForSeats(seatsPerTable: number): TableTemplate | undefined {
  return TABLE_TEMPLATES.find((template) => template.seatsPerTable === seatsPerTable);
}

/**
 * Computes chair centres around a table, starting at north and running clockwise.
 * Only the first `seatsOccupied` anchors are returned, so a partial last table
 * shows exactly the chairs it seats and never more.
 * @param template Table template supplying the ring radius and anchor count.
 * @param centre Table centre in millimetres.
 * @param seatsOccupied Number of chairs to place, between 0 and the template's seats.
 * @returns Chair centres in millimetres (integers).
 * @throws RangeError when seatsOccupied is outside the template's capacity.
 */
export function chairPositions(
  template: TableTemplate,
  centre: PointMm,
  seatsOccupied: number,
): PointMm[] {
  if (
    !Number.isInteger(seatsOccupied) ||
    seatsOccupied < 0 ||
    seatsOccupied > template.seatsPerTable
  ) {
    throw new RangeError(`seatsOccupied must be between 0 and ${template.seatsPerTable}.`);
  }
  const positions: PointMm[] = [];
  for (let seat = 0; seat < seatsOccupied; seat += 1) {
    // Angle measured from north (negative y is north on the plan), clockwise.
    const angle = -Math.PI / 2 + (2 * Math.PI * seat) / template.seatsPerTable;
    positions.push({
      xMm: Math.round(centre.xMm + template.chairRingRadiusMm * Math.cos(angle)),
      yMm: Math.round(centre.yMm + template.chairRingRadiusMm * Math.sin(angle)),
    });
  }
  return positions;
}
