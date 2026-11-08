import { Module } from '@nestjs/common';

import { QuoteService } from './quote.service';
import { QuotesController } from './quotes.controller';

/** Non-binding quote preview. */
@Module({
  controllers: [QuotesController],
  providers: [QuoteService],
})
export class QuotesModule {}
