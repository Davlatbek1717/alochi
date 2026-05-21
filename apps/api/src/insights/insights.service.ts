import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { chatText } from '../ai/llm-client';

const INSIGHTS_SYSTEM = `Sen A'lojon ta'lim platformasining tahlil yordamchisisan.
Foydalanuvchi savol beradi. Sen ma'lumotlar asosida qisqa, faktik, foydali javob berasan.
Javob 3-5 jumladan oshmasin. O'zbek tilida. Raqamlarga asoslan.`;

type Scope = 'branch' | 'student' | 'lesson';

@Injectable()
export class InsightsService {
  constructor(private prisma: PrismaService) {}

  async query(
    userId: string,
    tenantId: string,
    question: string,
    scope?: Scope,
  ) {
    const start = Date.now();
    const context = await this.gatherContext(tenantId, scope);

    let answer: string;
    try {
      answer = await chatText(
        [
          { role: 'system', content: INSIGHTS_SYSTEM },
          {
            role: 'user',
            content: `Platforma holati:\n${JSON.stringify(context, null, 2)}\n\nSavol: ${question}`,
          },
        ],
        { temperature: 0.4 },
      );
    } catch {
      throw new BadRequestException('AI javob bera olmadi. Keyinroq urinib ko\'ring.');
    }

    const durationMs = Date.now() - start;

    const record = await this.prisma.aiInsightQuery.create({
      data: {
        id: `${userId}:${Date.now()}`,
        userId,
        tenantId,
        question,
        scope: scope ?? null,
        answer,
        dataRefs: context as Prisma.InputJsonValue,
        durationMs,
      },
    });

    return {
      answer,
      durationMs,
      dataRefs: context,
      id: record.id,
    };
  }

  private async gatherContext(
    tenantId: string,
    _scope?: Scope,
  ): Promise<Record<string, unknown>> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [students, activeWarnings, riskDistribution] = await Promise.all([
      this.prisma.user.count({ where: { tenantId, role: 'student', status: 'active' } }),
      this.prisma.warning.count({ where: { tenantId, isCancelled: false } }),
      this.prisma.riskScore.groupBy({
        by: ['band'],
        where: { tenantId, date: todayStart },
        _count: { band: true },
      }),
    ]);

    return {
      tenantId,
      activeStudents: students,
      activeWarnings,
      riskDistribution: Object.fromEntries(
        riskDistribution.map((r) => [r.band, r._count.band]),
      ),
      dataAsOf: new Date().toISOString(),
    };
  }

  async getHistory(userId: string, tenantId: string) {
    return this.prisma.aiInsightQuery.findMany({
      where: { userId, tenantId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, question: true, answer: true, createdAt: true, durationMs: true },
    });
  }

  async rateQuery(id: string, userId: string, rating: number, feedback?: string) {
    return this.prisma.aiInsightQuery.updateMany({
      where: { id, userId },
      data: { rating, feedback },
    });
  }
}
