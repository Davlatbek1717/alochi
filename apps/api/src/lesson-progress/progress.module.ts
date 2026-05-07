import { Module, forwardRef } from '@nestjs/common';
import { ProgressService } from './progress.service';
import { ProgressController } from './progress.controller';
import { SocialModule } from '../social/social.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { GamificationModule } from '../gamification/gamification.module';
import { StudentStatusModule } from '../student-status/status.module';

@Module({
  imports: [
    SocialModule,
    AnalyticsModule,
    // forwardRef breaks the GamificationModule ↔ ProgressModule cycle that
    // would otherwise arise when CertificatesService is injected into
    // ProgressService for auto-awarding on academy completion.
    forwardRef(() => GamificationModule),
    // Variant B auto-status — feeds StatusService.setEnglishStatus from
    // the per-session accuracy reported by the lesson runner.
    StudentStatusModule,
  ],
  providers: [ProgressService],
  controllers: [ProgressController],
  exports: [ProgressService],
})
export class ProgressModule {}
