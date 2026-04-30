import { Module } from '@nestjs/common';
import { PromotionReportService } from './promotion-report.service';
import { PromotionReportController } from './promotion-report.controller';

@Module({
  providers: [PromotionReportService],
  controllers: [PromotionReportController],
  exports: [PromotionReportService],
})
export class PromotionReportModule {}
