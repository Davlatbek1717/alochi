import { Module } from '@nestjs/common';
import { MonitoringService } from './monitoring.service';
import {
  ScreenshotController,
  ScreenshotReviewController,
  StudentScreenshotController,
  BranchScreenshotController,
  PresenceController,
  StudentPresenceController,
  PresenceAnomaliesController,
  CheatingController,
  CheatingSignalController,
} from './monitoring.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [
    ScreenshotController,
    ScreenshotReviewController,
    StudentScreenshotController,
    BranchScreenshotController,
    PresenceController,
    StudentPresenceController,
    PresenceAnomaliesController,
    CheatingController,
    CheatingSignalController,
  ],
  providers: [MonitoringService],
  exports: [MonitoringService],
})
export class MonitoringModule {}
