import { Module } from '@nestjs/common';
import { XpService } from './xp.service';
import { StreakService } from './streak.service';
import { QuestService } from './quest.service';
import { CertificatesService } from './certificates.service';
import { GamificationController } from './gamification.controller';

@Module({
  providers: [XpService, StreakService, QuestService, CertificatesService],
  controllers: [GamificationController],
  exports: [XpService, StreakService, QuestService, CertificatesService],
})
export class GamificationModule {}
