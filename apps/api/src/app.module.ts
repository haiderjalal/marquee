import { type DynamicModule, Module } from '@nestjs/common';

import { ConfiguratorModule } from './configurator/configurator.module';
import { CoreModule } from './core/core.module';
import { type AppDependencies } from './core/tokens';
import { EnquiriesModule } from './enquiries/enquiries.module';
import { HoldsModule } from './holds/holds.module';
import { QuotesModule } from './quotes/quotes.module';
import { StaffModule } from './staff/staff.module';
import { VenuesModule } from './venues/venues.module';

/**
 * Root module. Feature modules are listed here; the core module is supplied per
 * application instance so tests can provide their own database, clock and identifiers.
 */
@Module({})
export class RootModule {
  /**
   * Builds the root module for one application instance.
   * @param dependencies Configuration and infrastructure handles.
   * @param logger Logger to provide to the core module.
   * @returns The dynamic module definition.
   */
  static forRoot(dependencies: AppDependencies): DynamicModule {
    return {
      module: RootModule,
      imports: [
        CoreModule.forRoot(dependencies),
        VenuesModule,
        ConfiguratorModule,
        QuotesModule,
        EnquiriesModule,
        HoldsModule,
        StaffModule,
      ],
    };
  }
}
