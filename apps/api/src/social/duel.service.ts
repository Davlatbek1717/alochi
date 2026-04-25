import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DuelService {
  constructor(private prisma: PrismaService) {}

  async create(challengerId: string, challengedId: string, tenantId: string) {
    const [aProgress, bProgress] = await Promise.all([
      this.prisma.studentProgress.findMany({
        where: { studentId: challengerId, academyCompleted: true },
        select: { lessonId: true },
      }),
      this.prisma.studentProgress.findMany({
        where: { studentId: challengedId, academyCompleted: true },
        select: { lessonId: true },
      }),
    ]);

    const aIds = new Set(aProgress.map((p) => p.lessonId));
    const sharedIds = bProgress.map((p) => p.lessonId).filter((id) => aIds.has(id));

    if (sharedIds.length === 0) {
      throw new BadRequestException(
        'umumiy bajarilgan dars topilmadi — duel uchun kamida 1 ta kerak',
      );
    }

    const components = await this.prisma.lessonComponent.findMany({
      where: {
        type: 'mcq',
        lesson: { id: { in: sharedIds } },
      },
    });

    const allQuestions = components.flatMap((c) => (c.config as any).questions ?? []);
    if (allQuestions.length < 10) {
      throw new BadRequestException(
        'Duel uchun yetarli savol topilmadi (kamida 10 ta kerak)',
      );
    }

    const selectedQuestions = allQuestions
      .sort(() => Math.random() - 0.5)
      .slice(0, 10);

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    return this.prisma.duel.create({
      data: {
        challengerId,
        challengedId,
        tenantId,
        questions: selectedQuestions,
        status: 'active',
        expiresAt,
      },
    });
  }

  async submitAnswer(
    duelId: string,
    userId: string,
    questionIdx: number,
    answer: number,
  ) {
    const duel = await this.prisma.duel.findUnique({ where: { id: duelId } });
    if (!duel) throw new BadRequestException('Duel topilmadi');
    if (duel.status !== 'active') throw new BadRequestException('Duel faol emas');
    if (new Date() > duel.expiresAt) throw new BadRequestException("Duel muddati o'tdi");

    const questions = duel.questions as any[];
    const question = questions[questionIdx];
    const isCorrect = question != null && answer === question.correct;

    await this.prisma.duelAnswer.create({
      data: { duelId, userId, questionIdx, answer, isCorrect },
    });

    const isChallenger = userId === duel.challengerId;
    if (isCorrect) {
      await this.prisma.duel.update({
        where: { id: duelId },
        data: isChallenger
          ? { challengerScore: { increment: 1 } }
          : { challengedScore: { increment: 1 } },
      });
    }

    return { isCorrect };
  }

  async getResult(duelId: string) {
    const duel = await this.prisma.duel.findUnique({
      where: { id: duelId },
      include: {
        challenger: { select: { name: true } },
        challenged: { select: { name: true } },
      },
    });

    if (!duel) throw new BadRequestException('Duel topilmadi');

    let winnerId: string | null = null;
    if (duel.status === 'completed' || new Date() > duel.expiresAt) {
      if (duel.challengerScore > duel.challengedScore) {
        winnerId = duel.challengerId;
      } else if (duel.challengedScore > duel.challengerScore) {
        winnerId = duel.challengedId;
      }
    }

    return {
      ...duel,
      winnerId,
      challengerName: duel.challenger.name,
      challengedName: duel.challenged.name,
    };
  }
}
