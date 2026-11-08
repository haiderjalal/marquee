import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  chairPositions,
  circleIntersectsRect,
  generateLayout,
  type GeneratedLayout,
  inflateRect,
  MARQUEE_A_SHELL_V2,
  MARQUEE_B_SHELL_V1,
  measureCapacity,
  ROUND_EIGHT_V1,
  ROUND_FIVE_V1,
  ROUND_TEN_V1,
  type TableTemplate,
  TABLE_TEMPLATES,
  templateForSeats,
  validatePlacements,
  type VenueShell,
} from '../src';

/** Asserts a generation outcome succeeded and returns its layout. */
function requireLayout(outcome: ReturnType<typeof generateLayout>): GeneratedLayout {
  if (!outcome.ok) {
    throw new Error(`Expected a layout, got ${outcome.code}: ${outcome.message}`);
  }
  return outcome.layout;
}

describe('seating generation on Marquee A (demo shell)', () => {
  it('measures a capacity that holds 500 guests but refuses the 700 published headline', () => {
    const capacity = measureCapacity(MARQUEE_A_SHELL_V2, ROUND_FIVE_V1);
    expect(capacity.maxTables).toBeGreaterThanOrEqual(100);
    expect(capacity.maxTables).toBeLessThan(140);
    expect(capacity.maxGuests).toBeLessThan(700);
  });

  it('gives 200 guests 40 tables and exactly 200 chairs', () => {
    const layout = requireLayout(generateLayout(MARQUEE_A_SHELL_V2, ROUND_FIVE_V1, 200));
    expect(layout.tableCount).toBe(40);
    expect(layout.placements).toHaveLength(40);
    expect(layout.placements.reduce((sum, table) => sum + table.seatsOccupied, 0)).toBe(200);
  });

  it('gives 500 guests 100 tables and exactly 500 chairs', () => {
    const layout = requireLayout(generateLayout(MARQUEE_A_SHELL_V2, ROUND_FIVE_V1, 500));
    expect(layout.tableCount).toBe(100);
    expect(layout.chairCount).toBe(500);
    expect(layout.placements.reduce((sum, table) => sum + table.seatsOccupied, 0)).toBe(500);
  });

  it('gives 503 guests 101 tables with a three-seat partial last table', () => {
    const layout = requireLayout(generateLayout(MARQUEE_A_SHELL_V2, ROUND_FIVE_V1, 503));
    expect(layout.tableCount).toBe(101);
    expect(layout.placements.at(-1)?.seatsOccupied).toBe(3);
    expect(layout.placements.reduce((sum, table) => sum + table.seatsOccupied, 0)).toBe(503);
  });

  it('refuses 700 guests with a measured maximum and never shrinks or overlaps tables', () => {
    const outcome = generateLayout(MARQUEE_A_SHELL_V2, ROUND_FIVE_V1, 700);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) {
      return;
    }
    expect(outcome.code).toBe('LAYOUT_DOES_NOT_FIT');
    expect(outcome.capacity.maxGuests).toBeLessThan(700);
  });

  it('refuses a partial table when the venue policy forbids it', () => {
    const outcome = generateLayout(MARQUEE_A_SHELL_V2, ROUND_FIVE_V1, 503, {
      partialTableAllowed: false,
    });
    expect(outcome).toMatchObject({ ok: false, code: 'POLICY_BLOCKED' });
  });

  it('produces no collisions, obstacle intrusions or out-of-floor footprints', () => {
    for (const template of TABLE_TEMPLATES) {
      const layout = requireLayout(generateLayout(MARQUEE_A_SHELL_V2, template, 120));
      expect(validatePlacements(MARQUEE_A_SHELL_V2, template, layout.placements)).toEqual([]);
    }
  });

  it('is deterministic: the same request yields identical placement identifiers and positions', () => {
    const first = requireLayout(generateLayout(MARQUEE_A_SHELL_V2, ROUND_FIVE_V1, 300));
    const second = requireLayout(generateLayout(MARQUEE_A_SHELL_V2, ROUND_FIVE_V1, 300));
    expect(second).toEqual(first);
    expect(first.placements[0]?.id).toBe('T-001');
  });

  it('keeps every table clear of the central aisle', () => {
    const layout = requireLayout(generateLayout(MARQUEE_A_SHELL_V2, ROUND_FIVE_V1, 500));
    const aisle = inflateRect({ minXMm: 16_800, minYMm: 1_000, maxXMm: 19_200, maxYMm: 41_000 }, 0);
    for (const table of layout.placements) {
      const footprint = { centre: table.centre, radiusMm: ROUND_FIVE_V1.footprintRadiusMm };
      expect(circleIntersectsRect(footprint, aisle)).toBe(false);
    }
  });
});

