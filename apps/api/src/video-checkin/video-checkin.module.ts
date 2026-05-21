import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { VideoCheckinService } from './video-checkin.service';
import { VideoCheckinController } from './video-checkin.controller';

@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [VideoCheckinController],
  providers: [VideoCheckinService],
  exports: [VideoCheckinService],
})
export class VideoCheckinModule {}
