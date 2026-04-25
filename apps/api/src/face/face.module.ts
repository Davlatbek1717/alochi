import { Module } from '@nestjs/common';
import { CacheService } from './cache.service';
import { CronFaceService } from './cron-face.service';
import { FaceController } from './face.controller';

@Module({
  controllers: [FaceController],
  providers: [CacheService, CronFaceService],
  exports: [CacheService],
})
export class FaceModule {}
