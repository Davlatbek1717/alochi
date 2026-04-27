import { Controller, Post, Get, Body, Request, UseGuards, Query } from '@nestjs/common';
import { AiService } from './ai.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Controller('ai')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AiController {
  constructor(
    private ai: AiService,
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  @Post('tutor/ask')
  @Roles(UserRole.student)
  askTutor(
    @Body()
    body: {
      lessonContext: string;
      question: string;
      history: { role: string; content: string }[];
    },
  ) {
    return this.ai.askTutor(body.lessonContext, body.question, body.history);
  }

  @Post('evaluate')
  @Roles(UserRole.student, UserRole.tester)
  evaluate(
    @Body()
    body: {
      lessonContext: string;
      studentAnswers: { question: string; student_answer: string }[];
    },
  ) {
    return this.ai.evaluate(body.lessonContext, body.studentAnswers);
  }

  @Post('speech/check')
  @Roles(UserRole.student)
  checkPronunciation(@Body() body: { wordEn: string; audioBase64: string }) {
    return this.ai.checkPronunciation(body.wordEn, body.audioBase64);
  }

  @Post('spaced-repetition/answer')
  @Roles(UserRole.student)
  recordAnswer(
    @Body() body: { word: string; correct: boolean },
    @Request() req: any,
  ) {
    return this.ai.recordSpacedAnswer(req.user.userId, body.word, body.correct);
  }

  @Get('spaced-repetition/daily-review')
  @Roles(UserRole.student)
  getDailyReview(@Request() req: any) {
    return this.ai.getDailyReview(req.user.userId);
  }

  @Post('record-error')
  @Roles(UserRole.student)
  async recordError(
    @Body() body: { lessonId: string; question: string },
    @Request() req: any,
  ) {
    const result = await this.ai.recordError(req.user.userId, body.lessonId, body.question);

    if (result.errorCount >= 3 && !result.notified) {
      const student = await this.prisma.user.findUnique({
        where: { id: req.user.userId },
        select: { branchId: true, name: true },
      });
      if (student?.branchId) {
        const mentor = await this.prisma.user.findFirst({
          where: { branchId: student.branchId, role: 'mentor' },
          select: { id: true },
        });
        if (mentor) {
          await this.notifications.send(
            mentor.id,
            'error_pattern',
            "O'quvchi xatosi",
            `${student.name} "${body.question}" savolida 3 marta xato qildi`,
          ).catch(() => {});
        }
      }
      await this.prisma.errorLog.update({
        where: { studentId_lessonId_question: { studentId: req.user.userId, lessonId: body.lessonId, question: body.question } },
        data: { notified: true },
      });
    }

    return result;
  }

  @Get('analyze-errors')
  @Roles(UserRole.student, UserRole.mentor, UserRole.manager)
  analyzeErrors(@Query('studentId') studentId: string, @Request() req: any) {
    const id = req.user.role === 'student' ? req.user.userId : studentId;
    return this.ai.analyzeErrors(id);
  }
}
