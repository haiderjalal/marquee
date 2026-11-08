import type { QuotePreviewDto, QuotePreviewInput } from '@marquee/contracts';
import {
  type CatalogueRecord,
  type DatabaseClient,
  findPublishedVenueBySlug,
  type VenueAggregate,
} from '@marquee/database';
import {
  DomainError,
  pkrMinor,
  type PricedQuote,
  priceQuote,
  type QuoteCatalogueInput,
  type QuotePolicy,
  toMinorString,
} from '@marquee/domain';
import { Inject, Injectable } from '@nestjs/common';

import {
  defaultSpace,
  findStage,
  planSpace,
  stageCheckFor,
  stageConflictMessage,
} from '../configurator/layout-plan';
import { DATABASE } from '../core/tokens';

/** Note attached to every preview so the estimate is never mistaken for a booking or invoice. */
const PREVIEW_NOTE =
  'Estimate only. Taxes are excluded and no date is reserved until a booking is confirmed by the venue.';

/**
 * Server-side quote preview. The browser sends choices; every price, rule and total is
 * resolved here from the approved catalogue. A request whose layout cannot seat the guests
 * is refused, because a quotation for an impossible layout must never be issued.
 */
@Injectable()
export class QuoteService {
  private readonly database: DatabaseClient;

  /**
   * @param database Database handle.
   */
  constructor(@Inject(DATABASE) database: DatabaseClient) {
    this.database = database;
  }

  /**
   * Prices a configuration as a non-binding estimate.
   * @param input Validated choices from the public configurator.
   * @returns The estimate in minor-unit strings.
   * @throws DomainError NOT_FOUND, VALIDATION_FAILED, LAYOUT_DOES_NOT_FIT or POLICY_BLOCKED.
   */
  async preview(input: QuotePreviewInput): Promise<QuotePreviewDto> {
    const aggregate = await findPublishedVenueBySlug(this.database.db, input.venueSlug);
    if (!aggregate) {
      throw new DomainError('NOT_FOUND', 'That venue is not published.');
    }
    const space = defaultSpace(aggregate);
    const plan = planSpace(aggregate, space, input.requestedGuests, input.seatsPerTable);
    if (!plan.outcome.ok) {
      throw new DomainError(plan.outcome.code, plan.outcome.message);
    }
    if (input.stageId !== null) {
      const stageCheck = stageCheckFor(plan, findStage(aggregate, input.stageId));
      if (stageCheck && !stageCheck.fits) {
        throw new DomainError('POLICY_BLOCKED', stageConflictMessage(stageCheck));
      }
    }

    const menu = findCatalogue(
      aggregate,
      'menu_package',
      input.packageId,
      'Choose an available menu package.',
    );
    const stage =
      input.stageId === null
        ? null
        : findCatalogue(aggregate, 'stage', input.stageId, 'Choose an available stage.');
    const extras = input.extras
      .filter((selection) => selection.quantity > 0)
      .map((selection) => {
        const extra = findCatalogue(
          aggregate,
          'extra',
          selection.code,
          'Choose an available extra.',
        );
        return {
          code: extra.code,
          label: extra.name,
          unitPrice: pkrMinor(extra.unitPriceMinor),
          quantity: selection.quantity,
        };
      });

    const catalogue: QuoteCatalogueInput = {
      guestsRequested: input.requestedGuests,
      menu: {
        packageVersionId: `${menu.code}@v${menu.version}`,
        packageName: menu.name,
        pricePerGuest: pkrMinor(menu.unitPriceMinor),
      },
      space: { spaceName: space.name, rent: pkrMinor(space.rentMinor) },
      stage: stage ? { stageName: stage.name, price: pkrMinor(stage.unitPriceMinor) } : null,
      extras,
    };
    const priced = priceQuote(catalogue, toQuotePolicy(aggregate), null);
    return toPreviewDto(priced, aggregate.policy.advanceBasisPoints);
  }
}

/**
 * Finds an active catalogue item of one kind by its public code.
 * @param aggregate Venue aggregate.
 * @param kind Catalogue kind.
 * @param code Public code from the request.
 * @param message Safe message used when the code is unknown.
 * @returns The catalogue row.
 * @throws DomainError VALIDATION_FAILED when no published item matches.
 */
function findCatalogue(
  aggregate: VenueAggregate,
  kind: CatalogueRecord['kind'],
  code: string,
  message: string,
): CatalogueRecord {
  const item = aggregate.catalogue.find(
    (candidate) => candidate.kind === kind && candidate.code === code,
  );
  if (!item) {
    throw new DomainError('VALIDATION_FAILED', message);
  }
  return item;
}

/**
 * Converts stored venue policy into the domain policy type.
 * @param aggregate Venue aggregate containing the policy row.
 * @returns Domain quote policy.
 */
function toQuotePolicy(aggregate: VenueAggregate): QuotePolicy {
  const policy = aggregate.policy;
  return {
    minBillableGuests: policy.minBillableGuests,
    rentWaiverFoodThreshold:
      policy.rentWaiverFoodThresholdMinor === null
        ? null
        : pkrMinor(policy.rentWaiverFoodThresholdMinor),
    minimumSpend: policy.minimumSpendMinor === null ? null : pkrMinor(policy.minimumSpendMinor),
    advanceBasisPoints: policy.advanceBasisPoints,
  };
}

/**
 * Serialises a priced quote for the API.
 * @param priced Domain quote.
 * @param advanceBasisPoints Advance rate used, for display.
 * @returns Preview DTO.
 */
function toPreviewDto(priced: PricedQuote, advanceBasisPoints: number): QuotePreviewDto {
  return {
    label: 'ESTIMATE',
    currency: 'PKR',
    billableGuests: priced.billableGuests,
    lines: priced.lines.map((line) => ({
      code: line.code,
      label: line.label,
      quantity: line.quantity,
      amount: toMinorString(line.amount),
      ruleCode: line.ruleCode,
    })),
    subtotal: toMinorString(priced.subtotal),
    total: toMinorString(priced.total),
    advance: toMinorString(priced.advance),
    balance: toMinorString(priced.balance),
    advancePercent: advanceBasisPoints / 100,
    note: PREVIEW_NOTE,
  };
}
