import { Module } from '@nestjs/common';
import { ActivityService } from './activity.service';
import { ActivityController, StudentActivityController } from './activity.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ActivityController, StudentActivityController],
  providers: [ActivityService],
  exports: [ActivityService],
})
export class ActivityModule {}
