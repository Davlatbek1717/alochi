import {
  Controller,
  Post,
  Get,
  Body,
  Request,
  UseGuards,
  Query,
} from '@nestjs/common';
import { AiService } from './ai.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { GradeTranslationDto } from './dto/grade-translation.dto';
import { ExplainAnswerDto } from './dto/explain-answer.dto';
import { TtsDto } from './dto/tts.dto';

@Controller('ai')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AiController {
  constructor(
    private ai: AiService,
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  /**
   * 25.H.3 / Pass 1: POST /ai/tts — text-to-speech.
   *
   * Pass 1 added the optional `language: 'en' | 'uz'` field so the same
   * endpoint serves listening / spelling exercises (en-US-JennyNeural) and
   * Uzbek vocabulary playback (uz-UZ-MadinaNeural). Older callers that
   * only send `{ text, voice? }` keep working — language defaults to 'en'.
   *
   * Returns a base64-encoded audio buffer plus mime type. Falls back to
   * a silent empty buffer when AZURE_SPEECH_KEY/REGION are not configured.
   * Frontend usually calls this once per word and caches the result.
   */
  @Post('tts')
  @Roles(UserRole.student, UserRole.tester, UserRole.mentor)
  async tts(@Body() body: TtsDto) {
    return this.ai.tts(
      body.text,
      body.voice ?? 'en-US-JennyNeural',
      body.language,
    );
  }

  /**
   * Pass 1: POST /ai/grade-translation — fuzzy grade for the `translate`
   * exercise type. Returns `{ correct, score 0-100, feedback (Uzbek),
   * accepted_answers? }`. See {@link AiService.gradeTranslation}.
   */
  @Post('grade-translation')
  @Roles(UserRole.student, UserRole.tester, UserRole.mentor)
  gradeTranslation(@Body() body: GradeTranslationDto) {
    return this.ai.gradeTranslation(body);
  }

  /**
   * Pass 1: POST /ai/explain-answer — kid-friendly Uzbek explanation for
   * a wrong answer (feature M, "Tushuntirish" button). Works for any
   * exercise type. See {@link AiService.explainAnswer}.
   */
  @Post('explain-answer')
  @Roles(UserRole.student, UserRole.tester, UserRole.mentor)
  explainAnswer(@Body() body: ExplainAnswerDto) {
    return this.ai.explainAnswer(body);
  }

  /**
   * POST /ai/qa/start — start a tutor QA session.
   * Body: { lessonContext, question? }. Returns { sessionId, firstResponse }.
   * (No persistent session storage yet — sessionId is a UUID echoed back so
   * the frontend can group subsequent answers; tutor history lives in the
   * client until a sessions table is added in a later phase.)
   */
  @Post('qa/start')
  @Roles(UserRole.student)
  async qaStart(
    @Body()
    body: {
      lessonContext: string;
      question?: string;
    },
  ) {
    const sessionId = (globalThis.crypto as Crypto).randomUUID();
    const tutorResponse = body.question
      ? await this.ai.askTutor(body.lessonContext, body.question, [])
      : null;
    return { sessionId, response: tutorResponse };
  }

  /**
   * POST /ai/qa/answer — submit student's answer / next question to QA.
   * Body: { sessionId, lessonContext, question, history }.
   */
  @Post('qa/answer')
  @Roles(UserRole.student)
  qaAnswer(
    @Body()
    body: {
      sessionId: string;
      lessonContext: string;
      question: string;
      history: { role: string; content: string }[];
    },
  ) {
    return this.ai.askTutor(body.lessonContext, body.question, body.history);
  }

  /**
   * POST /ai/speech/assess — score a single-word pronunciation sample (Azure).
   */
  @Post('speech/assess')
  @Roles(UserRole.student)
  speechAssess(@Body() body: { wordEn: string; audioBase64: string }) {
    return this.ai.checkPronunciation(body.wordEn, body.audioBase64);
  }

  /**
   * POST /ai/evaluate — final lesson evaluation (Claude).
   *
   * For role=student, the score returned by the Python service is
   * automatically mapped to today's englishStatus
   * (>=80 yashil, 50–79 sariq, <50 qizil). Testers can pass `studentId`
   * explicitly when probing the endpoint.
   */
  @Post('evaluate')
  @Roles(UserRole.student, UserRole.tester)
  evaluate(
    @Body()
    body: {
      lessonContext: string;
      studentAnswers: { question: string; student_answer: string }[];
      lessonId?: string;
      studentId?: string;
    },
    @Request() req: any,
  ) {
    const studentId =
      req.user.role === UserRole.student ? req.user.userId : body.studentId;
    return this.ai.evaluate(
      body.lessonContext,
      body.studentAnswers,
      studentId,
      body.lessonId,
    );
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
  @Roles(UserRole.student, UserRole.tester)
  getDailyReview(@Request() req: any) {
    return this.ai.getDailyReview(req.user.userId);
  }

  @Post('record-error')
  @Roles(UserRole.student)
  async recordError(
    @Body() body: { lessonId: string; question: string },
    @Request() req: any,
  ) {
    const result = await this.ai.recordError(
      req.user.userId,
      body.lessonId,
      body.question,
    );

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
          await this.notifications
            .send(
              mentor.id,
              'error_pattern',
              "O'quvchi xatosi",
              `${student.name} "${body.question}" savolida 3 marta xato qildi`,
            )
            .catch(() => {});
        }
      }
      await this.prisma.errorLog.update({
        where: {
          studentId_lessonId_question: {
            studentId: req.user.userId,
            lessonId: body.lessonId,
            question: body.question,
          },
        },
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
