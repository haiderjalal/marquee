import { Module } from '@nestjs/common';

import { EnquiryService } from './enquiry.service';
import { PublicEnquiriesController, StaffEnquiriesController } from './enquiries.controller';

/** Enquiries: public submission and staff lead management. */
@Module({
  controllers: [PublicEnquiriesController, StaffEnquiriesController],
  providers: [EnquiryService],
  exports: [EnquiryService],
})
export class EnquiriesModule {}
