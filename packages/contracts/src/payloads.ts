import { z } from 'zod';

/**
 * Runtime schemas for JSON payloads stored in the database. Data read back from
 * PostgreSQL is untrusted until it passes these schemas; a payload that fails
 * validation is an integrity fault, never something to cast around.
 */

/** Axis-aligned rectangle in whole millimetres with positive size. */
const rectSchema = z
  .strictObject({
    minXMm: z.int(),
    minYMm: z.int(),
    maxXMm: z.int(),
    maxYMm: z.int(),
  })
  .refine((rect) => rect.maxXMm > rect.minXMm && rect.maxYMm > rect.minYMm, {
    message: 'Rectangles must have positive width and height.',
  });

/** Measured venue shell, version-pinned and immutable once approved. */
export const venueShellPayloadSchema = z.strictObject({
  shellVersionId: z.string().min(1),
  label: z.string().min(1),
  outerRect: rectSchema,
  wallClearanceMm: z.int().min(0),
  centralAisleWidthMm: z.int().min(0),
  obstacles: z.array(
    z.strictObject({
      id: z.string().min(1),
      kind: z.enum(['stage', 'pillar', 'protected-entrance', 'service']),
      rect: rectSchema,
      clearanceMm: z.int().min(0),
    }),
  ),
});

/** Menu package content. Inclusions are shown verbatim; they are never inferred from images. */
export const menuPackagePayloadSchema = z.looseObject({
  demo: z.boolean().optional(),
  description: z.string().optional(),
  includes: z.array(z.string().min(1)).default([]),
});

/** Stage preset footprint and collection label. */
export const stagePayloadSchema = z.looseObject({
  demo: z.boolean().optional(),
  widthMm: z.int().positive(),
  depthMm: z.int().positive(),
  heightMm: z.int().positive(),
  collection: z.string().min(1),
});

/** Extra service metadata. */
export const extraPayloadSchema = z.looseObject({
  demo: z.boolean().optional(),
  unit: z.string().optional(),
});

export type VenueShellPayload = z.infer<typeof venueShellPayloadSchema>;
export type MenuPackagePayload = z.infer<typeof menuPackagePayloadSchema>;
export type StagePayload = z.infer<typeof stagePayloadSchema>;
