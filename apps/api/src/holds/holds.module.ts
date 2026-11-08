import { Module } from '@nestjs/common';

import { HoldsController } from './holds.controller';
import { HoldService } from './hold.service';

/** Temporary holds on physical spaces. */
@Module({
  controllers: [HoldsController],
  providers: [HoldService],
})
export class HoldsModule {}
