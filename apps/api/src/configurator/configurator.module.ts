import { Module } from '@nestjs/common';

import { ConfiguratorController } from './configurator.controller';
import { ConfiguratorService } from './configurator.service';

/** Seating validation for the configurator. */
@Module({
  controllers: [ConfiguratorController],
  providers: [ConfiguratorService],
  exports: [ConfiguratorService],
})
export class ConfiguratorModule {}
