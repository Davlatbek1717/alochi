import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { CacheService } from './cache.service';
import { CronFaceService } from './cron-face.service';
import { FaceController } from './face.controller';
import { FaceService } from './face.service';
import { DevicesService } from './devices.service';
import { DevicesController } from './devices.controller';
import { AttendanceModule } from '../attendance/attendance.module';
import { TelegramModule } from '../telegram/telegram.module';

@Module({
  imports: [
    AttendanceModule,
    TelegramModule,
    JwtModule.register({
      secret:
        process.env.DEVICE_TOKEN_SECRET ??
        process.env.JWT_SECRET ??
        'dev-device-secret-change-me',
    }),
  ],
  controllers: [FaceController, DevicesController],
  providers: [CacheService, CronFaceService, FaceService, DevicesService],
  exports: [CacheService, FaceService, DevicesService],
})
export class FaceModule {}
