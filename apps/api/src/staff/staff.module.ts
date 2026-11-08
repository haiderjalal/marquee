import { Module } from '@nestjs/common';

import { StaffController } from './staff.controller';
import { StaffService } from './staff.service';

/** Staff overview dashboard and audit trail. */
@Module({
  controllers: [StaffController],
  providers: [StaffService],
})
export class StaffModule {}
