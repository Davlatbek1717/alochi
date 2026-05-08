import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { VideoCheckinService } from './video-checkin.service';
import { VideoCheckinController } from './video-checkin.controller';

// NOTE: We deliberately do NOT import NotificationsModule here.
// NotificationsModule already imports TelegramModule, and TelegramModule
// imports this module for the bot handler — pulling NotificationsModule
// in would close a Telegram → VideoCheckin → Notifications → Telegram
// cycle. The service writes to prisma.notification directly instead,
// matching the row shape the bell-icon list expects.
@Module({
  imports: [PrismaModule],
  controllers: [VideoCheckinController],
  providers: [VideoCheckinService],
  exports: [VideoCheckinService],
})
export class VideoCheckinModule {}
