import { createHoldSchema } from '@marquee/contracts';
import { DomainError } from '@marquee/domain';
import { Body, Controller, Headers, Inject, Post, Req, UseGuards } from '@nestjs/common';

import { CurrentPrincipal, type Principal } from '../auth/principal';
import { StaffAuthGuard } from '../auth/staff-auth.guard';
import { type CorrelatedRequest } from '../core/correlation';

import { HoldService } from './hold.service';

/** Bounds for the Idempotency-Key header, matching the idempotency_record constraint. */
const MIN_KEY_LENGTH = 8;
const MAX_KEY_LENGTH = 128;

/**
 * Staff hold endpoint. Requires an authenticated membership and an Idempotency-Key header.
 */
@Controller('staff/holds')
@UseGuards(StaffAuthGuard)
export class HoldsController {
  private readonly holds: HoldService;

  /**
   * @param holds Hold use cases.
   */
  constructor(@Inject(HoldService) holds: HoldService) {
    this.holds = holds;
  }

  /**
   * Places a temporary hold on a space for an interval with setup and teardown.
   * @param principal Verified caller.
   * @param key Idempotency-Key header.
   * @param body Unvalidated request body.
   * @param request Request carrying the correlation id.
   * @returns The hold in the `{ data }` envelope.
   * @throws DomainError VALIDATION_FAILED when the key header is missing or malformed.
   */
  @Post()
  async create(
    @CurrentPrincipal() principal: Principal,
    @Headers('idempotency-key') key: string | undefined,
    @Body() body: unknown,
    @Req() request: CorrelatedRequest,
  ) {
    if (key === undefined || key.length < MIN_KEY_LENGTH || key.length > MAX_KEY_LENGTH) {
      throw new DomainError(
        'VALIDATION_FAILED',
        'Send an Idempotency-Key header of 8 to 128 characters.',
      );
    }
    const input = createHoldSchema.parse(body);
    const correlationId = request.correlationId ?? 'missing-correlation';
    return { data: await this.holds.create(principal, input, key, correlationId) };
  }
}
