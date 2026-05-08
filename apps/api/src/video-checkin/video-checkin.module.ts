import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { VideoCheckinService } from './video-checkin.service';
import { VideoCheckinController } from './video-checkin.controller';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [VideoCheckinController],
  providers: [VideoCheckinService],
  exports: [VideoCheckinService],
})
export class VideoCheckinModule {}
