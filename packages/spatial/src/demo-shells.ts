import { rectFromSize } from './geometry';
import type { VenueShell } from './shell';

/**
 * DEMONSTRATION shells. These dimensions are fictional, unmeasured and not approved
 * for physical use. They exist so the configurator and tests run on realistic
 * geometry. A real venue replaces them with a surveyed shell version after
 * measurement, owner review and manager sign-off.
 *
 * All values are millimetres on the venue floor plan (x right, y away from entrance).
 */

/** Marquee A: indoor-style marquee with a north stage and a protected south entrance. */
export const MARQUEE_A_SHELL_V2: VenueShell = {
  shellVersionId: 'demo-shell-a-v2',
  label: 'Marquee A (demo shell)',
  outerRect: rectFromSize(0, 0, 36_000, 42_000),
  wallClearanceMm: 1_000,
  centralAisleWidthMm: 2_400,
  obstacles: [
    {
      id: 'stage-north',
      kind: 'stage',
      rect: rectFromSize(14_000, 1_500, 8_000, 4_000),
      clearanceMm: 1_000,
    },
    {
      id: 'entrance-south',
      kind: 'protected-entrance',
      rect: rectFromSize(16_000, 39_000, 4_000, 3_000),
      clearanceMm: 500,
    },
  ],
};

/** Marquee B: larger lawn-and-indoor demo shell with a north stage only. */
export const MARQUEE_B_SHELL_V1: VenueShell = {
  shellVersionId: 'demo-shell-b-v1',
  label: 'Marquee B (demo shell)',
  outerRect: rectFromSize(0, 0, 56_000, 52_000),
  wallClearanceMm: 1_000,
  centralAisleWidthMm: 3_000,
  obstacles: [
    {
      id: 'stage-north',
      kind: 'stage',
      rect: rectFromSize(24_000, 1_500, 8_000, 4_000),
      clearanceMm: 1_000,
    },
  ],
};
