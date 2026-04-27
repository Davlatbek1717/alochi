import { Controller, Post, Get, Body, Request, UseGuards } from '@nestjs/common';
import { AiService } from './ai.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('ai')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AiController {
  constructor(private ai: AiService) {}

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
}
