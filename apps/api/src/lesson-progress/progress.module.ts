import { Module } from '@nestjs/common';
import { ProgressService } from './progress.service';
import { ProgressController } from './progress.controller';
import { SocialModule } from '../social/social.module';
import { AnalyticsModule } from '../analytics/analytics.module';

@Module({
  imports: [SocialModule, AnalyticsModule],
  providers: [ProgressService],
  controllers: [ProgressController],
  exports: [ProgressService],
})
export class ProgressModule {}
