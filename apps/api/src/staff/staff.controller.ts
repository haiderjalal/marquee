import { listLimitQuerySchema, staffOverviewQuerySchema } from '@marquee/contracts';
import { Controller, Get, Inject, Query, UseGuards } from '@nestjs/common';

import { CurrentPrincipal, type Principal } from '../auth/principal';
import { StaffAuthGuard } from '../auth/staff-auth.guard';

import { StaffService } from './staff.service';

/** Staff dashboard and audit trail. Every route requires an authenticated membership. */
@Controller('staff')
@UseGuards(StaffAuthGuard)
export class StaffController {
  private readonly staff: StaffService;

  /**
   * @param staff Staff read models.
   */
  constructor(@Inject(StaffService) staff: StaffService) {
    this.staff = staff;
  }

  /**
   * Returns the overview dashboard for the caller's workspace.
   * @param principal Verified caller.
   * @returns Overview in the `{ data }` envelope.
   */
  @Get('overview')
  async overview(@CurrentPrincipal() principal: Principal, @Query('from') from?: string) {
    const query = staffOverviewQuerySchema.parse({ from });
    return { data: await this.staff.overview(principal, query.from) };
  }

  /**
   * Lists recent audit events for owners and managers.
   * @param principal Verified caller.
   * @param limit Optional row limit from the query string.
   * @returns Audit events in the `{ data }` envelope.
   */
  @Get('audit')
  async audit(@CurrentPrincipal() principal: Principal, @Query('limit') limit?: string) {
    const query = listLimitQuerySchema.parse({ limit });
    return { data: await this.staff.audit(principal, query.limit) };
  }
}
