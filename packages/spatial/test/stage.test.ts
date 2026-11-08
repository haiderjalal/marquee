import { describe, expect, it } from 'vitest';

import {
  checkStagePreset,
  generateLayout,
  MARQUEE_A_SHELL_V2,
  ROUND_FIVE_V1,
  type GeneratedLayout,
} from '../src';

/** Returns the layout for a guest count or fails the test. */
function layoutFor(guests: number): GeneratedLayout {
  const outcome = generateLayout(MARQUEE_A_SHELL_V2, ROUND_FIVE_V1, guests);
  if (!outcome.ok) {
    throw new Error(`layout refused: ${outcome.code}`);
  }
  return outcome.layout;
}

describe('stage presets against a seated layout', () => {
  it('fits the shell own stage footprint at 200 and 500 guests', () => {
    for (const guests of [200, 500]) {
      const check = checkStagePreset(
        MARQUEE_A_SHELL_V2,
        ROUND_FIVE_V1,
        layoutFor(guests).placements,
        {
          widthMm: 8_000,
          depthMm: 4_000,
        },
      );
      expect(check?.fits).toBe(true);
      expect(check?.conflictingPlacementIds).toEqual([]);
    }
  });

  it('reports the tables a wider stage would hit, so they can be moved', () => {
    const layout = layoutFor(200);
    const check = checkStagePreset(MARQUEE_A_SHELL_V2, ROUND_FIVE_V1, layout.placements, {
      widthMm: 12_000,
      depthMm: 4_000,
    });
    expect(check?.fits).toBe(false);
    expect(check?.outsideFloor).toBe(false);
    expect(check?.conflictingPlacementIds.length).toBeGreaterThan(0);
    for (const id of check?.conflictingPlacementIds ?? []) {
      expect(layout.placements.some((placement) => placement.id === id)).toBe(true);
    }
  });

  it('flags a stage that runs past the usable floor', () => {
    const check = checkStagePreset(MARQUEE_A_SHELL_V2, ROUND_FIVE_V1, layoutFor(200).placements, {
      widthMm: 40_000,
      depthMm: 4_000,
    });
    expect(check?.outsideFloor).toBe(true);
    expect(check?.fits).toBe(false);
  });
});
