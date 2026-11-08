import { type CreateHoldInput, type HoldDto, holdDtoSchema } from '@marquee/contracts';
import {
  acquireHold,
  appendAuditEvent,
  type AcquiredHold,
  type DatabaseClient,
  enqueueOutbox,
  findEnquiryStatus,
  findIdempotentResponse,
  findSpaceInTenant,
  saveIdempotentResponse,
} from '@marquee/database';
import { createInterval, DomainError, occupationWindow } from '@marquee/domain';
import { Inject, Injectable } from '@nestjs/common';

import type { Principal } from '../auth/principal';
import { requireRole } from '../auth/principal';
import { canonicalJson, sha256Hex } from '../core/hash';
import { DATABASE, ID_GENERATOR, type IdGenerator } from '../core/tokens';

/** Roles allowed to place holds. Viewers and accounts can read but not reserve. */
const HOLD_ROLES = ['owner', 'manager', 'sales', 'coordinator'] as const;

/** Command name used to scope idempotency records for holds. */
const HOLD_COMMAND = 'holds.create';

/** Minutes to milliseconds. */
const MINUTE_MS = 60_000;

/**
 * Hold use cases. A hold reserves physical resources for the occupation window, which
 * includes setup and teardown. Writes are idempotent per tenant, principal and key.
 */
@Injectable()
export class HoldService {
  private readonly database: DatabaseClient;
  private readonly ids: IdGenerator;

  /**
   * @param database Database handle.
   * @param ids Identifier source.
   */
  constructor(@Inject(DATABASE) database: DatabaseClient, @Inject(ID_GENERATOR) ids: IdGenerator) {
    this.database = database;
    this.ids = ids;
  }

  /**
   * Places a temporary hold. A retry with the same key and body returns the original result;
   * the same key with a different body is refused.
   * @param principal Verified caller.
   * @param input Validated hold request.
   * @param idempotencyKey Client-supplied key, already length-checked.
   * @param correlationId Request correlation identifier.
   * @returns The hold.
   * @throws DomainError for role, scope, interval, conflict or idempotency failures.
   */
  async create(
    principal: Principal,
    input: CreateHoldInput,
    idempotencyKey: string,
    correlationId: string,
  ): Promise<HoldDto> {
    requireRole(principal, HOLD_ROLES);
    const occupation = toOccupation(input);
    const db = this.database.db;

    const space = await findSpaceInTenant(db, principal.tenantId, input.spaceId);
    if (!space) {
      throw new DomainError('NOT_FOUND', 'That space could not be found.');
    }
    if (input.enquiryId !== null) {
      const enquiry = await findEnquiryStatus(db, principal.tenantId, input.enquiryId);
      if (!enquiry) {
        throw new DomainError('NOT_FOUND', 'That enquiry could not be found.');
      }
    }

    const scope = {
      tenantId: principal.tenantId,
      principalKey: principal.userId,
      command: HOLD_COMMAND,
      key: idempotencyKey,
    };
    const requestHash = sha256Hex(canonicalJson(input));
    const replayed = await this.replayIfStored(scope, requestHash);
    if (replayed) {
      return replayed;
    }

    try {
      const hold = await acquireHold(
        db,
        {
          tenantId: principal.tenantId,
          spaceId: space.id,
          enquiryId: input.enquiryId,
          createdByUserId: principal.userId,
          occupation,
          ttlMinutes: input.ttlMinutes,
        },
        async (transaction, acquired) => {
          const dto = toHoldDto(acquired);
          await appendAuditEvent(transaction, {
            id: this.ids.next(),
            tenantId: principal.tenantId,
            actorUserId: principal.userId,
            actorKind: 'staff',
            action: 'hold.acquired',
            entityType: 'hold',
            entityId: acquired.id,
            correlationId,
            summary: {
              spaceId: space.id,
              occupiedFrom: dto.occupiedFrom,
              occupiedUntil: dto.occupiedUntil,
              expiresAt: dto.expiresAt,
              expiredHoldIds: acquired.expiredHoldIds,
              resourceCount: acquired.resourceIds.length,
            },
          });
          await enqueueOutbox(transaction, {
            id: this.ids.next(),
            tenantId: principal.tenantId,
            topic: 'HoldAcquired',
            dedupKey: `HoldAcquired:${acquired.id}`,
            payload: { holdId: acquired.id, spaceId: space.id },
          });
          await saveIdempotentResponse(transaction, scope, {
            requestHash,
            responseStatus: 201,
            responseBody: dto,
          });
        },
      );
      return toHoldDto(hold);
    } catch (error) {
      if (error instanceof DomainError && error.code === 'SLOT_CONFLICT') {
        // A concurrent identical request may have committed first. Replay it if so.
        const raced = await this.replayIfStored(scope, requestHash);
        if (raced) {
          return raced;
        }
      }
      throw error;
    }
  }

  /**
   * Returns the stored result for a repeated request, or refuses a reused key.
   * @param scope Idempotency scope.
   * @param requestHash Hash of the current request body.
   * @returns The stored hold, or null when the key is unused.
   * @throws DomainError IDEMPOTENCY_CONFLICT when the key was used for a different request.
   */
  private async replayIfStored(
    scope: { tenantId: string; principalKey: string; command: string; key: string },
    requestHash: string,
  ): Promise<HoldDto | null> {
    const stored = await findIdempotentResponse(this.database.db, scope);
    if (!stored) {
      return null;
    }
    if (stored.requestHash !== requestHash) {
      throw new DomainError(
        'IDEMPOTENCY_CONFLICT',
        'This Idempotency-Key was already used for a different request.',
      );
    }
    return holdDtoSchema.parse(stored.responseBody);
  }
}

/**
 * Expands the requested event interval with setup and teardown to the occupation window.
 * @param input Validated hold request.
 * @returns The occupation interval in epoch milliseconds.
 * @throws DomainError when the interval is empty or reversed.
 */
export function toOccupation(input: CreateHoldInput) {
  const eventStart = Date.parse(input.startsAt);
  const eventEnd = Date.parse(input.endsAt);
  return occupationWindow(
    createInterval(eventStart, eventEnd),
    input.setupMinutes * MINUTE_MS,
    input.teardownMinutes * MINUTE_MS,
  );
}

/**
 * Serialises an acquired hold.
 * @param hold Committed hold.
 * @returns Hold DTO.
 */
function toHoldDto(hold: AcquiredHold): HoldDto {
  return {
    id: hold.id,
    spaceId: hold.spaceId,
    status: 'held',
    occupiedFrom: hold.occupiedFrom.toISOString(),
    occupiedUntil: hold.occupiedUntil.toISOString(),
    expiresAt: hold.expiresAt.toISOString(),
    revision: 1,
  };
}
