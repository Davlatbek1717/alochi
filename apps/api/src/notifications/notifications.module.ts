import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { NotificationEventHandler } from './notification-event.handler';

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationEventHandler],
  exports: [NotificationsService],
})
export class NotificationsModule {}
