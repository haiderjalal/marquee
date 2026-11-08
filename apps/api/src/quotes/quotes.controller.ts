import { quotePreviewSchema } from '@marquee/contracts';
import { Body, Controller, HttpCode, Inject, Post } from '@nestjs/common';

import { QuoteService } from './quote.service';

/** Public, non-binding quote preview. */
@Controller('public/quotes')
export class QuotesController {
  private readonly quotes: QuoteService;

  /**
   * @param quotes Quote preview service.
   */
  constructor(@Inject(QuoteService) quotes: QuoteService) {
    this.quotes = quotes;
  }

  /**
   * Prices a configuration as an estimate using server-side catalogue values.
   * @param body Unvalidated request body; totals or discounts in it are rejected by the schema.
   * @returns The estimate in the `{ data }` envelope.
   */
  @Post('preview')
  @HttpCode(200)
  async preview(@Body() body: unknown) {
    const input = quotePreviewSchema.parse(body);
    return { data: await this.quotes.preview(input) };
  }
}
