import { Module } from '@nestjs/common';
import { ExamsController } from './exams.controller';
import { ExamsService } from './exams.service';
import { ExamAdminController } from './exam.admin.controller';
import { ExamService } from './exam.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  // Two controllers, two services here:
  //   - ExamsController/Service — legacy student-facing exam permission
  //     flow (mentor grants /exams/my-active, student takes lesson MCQ).
  //   - ExamAdminController/ExamService — new superadmin CRUD for the
  //     standalone Exam catalogue introduced in this phase.
  controllers: [ExamsController, ExamAdminController],
  providers: [ExamsService, ExamService],
  exports: [ExamsService, ExamService],
})
export class ExamsModule {}
