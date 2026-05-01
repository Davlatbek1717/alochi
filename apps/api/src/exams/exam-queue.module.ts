import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ExamQueueService } from './exam-queue.service';
import { ExamQueueController } from './exam-queue.controller';

@Module({
  imports: [PrismaModule],
  providers: [ExamQueueService],
  controllers: [ExamQueueController],
  exports: [ExamQueueService],
})
export class ExamQueueModule {}
