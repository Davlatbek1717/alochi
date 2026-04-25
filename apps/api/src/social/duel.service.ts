import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { XpService } from '../gamification/xp.service';
import { FeedEventService } from './feed-event.service';

@Injectable()
export class DuelService {
  constructor(
    private prisma: PrismaService,
    private xp: XpService,
    private feedEvent: FeedEventService,
  ) {}

  async create(challengerId: string, challengedId: string, tenantId: string) {
    const active = await this.prisma.duel.count({
      where: {
        status: 'active',
        OR: [{ challengerId }, { challengedId: challengerId }],
      },
    });
    if (active >= 2) {
      throw new BadRequestException('Bir vaqtda faqat 2 ta faol duel bo\'lishi mumkin');
    }

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
      throw new BadRequestException('Umumiy bajarilgan dars topilmadi — duel uchun kamida 1 ta kerak');
    }

    const components = await this.prisma.lessonComponent.findMany({
      where: { type: 'mcq', lessonId: { in: sharedIds } },
    });

    const allQuestions = components.flatMap((c) => {
      const cfg = c.config as { questions?: unknown[] };
      return cfg.questions ?? [];
    });

    if (allQuestions.length < 10) {
      throw new BadRequestException('Duel uchun yetarli savol topilmadi (kamida 10 ta kerak)');
    }

    const selectedQuestions = ([...allQuestions].sort(() => Math.random() - 0.5).slice(0, 10)) as object[];

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    return this.prisma.duel.create({
      data: {
        challengerId,
        challengedId,
        tenantId,
        questions: selectedQuestions,
        status: 'pending',
        expiresAt,
      },
    });
  }

  async respond(duelId: string, userId: string, accept: boolean) {
    const duel = await this.prisma.duel.findUnique({ where: { id: duelId } });
    if (!duel) throw new NotFoundException('Duel topilmadi');
    if (duel.challengedId !== userId) throw new ForbiddenException('Ruxsat yo\'q');
    if (duel.status !== 'pending') throw new BadRequestException('Duel allaqachon boshlangan yoki rad etilgan');

    return this.prisma.duel.update({
      where: { id: duelId },
      data: { status: accept ? 'active' : 'rejected' },
    });
  }

  async submitAnswer(duelId: string, userId: string, questionIdx: number, answer: number) {
    const duel = await this.prisma.duel.findUnique({ where: { id: duelId } });
    if (!duel) throw new BadRequestException('Duel topilmadi');
    if (duel.status !== 'active') throw new BadRequestException('Duel faol emas');
    if (new Date() > duel.expiresAt) throw new BadRequestException('Duel muddati o\'tdi');

    if (userId !== duel.challengerId && userId !== duel.challengedId) {
      throw new ForbiddenException('Ruxsat yo\'q');
    }

    const existing = await this.prisma.duelAnswer.findUnique({
      where: { duelId_userId_questionIdx: { duelId, userId, questionIdx } },
    });
    if (existing) throw new BadRequestException('Bu savol allaqachon javoblangan');

    const questions = duel.questions as Array<{ correct: number }>;
    const question = questions[questionIdx];
    const isCorrect = question != null && answer === question.correct;
    const isChallenger = userId === duel.challengerId;

    await this.prisma.duelAnswer.create({
      data: { duelId, userId, questionIdx, answer, isCorrect },
    });

    if (isCorrect) {
      await this.prisma.duel.update({
        where: { id: duelId },
        data: isChallenger
          ? { challengerScore: { increment: 1 } }
          : { challengedScore: { increment: 1 } },
      });
    }

    const [challengerCount, challengedCount] = await Promise.all([
      this.prisma.duelAnswer.count({ where: { duelId, userId: duel.challengerId } }),
      this.prisma.duelAnswer.count({ where: { duelId, userId: duel.challengedId } }),
    ]);

    if (challengerCount >= 10 && challengedCount >= 10) {
      // Determine winner from current duel state
      const freshDuel = await this.prisma.duel.findUnique({ where: { id: duelId } });
      if (freshDuel && freshDuel.status === 'active') {
        // On tie, challenger wins (first-mover advantage)
        const winnerId =
          freshDuel.challengerScore >= freshDuel.challengedScore
            ? freshDuel.challengerId
            : freshDuel.challengedId;
        const loserId = winnerId === freshDuel.challengerId ? freshDuel.challengedId : freshDuel.challengerId;

        // Atomic update — only the first caller succeeds; subsequent calls get count:0 and skip XP
        const updated = await this.prisma.duel.updateMany({
          where: { id: duelId, status: 'active' },
          data: { status: 'completed', winnerId },
        });

        if (updated.count > 0) {
          await Promise.all([
            this.xp.award(winnerId, 'DUEL_WIN'),
            this.xp.award(loserId, 'DUEL_PARTICIPATE'),
          ]);

          const winner = await this.prisma.user.findUnique({
            where: { id: winnerId },
            select: { tenantId: true },
          });
          if (winner) {
            this.feedEvent
              .emit(winner.tenantId, winnerId, 'duel_won', {
                opponentId: loserId,
                score: `${freshDuel.challengerScore}-${freshDuel.challengedScore}`,
              })
              .catch(() => {});
          }
        }
      }
    }

    return { isCorrect };
  }

  async getDuel(duelId: string, requesterId: string) {
    const duel = await this.prisma.duel.findUnique({
      where: { id: duelId },
      include: {
        challenger: { select: { id: true, name: true } },
        challenged: { select: { id: true, name: true } },
      },
    });
    if (!duel) throw new NotFoundException('Duel topilmadi');

    const myAnswers = await this.prisma.duelAnswer.count({
      where: { duelId, userId: requesterId },
    });

    const winnerName =
      duel.winnerId === duel.challengerId
        ? duel.challenger.name
        : duel.winnerId === duel.challengedId
          ? duel.challenged.name
          : null;

    return {
      ...duel,
      challengerName: duel.challenger.name,
      challengedName: duel.challenged.name,
      currentQuestionIdx: myAnswers,
      winner: winnerName,
    };
  }

  async listDuels(userId: string) {
    const duels = await this.prisma.duel.findMany({
      where: { OR: [{ challengerId: userId }, { challengedId: userId }] },
      include: {
        challenger: { select: { id: true, name: true } },
        challenged: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return duels.map((d) => ({
      ...d,
      challengerName: d.challenger.name,
      challengedName: d.challenged.name,
    }));
  }

  async expireOverdue(): Promise<void> {
    const expired = await this.prisma.duel.findMany({
      where: { status: 'active', expiresAt: { lt: new Date() } },
    });

    if (expired.length > 0) {
      await Promise.all(
        expired.map(async (duel) => {
          const challengedCount = await this.prisma.duelAnswer.count({
            where: { duelId: duel.id, userId: duel.challengedId },
          });
          if (challengedCount === 0) {
            await this.xp.award(duel.challengerId, 'DUEL_PARTICIPATE');
          }
        }),
      );

      await this.prisma.duel.updateMany({
        where: { id: { in: expired.map((d) => d.id) } },
        data: { status: 'expired' },
      });
    }

    await this.prisma.duel.updateMany({
      where: { status: 'pending', expiresAt: { lt: new Date() } },
      data: { status: 'expired' },
    });
  }
}
