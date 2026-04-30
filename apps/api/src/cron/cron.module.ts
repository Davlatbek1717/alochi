import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PrismaModule } from '../prisma/prisma.module';
import { TelegramModule } from '../telegram/telegram.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AdaptiveModule } from '../adaptive/adaptive.module';
import { ChurnModule } from '../churn/churn.module';
import { CronService } from './cron.service';

@Module({
  imports: [
    PrismaModule,
    TelegramModule,
    NotificationsModule,
    AdaptiveModule,
    ChurnModule,
    HttpModule,
  ],
  providers: [CronService],
  exports: [CronService],
})
export class CronModule {}
