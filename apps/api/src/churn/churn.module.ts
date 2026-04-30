import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ChurnService } from './churn.service';
import { ChurnController } from './churn.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule, HttpModule],
  providers: [ChurnService],
  controllers: [ChurnController],
  exports: [ChurnService],
})
export class ChurnModule {}
