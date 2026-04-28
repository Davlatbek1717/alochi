import { Module } from '@nestjs/common';
import { ContentQualityService } from './content-quality.service';
import { ContentQualityController } from './content-quality.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  providers: [ContentQualityService],
  controllers: [ContentQualityController],
  exports: [ContentQualityService],
})
export class ContentQualityModule {}
