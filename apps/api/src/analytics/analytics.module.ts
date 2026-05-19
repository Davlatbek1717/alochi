import { Module } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { ChurnService } from './churn.service';
import { AnalyticsController } from './analytics.controller';

@Module({
  providers: [AnalyticsService, ChurnService],
  controllers: [AnalyticsController],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
