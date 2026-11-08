/**
 * Plane geometry in integer millimetres. The floor plane is right-handed:
 * x increases to the right of the plan, y increases away from the entrance
 * reference. All functions are pure and allocation-light.
 */

/** A point on the floor plan, in millimetres. */
export interface PointMm {
  readonly xMm: number;
  readonly yMm: number;
}

/** Axis-aligned rectangle; `minX`/`minY` are inclusive, `maxX`/`maxY` exclusive. */
export interface RectMm {
  readonly minXMm: number;
  readonly minYMm: number;
  readonly maxXMm: number;
  readonly maxYMm: number;
}

/** Circle used as a conservative footprint for round tables and their chair envelopes. */
export interface CircleMm {
  readonly centre: PointMm;
  readonly radiusMm: number;
}

/**
 * Builds a rectangle from origin and size.
 * @param xMm Left edge.
 * @param yMm Top edge.
 * @param widthMm Width, positive.
 * @param heightMm Height, positive.
 * @returns The rectangle.
 */
export function rectFromSize(xMm: number, yMm: number, widthMm: number, heightMm: number): RectMm {
  return { minXMm: xMm, minYMm: yMm, maxXMm: xMm + widthMm, maxYMm: yMm + heightMm };
}

/**
 * Expands a rectangle by a clearance on every side.
 * @param rect Rectangle to inflate.
 * @param clearanceMm Non-negative clearance in millimetres.
 * @returns The inflated rectangle.
 */
export function inflateRect(rect: RectMm, clearanceMm: number): RectMm {
  return {
    minXMm: rect.minXMm - clearanceMm,
    minYMm: rect.minYMm - clearanceMm,
    maxXMm: rect.maxXMm + clearanceMm,
    maxYMm: rect.maxYMm + clearanceMm,
  };
}

/**
 * Tests whether a circle lies entirely inside a rectangle.
 * @param circle Candidate circle.
 * @param rect Containing rectangle.
 * @returns True when every point of the circle is inside the rectangle.
 */
export function circleInsideRect(circle: CircleMm, rect: RectMm): boolean {
  const { centre, radiusMm } = circle;
  return (
    centre.xMm - radiusMm >= rect.minXMm &&
    centre.xMm + radiusMm <= rect.maxXMm &&
    centre.yMm - radiusMm >= rect.minYMm &&
    centre.yMm + radiusMm <= rect.maxYMm
  );
}

/**
 * Tests whether a circle touches or crosses a rectangle.
 * Uses the closest point on the rectangle to the circle centre, so the test is exact.
 * @param circle Circle to test.
 * @param rect Rectangle to test against.
 * @returns True when they share at least one point.
 */
export function circleIntersectsRect(circle: CircleMm, rect: RectMm): boolean {
  const closestX = clamp(circle.centre.xMm, rect.minXMm, rect.maxXMm);
  const closestY = clamp(circle.centre.yMm, rect.minYMm, rect.maxYMm);
  const dx = circle.centre.xMm - closestX;
  const dy = circle.centre.yMm - closestY;
  return dx * dx + dy * dy < circle.radiusMm * circle.radiusMm;
}

/**
 * Tests whether two circles overlap. Circles that only touch do not overlap.
 * @param left First circle.
 * @param right Second circle.
 * @returns True when the interiors intersect.
 */
export function circlesOverlap(left: CircleMm, right: CircleMm): boolean {
  const dx = left.centre.xMm - right.centre.xMm;
  const dy = left.centre.yMm - right.centre.yMm;
  const reach = left.radiusMm + right.radiusMm;
  return dx * dx + dy * dy < reach * reach;
}

/**
 * Clamps a number into an inclusive range.
 * @param value Value to clamp.
 * @param min Lower bound.
 * @param max Upper bound.
 * @returns The clamped value.
 */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Tests whether a rectangle lies entirely inside another rectangle, edges included.
 * @param inner Candidate rectangle.
 * @param outer Containing rectangle.
 * @returns True when every point of the inner rectangle is inside the outer one.
 */
export function rectInsideRect(inner: RectMm, outer: RectMm): boolean {
  return (
    inner.minXMm >= outer.minXMm &&
    inner.maxXMm <= outer.maxXMm &&
    inner.minYMm >= outer.minYMm &&
    inner.maxYMm <= outer.maxYMm
  );
}
