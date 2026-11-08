import {
  menuPackagePayloadSchema,
  type StageCheckDto,
  stagePayloadSchema,
  venueShellPayloadSchema,
} from '@marquee/contracts';
import type { CatalogueRecord, SpaceRecord, VenueAggregate } from '@marquee/database';
import { DomainError } from '@marquee/domain';
import {
  checkStagePreset,
  generateLayout,
  type LayoutOutcome,
  templateForSeats,
  type TableTemplate,
  type VenueShell,
} from '@marquee/spatial';

/**
 * Layout planning shared by the configurator and the quote service. Both must reach the
 * same answer for the same request, so the rules live here once.
 */

/** Result of planning one space for one guest count and table size. */
export interface SpacePlan {
  readonly space: SpaceRecord;
  readonly shell: VenueShell;
  readonly shellContentHash: string;
  readonly template: TableTemplate;
  readonly outcome: LayoutOutcome;
}

/**
 * Chooses the space a public request refers to. Each published venue currently exposes one
 * bookable space; a venue with several spaces will pass an explicit space identifier later.
 * @param aggregate Published venue.
 * @returns The first space.
 * @throws DomainError NOT_FOUND when the venue has no space.
 */
export function defaultSpace(aggregate: VenueAggregate): SpaceRecord {
  const [space] = aggregate.spaces;
  if (!space) {
    throw new DomainError('NOT_FOUND', 'This venue has no bookable space yet.');
  }
  return space;
}

/**
 * Plans seating for a space. The stored shell is validated before use; a payload that fails
 * validation is an integrity fault and is raised as an error, never repaired silently.
 * @param aggregate Venue aggregate containing the shell version.
 * @param space Space to plan.
 * @param requestedGuests Guest count.
 * @param seatsPerTable Table size.
 * @returns The layout outcome with the shell hash it was validated against.
 * @throws DomainError VALIDATION_FAILED for an unsupported table size; Error for a corrupt shell.
 */
export function planSpace(
  aggregate: VenueAggregate,
  space: SpaceRecord,
  requestedGuests: number,
  seatsPerTable: number,
): SpacePlan {
  const template = templateForSeats(seatsPerTable);
  if (!template) {
    throw new DomainError('VALIDATION_FAILED', 'Seats per table must be 5, 8 or 10.');
  }
  const shellRecord = aggregate.shells.find((candidate) => candidate.id === space.shellVersionId);
  if (!shellRecord) {
    throw new Error(`Space ${space.id} references missing shell version ${space.shellVersionId}.`);
  }
  const shell = venueShellPayloadSchema.parse(shellRecord.payload);
  const outcome = generateLayout(shell, template, requestedGuests, {
    partialTableAllowed: aggregate.policy.partialTablesAllowed,
  });
  return { space, shell, shellContentHash: shellRecord.contentHash, template, outcome };
}

/**
 * Finds a published stage preset by its public code.
 * @param aggregate Venue aggregate.
 * @param code Stage code from the request.
 * @returns The stage row.
 * @throws DomainError VALIDATION_FAILED when no published stage has that code.
 */
export function findStage(aggregate: VenueAggregate, code: string): CatalogueRecord {
  const stage = aggregate.catalogue.find((item) => item.kind === 'stage' && item.code === code);
  if (!stage) {
    throw new DomainError('VALIDATION_FAILED', 'Choose an available stage.');
  }
  return stage;
}

/**
 * Checks a stage preset against a planned layout. Returns null when the layout was refused,
 * because there is no seated furniture to check against.
 * @param plan Planned space.
 * @param stage Stage preset row.
 * @returns The physical check in its DTO form, or null.
 */
export function stageCheckFor(plan: SpacePlan, stage: CatalogueRecord): StageCheckDto | null {
  if (!plan.outcome.ok) {
    return null;
  }
  const payload = stagePayloadSchema.parse(stage.payload);
  const check = checkStagePreset(plan.shell, plan.template, plan.outcome.layout.placements, {
    widthMm: payload.widthMm,
    depthMm: payload.depthMm,
  });
  if (!check) {
    return null;
  }
  return {
    stageId: stage.code,
    name: stage.name,
    widthMm: payload.widthMm,
    depthMm: payload.depthMm,
    fits: check.fits,
    outsideFloor: check.outsideFloor,
    conflictingPlacementIds: [...check.conflictingPlacementIds],
  };
}

/**
 * Explains a stage that does not fit, in words a planner can act on.
 * @param check Stage check that failed.
 * @returns A safe, specific message.
 */
export function stageConflictMessage(check: StageCheckDto): string {
  if (check.outsideFloor) {
    return `The ${check.name} runs past the usable floor. Choose a smaller stage.`;
  }
  const count = check.conflictingPlacementIds.length;
  return `The ${check.name} would collide with ${count} table${count === 1 ? '' : 's'}. Choose a smaller stage or another guest count.`;
}

/**
 * Parses a menu package payload read from the catalogue.
 * @param payload Stored payload.
 * @returns Validated menu metadata.
 */
export function parseMenuPayload(payload: unknown) {
  return menuPackagePayloadSchema.parse(payload);
}

/**
 * Parses a stage payload read from the catalogue.
 * @param payload Stored payload.
 * @returns Validated stage dimensions.
 */
export function parseStagePayload(payload: unknown) {
  return stagePayloadSchema.parse(payload);
}
