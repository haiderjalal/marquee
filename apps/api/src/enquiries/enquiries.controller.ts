import {
  changeEnquiryStatusSchema,
  createEnquirySchema,
  listLimitQuerySchema,
} from '@marquee/contracts';
import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';

import { CurrentPrincipal, type Principal } from '../auth/principal';
import { StaffAuthGuard } from '../auth/staff-auth.guard';
import { type CorrelatedRequest } from '../core/correlation';
import { PublicRateLimitGuard } from '../core/rate-limit';

import { EnquiryService } from './enquiry.service';

/** Identifier format for route parameters that name a stored record. */
const recordIdSchema = z.uuid();

/**
 * Public enquiry submission. Rate-limited per client because it is unauthenticated.
 */
@Controller('public/enquiries')
export class PublicEnquiriesController {
  private readonly enquiries: EnquiryService;

  /**
   * @param enquiries Enquiry use cases.
   */
  constructor(@Inject(EnquiryService) enquiries: EnquiryService) {
    this.enquiries = enquiries;
  }

  /**
   * Accepts an enquiry for a published venue.
   * @param body Unvalidated request body.
   * @param request Request carrying the correlation id.
   * @returns The receipt in the `{ data }` envelope.
   */
  @Post()
  @UseGuards(PublicRateLimitGuard)
  async create(@Body() body: unknown, @Req() request: CorrelatedRequest) {
    const input = createEnquirySchema.parse(body);
    return { data: await this.enquiries.submit(input, requireCorrelation(request)) };
  }
}

/**
 * Staff lead list and status changes. Requires an authenticated staff membership.
 */
@Controller('staff/enquiries')
@UseGuards(StaffAuthGuard)
export class StaffEnquiriesController {
  private readonly enquiries: EnquiryService;

  /**
   * @param enquiries Enquiry use cases.
   */
  constructor(@Inject(EnquiryService) enquiries: EnquiryService) {
    this.enquiries = enquiries;
  }

  /**
   * Lists the tenant's enquiries.
   * @param principal Verified caller.
   * @param limit Optional row limit from the query string.
   * @returns Enquiry rows in the `{ data }` envelope.
   */
  @Get()
  async list(@CurrentPrincipal() principal: Principal, @Query('limit') limit?: string) {
    const query = listLimitQuerySchema.parse({ limit });
    return { data: await this.enquiries.list(principal, query.limit) };
  }

  /**
   * Moves a lead to a new status.
   * @param principal Verified caller.
   * @param id Enquiry identifier from the route.
   * @param body Unvalidated status change.
   * @param request Request carrying the correlation id.
   * @returns The updated status in the `{ data }` envelope.
   */
  @Patch(':id/status')
  async changeStatus(
    @CurrentPrincipal() principal: Principal,
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() request: CorrelatedRequest,
  ) {
    const enquiryId = recordIdSchema.parse(id);
    const input = changeEnquiryStatusSchema.parse(body);
    return {
      data: await this.enquiries.changeStatus(
        principal,
        enquiryId,
        input,
        requireCorrelation(request),
      ),
    };
  }
}

/**
 * Reads the correlation id attached by middleware. Missing ids indicate a wiring fault.
 * @param request Request.
 * @returns The correlation identifier.
 * @throws Error when middleware did not run.
 */
function requireCorrelation(request: CorrelatedRequest): string {
  if (!request.correlationId) {
    throw new Error('Correlation middleware did not run.');
  }
  return request.correlationId;
}
