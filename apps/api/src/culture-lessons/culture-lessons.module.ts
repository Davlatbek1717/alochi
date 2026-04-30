import { Module } from '@nestjs/common';
import { CultureLessonsService } from './culture-lessons.service';
import { CultureLessonsController } from './culture-lessons.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  providers: [CultureLessonsService],
  controllers: [CultureLessonsController],
  exports: [CultureLessonsService],
})
export class CultureLessonsModule {}
