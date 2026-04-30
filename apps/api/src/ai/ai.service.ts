import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
import Anthropic from '@anthropic-ai/sdk';
import { StatusService } from '../student-status/status.service';
import { StatusColor } from '../student-status/status.types';

@Injectable()
export class AiService {
  private readonly aiServiceUrl: string;
  private anthropic: Anthropic;
  private readonly logger = new Logger(AiService.name);

  constructor(
    private http: HttpService,
    private config: ConfigService,
    private prisma: PrismaService,
    private statusService: StatusService,
  ) {
    this.aiServiceUrl = this.config.get(
      'AI_SERVICE_URL',
      'http://localhost:8000',
    );
    this.anthropic = new Anthropic({
      apiKey: this.config.get('ANTHROPIC_API_KEY', ''),
    });
  }

  async askTutor(
    lessonContext: string,
    question: string,
    history: { role: string; content: string }[],
  ) {
    try {
      const res = await firstValueFrom(
        this.http.post(`${this.aiServiceUrl}/ai/tutor/ask`, {
          lesson_context: lessonContext,
          question,
          conversation_history: history,
        }),
      );
      return res.data;
    } catch {
      throw new ServiceUnavailableException('AI servis vaqtincha ishlamayapti');
    }
  }

  /**
   * Score a student's lesson answers via the Python evaluation service
   * (Claude under the hood). When `studentId` is provided, the resulting
   * score is also mapped to a {@link StatusColor} and persisted onto
   * today's `englishStatus` slot via {@link StatusService.setEnglishStatus}.
   *
   * Score → colour mapping (spec):
   *   ≥ 80 → yashil, 50–79 → sariq, < 50 → qizil
   */
  async evaluate(
    lessonContext: string,
    studentAnswers: { question: string; student_answer: string }[],
    studentId?: string,
    lessonId?: string,
  ) {
    let data: { score?: number } & Record<string, unknown>;
    try {
      const res = await firstValueFrom(
        this.http.post(`${this.aiServiceUrl}/ai/evaluate/`, {
          lesson_context: lessonContext,
          student_answers: studentAnswers,
        }),
      );
      data = res.data;
    } catch {
      throw new ServiceUnavailableException(
        'Baholash servisi vaqtincha ishlamayapti',
      );
    }

    // Persist Uzbek-canonical englishStatus when caller gave us a student.
    if (studentId && typeof data?.score === 'number') {
      const color = AiService.scoreToStatusColor(data.score);
      try {
        await this.statusService.setEnglishStatus(studentId, color, {
          source: 'ai_evaluation',
          lessonId,
          score: data.score,
        });
      } catch (err) {
        // Status update is best-effort; never fail the evaluation
        // response on a downstream notification glitch.
        this.logger.warn(
          `setEnglishStatus failed for student ${studentId}: ${(err as Error).message}`,
        );
      }
    }

    return data;
  }

  /** ≥80 yashil, 50-79 sariq, <50 qizil. */
  static scoreToStatusColor(score: number): StatusColor {
    if (score >= 80) return 'yashil';
    if (score >= 50) return 'sariq';
    return 'qizil';
  }

  async checkPronunciation(wordEn: string, audioBase64: string) {
    try {
      const res = await firstValueFrom(
        this.http.post(`${this.aiServiceUrl}/ai/speech/check`, {
          word_en: wordEn,
          audio_base64: audioBase64,
        }),
      );
      return res.data;
    } catch {
      return {
        is_correct: true,
        accuracy_score: 100,
        feedback: 'Fallback mode',
      };
    }
  }

  private sm2(
    quality: number,
    easeFactor: number,
    interval: number,
    repetitions: number,
  ) {
    if (quality < 3) {
      return { interval: 1, easeFactor, repetitions: 0 };
    }
    const newEf = Math.max(
      1.3,
      easeFactor + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02),
    );
    let newInterval: number;
    if (repetitions === 0) newInterval = 1;
    else if (repetitions === 1) newInterval = 6;
    else newInterval = Math.round(interval * newEf);
    return {
      interval: newInterval,
      easeFactor: newEf,
      repetitions: repetitions + 1,
    };
  }

  async recordSpacedAnswer(studentId: string, word: string, correct: boolean) {
    const quality = correct ? 4 : 1;

    const existing = await this.prisma.spacedRepetitionItem.findUnique({
      where: { studentId_word: { studentId, word } },
    });

    const { interval, easeFactor, repetitions } = this.sm2(
      quality,
      existing?.easeFactor ?? 2.5,
      existing?.interval ?? 1,
      existing?.repetitions ?? 0,
    );

    const nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + interval);

    await this.prisma.spacedRepetitionItem.upsert({
      where: { studentId_word: { studentId, word } },
      update: { easeFactor, interval, repetitions, nextReview },
      create: {
        studentId,
        word,
        easeFactor,
        interval,
        repetitions,
        nextReview,
      },
    });

    return { word, nextReview, interval };
  }

  async getDailyReview(studentId: string) {
    const now = new Date();
    const items = await this.prisma.spacedRepetitionItem.findMany({
      where: { studentId, nextReview: { lte: now } },
      orderBy: { nextReview: 'asc' },
      take: 20,
      select: { word: true, easeFactor: true, interval: true },
    });
    return items;
  }

  async recordError(studentId: string, lessonId: string, question: string) {
    const updated = await this.prisma.errorLog.upsert({
      where: { studentId_lessonId_question: { studentId, lessonId, question } },
      update: { errorCount: { increment: 1 }, lastError: new Date() },
      create: { studentId, lessonId, question, errorCount: 1 },
    });
    return updated;
  }

  async analyzeErrors(
    studentId: string,
  ): Promise<{ weakAreas: string[]; recommendation: string }> {
    const errors = await this.prisma.errorLog.findMany({
      where: { studentId, errorCount: { gte: 2 } },
      orderBy: { errorCount: 'desc' },
      take: 10,
      select: { question: true, errorCount: true },
    });

    if (errors.length === 0) {
      return { weakAreas: [], recommendation: "Hozircha xatolar yo'q." };
    }

    const errorList = errors
      .map((e) => `"${e.question}" (${e.errorCount} marta xato)`)
      .join('\n');

    const message = await this.anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [
        {
          role: 'user',
          content:
            `O'quvchining quyidagi savollarda xatolari bor:\n${errorList}\n\n` +
            `Qisqa tahlil qil: 1) Zaif tomonlari (3 ta kalit so'z bilan), 2) Bitta tavsiya. ` +
            `Javobni JSON formatida ber: {"weakAreas": ["...", "..."], "recommendation": "..."}`,
        },
      ],
    });

    try {
      const text =
        message.content[0].type === 'text' ? message.content[0].text : '{}';
      const parsed = JSON.parse(text) as {
        weakAreas: string[];
        recommendation: string;
      };
      return parsed;
    } catch {
      return {
        weakAreas: ['Grammatika', "Lug'at"],
        recommendation: "Qayta ko'rib chiqing.",
      };
    }
  }
}
