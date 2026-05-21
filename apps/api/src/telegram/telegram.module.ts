import { Module } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { TelegramController } from './telegram.controller';
import { TelegramWebhookGuard } from './telegram-webhook.guard';
import { ConfigModule } from '@nestjs/config';
import { ParentHandler } from './handlers/parent.handler';
import { StudentHandler } from './handlers/student.handler';
import { StaffHandler } from './handlers/staff.handler';
import { NotificationHandler } from './handlers/notification.handler';
import { DelegationHandler } from './handlers/delegation.handler';
import { StatusTelegramHandler } from './handlers/status.handler';
import { GamificationTelegramHandler } from './handlers/gamification.handler';
import { VideoCheckinHandler } from './handlers/video-checkin.handler';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationTemplatesModule } from '../notification-templates/notification-templates.module';
@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    NotificationTemplatesModule,
  ],
  controllers: [TelegramController],
  providers: [
    TelegramWebhookGuard,
    TelegramService,
    ParentHandler,
    StudentHandler,
    StaffHandler,
    NotificationHandler,
    DelegationHandler,
    StatusTelegramHandler,
    GamificationTelegramHandler,
    VideoCheckinHandler,
  ],
  exports: [
    TelegramService,
    ParentHandler,
    StudentHandler,
    StaffHandler,
    NotificationHandler,
    DelegationHandler,
    StatusTelegramHandler,
    GamificationTelegramHandler,
    VideoCheckinHandler,
  ],
})
export class TelegramModule {}
