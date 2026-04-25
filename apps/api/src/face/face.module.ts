import { Module } from '@nestjs/common';
import { CacheService } from './cache.service';
import { CronFaceService } from './cron-face.service';
import { FaceController } from './face.controller';
import { FaceService } from './face.service';
import { DevicesService } from './devices.service';
import { DevicesController } from './devices.controller';

@Module({
  controllers: [FaceController, DevicesController],
  providers: [CacheService, CronFaceService, FaceService, DevicesService],
  exports: [CacheService, FaceService, DevicesService],
})
export class FaceModule {}
