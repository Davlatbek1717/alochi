import { Module } from '@nestjs/common';
import { StudyTimeService } from './study-time.service';
import { StudyTimeController } from './study-time.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [StudyTimeController],
  providers: [StudyTimeService],
  exports: [StudyTimeService],
})
export class StudyTimeModule {}
