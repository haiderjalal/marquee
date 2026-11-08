import { venueSlugSchema } from '@marquee/contracts';
import { Controller, Get, Inject, Param } from '@nestjs/common';

import { VenueService } from './venue.service';

/**
 * Public, unauthenticated venue reads. Responses follow the `{ data }` envelope.
 */
@Controller('public/venues')
export class VenuesController {
  private readonly venues: VenueService;

  /**
   * @param venues Venue read service.
   */
  constructor(@Inject(VenueService) venues: VenueService) {
    this.venues = venues;
  }

  /**
   * Lists published venues.
   * @returns Venue summaries.
   */
  @Get()
  async list() {
    return { data: await this.venues.listPublished() };
  }

  /**
   * Returns one published venue with its configurator catalogue.
   * @param slug Public slug from the route.
   * @returns Venue detail.
   */
  @Get(':slug')
  async detail(@Param('slug') slug: string) {
    return { data: await this.venues.getPublished(venueSlugSchema.parse(slug)) };
  }
}