describe('table templates and chairs', () => {
  it('gives the 200-guest template a fixed 8-seat ring with the partial remainder only', () => {
    const centre = { xMm: 0, yMm: 0 };
    expect(chairPositions(ROUND_FIVE_V1, centre, 5)).toHaveLength(5);
    expect(chairPositions(ROUND_FIVE_V1, centre, 3)).toHaveLength(3);
  });

  it('places the first chair at north and spaces seats evenly around the ring', () => {
    const [north] = chairPositions(ROUND_FIVE_V1, { xMm: 0, yMm: 0 }, 5);
    expect(north).toEqual({ xMm: 0, yMm: -ROUND_FIVE_V1.chairRingRadiusMm });
  });

  it('rejects an occupancy above the template size', () => {
    expect(() => chairPositions(ROUND_FIVE_V1, { xMm: 0, yMm: 0 }, 6)).toThrow(RangeError);
  });

  it('resolves templates by seats per table', () => {
    expect(templateForSeats(8)).toBe(ROUND_EIGHT_V1);
    expect(templateForSeats(10)).toBe(ROUND_TEN_V1);
    expect(templateForSeats(7)).toBeUndefined();
  });

  it('keeps every template pitch above two footprint radii so the lattice cannot collide', () => {
    for (const template of TABLE_TEMPLATES) {
      expect(template.pitchMm).toBeGreaterThan(2 * template.footprintRadiusMm);
    }
  });
});

describe('property: generated plans satisfy exact counts and geometry for any fitting request', () => {
  const shells: readonly VenueShell[] = [MARQUEE_A_SHELL_V2, MARQUEE_B_SHELL_V1];

  it('holds the count and geometry invariants over generated requests', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...shells),
        fc.constantFrom<TableTemplate>(...TABLE_TEMPLATES),
        fc.integer({ min: 1, max: 260 }),
        (shell, template, guests) => {
          const outcome = generateLayout(shell, template, guests);
          if (!outcome.ok) {
            // Only capacity refusals are acceptable; they must offer a real maximum.
            expect(outcome.code).toBe('LAYOUT_DOES_NOT_FIT');
            expect(guests).toBeGreaterThan(outcome.capacity.maxTables * template.seatsPerTable);
            return;
          }
          const layout = outcome.layout;
          const seated = layout.placements.reduce((sum, table) => sum + table.seatsOccupied, 0);
          expect(layout.tableCount).toBe(Math.ceil(guests / template.seatsPerTable));
          expect(seated).toBe(guests);
          expect(layout.placements).toHaveLength(layout.tableCount);
          expect(validatePlacements(shell, template, layout.placements)).toEqual([]);
        },
      ),
      { numRuns: 150, seed: 20261108 },
    );
  });
});

describe('demo shells', () => {
  it('uses the millimetre unit system consistently (positive dimensions, stage inside the floor)', () => {
    for (const shell of [MARQUEE_A_SHELL_V2, MARQUEE_B_SHELL_V1]) {
      expect(shell.outerRect.maxXMm).toBeGreaterThan(shell.outerRect.minXMm);
      expect(shell.outerRect.maxYMm).toBeGreaterThan(shell.outerRect.minYMm);
      for (const obstacle of shell.obstacles) {
        expect(obstacle.rect.minXMm).toBeGreaterThanOrEqual(shell.outerRect.minXMm);
        expect(obstacle.rect.maxXMm).toBeLessThanOrEqual(shell.outerRect.maxXMm);
      }
    }
  });
});
