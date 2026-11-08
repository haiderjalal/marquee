import {
  type PublicSpaceDetailDto,
  type PublicStageDto,
  type PublicVenueDetailDto,
  type PublicVenueSummaryDto,
  venueShellPayloadSchema,
} from '@marquee/contracts';
import {
  type CatalogueRecord,
  type DatabaseClient,
  findPublishedVenueBySlug,
  listPublishedVenues,
  type SpaceRecord,
  type VenueAggregate,
} from '@marquee/database';
import { DomainError, pkrMinor, toMinorString } from '@marquee/domain';
import { Inject, Injectable } from '@nestjs/common';

import { parseMenuPayload, parseStagePayload } from '../configurator/layout-plan';
import { DATABASE } from '../core/tokens';

/** Disclaimer shown whenever the catalogue still contains demonstration values. */
const DEMO_DISCLAIMER =
  'Demonstration data: venue names, prices and package contents are fictional until the venue approves its own.';

/**
 * Public venue reads. Only published rows are returned; drafts and withdrawn catalogue
 * items never reach a public response.
 */
@Injectable()
export class VenueService {
  private readonly database: DatabaseClient;

  /**
   * @param database Database handle.
   */
  constructor(@Inject(DATABASE) database: DatabaseClient) {
    this.database = database;
  }

  /**
   * Lists published venues for discovery.
   * @returns Venue summaries with their spaces.
   */
  async listPublished(): Promise<PublicVenueSummaryDto[]> {
    const rows = await listPublishedVenues(this.database.db);
    return rows.map(({ venue, spaces }) => ({
      slug: venue.slug,
      name: venue.name,
      tagline: venue.tagline,
      publishedCapacityGuests: venue.publishedCapacityGuests,
      indoor: venue.indoor,
      facilities: [...venue.facilities],
      photo: null,
      spaces: spaces.map((space) => ({
        id: space.id,
        name: space.name,
        publishedCapacityGuests: space.publishedCapacityGuests,
        shellVersionId: space.shellVersionId,
      })),
    }));
  }

  /**
   * Returns one published venue with its configurator catalogue.
   * @param slug Public venue slug.
   * @returns Venue detail.
   * @throws DomainError NOT_FOUND when no published venue has the slug.
   */
  async getPublished(slug: string): Promise<PublicVenueDetailDto> {
    const aggregate = await findPublishedVenueBySlug(this.database.db, slug);
    if (!aggregate) {
      throw new DomainError('NOT_FOUND', 'That venue is not published.');
    }
    return toDetail(aggregate);
  }
}

/**
 * Builds the public detail DTO from an aggregate.
 * @param aggregate Published venue aggregate.
 * @returns Venue detail with catalogue offers.
 */
function toDetail(aggregate: VenueAggregate): PublicVenueDetailDto {
  const { venue, spaces } = aggregate;
  const catalogue = aggregate.catalogue;
  const anyDemo = catalogue.some((item) => item.demo);
  return {
    slug: venue.slug,
    name: venue.name,
    tagline: venue.tagline,
    publishedCapacityGuests: venue.publishedCapacityGuests,
    indoor: venue.indoor,
    facilities: [...venue.facilities],
    photo: null,
    spaces: spaces.map((space) => toSpaceDetail(aggregate, space)),
    stages: catalogue.filter((item) => item.kind === 'stage').map(toStage),
    menuPackages: catalogue
      .filter((item) => item.kind === 'menu_package')
      .map((item) => {
        const payload = parseMenuPayload(item.payload);
        return {
          id: item.code,
          name: item.name,
          pricePerGuest: toMinorString(pkrMinor(item.unitPriceMinor)),
          includes: payload.includes,
          description: payload.description ?? '',
        };
      }),
    extras: catalogue
      .filter((item) => item.kind === 'extra')
      .map((item) => ({
        code: item.code,
        label: item.name,
        unitPrice: toMinorString(pkrMinor(item.unitPriceMinor)),
      })),
    disclaimer: anyDemo
      ? DEMO_DISCLAIMER
      : 'Prices and package contents are shown as approved by the venue.',
  };
}

/**
 * Builds a space for the detail page, including its approved shell. A space whose shell is
 * missing or invalid is an integrity fault and is raised, not replaced with a guess.
 * @param aggregate Venue aggregate holding the shell versions.
 * @param space Space row.
 * @returns Detail space with shell geometry.
 */
function toSpaceDetail(aggregate: VenueAggregate, space: SpaceRecord): PublicSpaceDetailDto {
  const record = aggregate.shells.find((shell) => shell.id === space.shellVersionId);
  if (!record) {
    throw new Error(`Space ${space.id} references missing shell version ${space.shellVersionId}.`);
  }
  return {
    id: space.id,
    name: space.name,
    publishedCapacityGuests: space.publishedCapacityGuests,
    shellVersionId: space.shellVersionId,
    shell: venueShellPayloadSchema.parse(record.payload),
  };
}

/**
 * Maps a stage catalogue row to its public shape.
 * @param item Stage catalogue row.
 * @returns Public stage preset.
 */
function toStage(item: CatalogueRecord): PublicStageDto {
  const payload = parseStagePayload(item.payload);
  return {
    id: item.code,
    name: item.name,
    price: toMinorString(pkrMinor(item.unitPriceMinor)),
    widthMm: payload.widthMm,
    depthMm: payload.depthMm,
    heightMm: payload.heightMm,
    collection: payload.collection,
  };
}
