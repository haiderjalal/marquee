import type { ConfigurationValidationDto, ConfigurationValidateInput } from '@marquee/contracts';
import { type DatabaseClient, findPublishedVenueBySlug } from '@marquee/database';
import { DomainError } from '@marquee/domain';
import { Inject, Injectable } from '@nestjs/common';

import { canonicalJson, sha256Hex } from '../core/hash';
import { DATABASE } from '../core/tokens';

import { defaultSpace, findStage, planSpace, stageCheckFor } from './layout-plan';

/**
 * Authoritative seating validation for a guest count. The client's counts are never
 * trusted: the server recomputes tables, chairs and placements from the approved shell.
 */
@Injectable()
export class ConfiguratorService {
  private readonly database: DatabaseClient;

  /**
   * @param database Database handle.
   */
  constructor(@Inject(DATABASE) database: DatabaseClient) {
    this.database = database;
  }

  /**
   * Validates a requested guest count and table size against the venue's approved shell.
   * A layout that cannot seat the guests is a normal outcome (`ok: false`) with capacity
   * information, not a server error.
   * @param input Validated request.
   * @returns The layout with a content hash, or the refusal with capacity.
   * @throws DomainError NOT_FOUND when the venue is not published.
   */
  async validate(input: ConfigurationValidateInput): Promise<ConfigurationValidationDto> {
    const aggregate = await findPublishedVenueBySlug(this.database.db, input.venueSlug);
    if (!aggregate) {
      throw new DomainError('NOT_FOUND', 'That venue is not published.');
    }
    const plan = planSpace(
      aggregate,
      defaultSpace(aggregate),
      input.requestedGuests,
      input.seatsPerTable,
    );
    if (!plan.outcome.ok) {
      return {
        ok: false,
        code: plan.outcome.code,
        message: plan.outcome.message,
        capacity: plan.outcome.capacity,
      };
    }

    const layout = plan.outcome.layout;
    const stageCheck =
      input.stageId === null ? null : stageCheckFor(plan, findStage(aggregate, input.stageId));
    const placements = layout.placements.map((placement) => ({
      id: placement.id,
      xMm: placement.centre.xMm,
      yMm: placement.centre.yMm,
      seatsOccupied: placement.seatsOccupied,
    }));
    const contentHash = sha256Hex(
      canonicalJson({
        shellVersionId: plan.shell.shellVersionId,
        shellContentHash: plan.shellContentHash,
        templateId: layout.templateId,
        seatsPerTable: layout.seatsPerTable,
        requestedGuests: layout.requestedGuests,
        placements,
        stage: stageCheck,
      }),
    );
    return {
      ok: true,
      shellVersionId: plan.shell.shellVersionId,
      templateId: layout.templateId,
      seatsPerTable: layout.seatsPerTable,
      requestedGuests: layout.requestedGuests,
      tableCount: layout.tableCount,
      chairCount: layout.chairCount,
      placements,
      validatorVersion: layout.validatorVersion,
      contentHash,
      stage: stageCheck,
    };
  }
}
