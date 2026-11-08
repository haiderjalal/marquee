import { configurationValidateSchema } from '@marquee/contracts';
import { Body, Controller, HttpCode, Inject, Post } from '@nestjs/common';

import { ConfiguratorService } from './configurator.service';

/** Public seating validation endpoint. Stateless; it stores nothing. */
@Controller('public/configurations')
export class ConfiguratorController {
  private readonly configurator: ConfiguratorService;

  /**
   * @param configurator Seating validation service.
   */
  constructor(@Inject(ConfiguratorService) configurator: ConfiguratorService) {
    this.configurator = configurator;
  }

  /**
   * Validates seating for a guest count. Returns the canonical placements or a refusal.
   * @param body Unvalidated request body.
   * @returns The validation result in the `{ data }` envelope.
   */
  @Post('validate')
  @HttpCode(200)
  async validate(@Body() body: unknown) {
    const input = configurationValidateSchema.parse(body);
    return { data: await this.configurator.validate(input) };
  }
}
