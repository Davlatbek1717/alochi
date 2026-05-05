import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ExamsController } from './exams.controller';
import { ExamsService } from './exams.service';
import { ExamAdminController } from './exam.admin.controller';
import { ExamService } from './exam.service';
import { OralExamController } from './oral-exam.controller';
import { OralExamService } from './oral-exam.service';
import { PrismaModule } from '../prisma/prisma.module';
import { I18nModule } from '../i18n/i18n.module';

@Module({
  imports: [PrismaModule, ConfigModule, I18nModule],
  // Three flows, three controllers:
  //   - ExamsController/Service — legacy student-facing exam permission
  //     flow (mentor grants /exams/my-active, student takes lesson MCQ).
  //   - ExamAdminController/ExamService — superadmin CRUD for the
  //     standalone Exam catalogue (kind=test).
  //   - OralExamController/OralExamService — student-facing AI oral
  //     exam (kind=ai_oral). Conversation runner backed by Gemini.
  controllers: [ExamsController, ExamAdminController, OralExamController],
  providers: [ExamsService, ExamService, OralExamService],
  exports: [ExamsService, ExamService, OralExamService],
})
export class ExamsModule {}
