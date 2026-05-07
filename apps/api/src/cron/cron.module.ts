import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { TelegramModule } from '../telegram/telegram.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { NotificationTemplatesModule } from '../notification-templates/notification-templates.module';
import { KpiModule } from '../kpi/kpi.module';
import { GamificationModule } from '../gamification/gamification.module';
import { CronService } from './cron.service';

@Module({
  imports: [
    PrismaModule,
    TelegramModule,
    NotificationsModule,
    NotificationTemplatesModule,
    KpiModule,
    GamificationModule,
  ],
  providers: [CronService],
  exports: [CronService],
})
export class CronModule {}
