import { Module } from '@nestjs/common';

import { VenueService } from './venue.service';
import { VenuesController } from './venues.controller';

/** Public venue discovery and detail. */
@Module({
  controllers: [VenuesController],
  providers: [VenueService],
})
export class VenuesModule {}
