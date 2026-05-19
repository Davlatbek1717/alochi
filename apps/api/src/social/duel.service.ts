import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  forwardRef,
  Inject,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FeedEventService } from './feed-event.service';
import { SocialGateway } from './social.gateway';

@Injectable()
export class DuelService {
  constructor(
    private prisma: PrismaService,
    private feedEvent: FeedEventService,
    @Inject(forwardRef(() => SocialGateway)) private gateway: SocialGateway,
  ) {}

  async create(challengerId: string, challengedId: string, tenantId: string) {
    const active = await this.prisma.duel.count({
      where: {
        status: 'active',
        OR: [{ challengerId }, { challengedId: challengerId }],
      },
    });
    if (active >= 2) {
      throw new BadRequestException(
        "Bir vaqtda faqat 2 ta faol duel bo'lishi mumkin",
      );
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
    const sharedIds = bProgress
      .map((p) => p.lessonId)
      .filter((id) => aIds.has(id));

    if (sharedIds.length === 0) {
      throw new BadRequestException(
        'Umumiy bajarilgan dars topilmadi — duel uchun kamida 1 ta kerak',
      );
    }

    const components = await this.prisma.lessonComponent.findMany({
      where: { type: 'mcq', lessonId: { in: sharedIds } },
    });

    const allQuestions = components.flatMap((c) =>
      this.normalizeMcq(c.config),
    );

    if (allQuestions.length < 10) {
      throw new BadRequestException(
        'Duel uchun yetarli savol topilmadi (kamida 10 ta kerak)',
      );
    }

    const selectedQuestions = [...allQuestions]
      .sort(() => Math.random() - 0.5)
      .slice(0, 10);

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    const duel = await this.prisma.duel.create({
      data: {
        challengerId,
        challengedId,
        tenantId,
        questions: selectedQuestions,
        status: 'pending',
        expiresAt,
      },
    });

    const challenger = await this.prisma.user.findUnique({
      where: { id: challengerId },
      select: { name: true },
    });
    this.gateway.emitDuelChallenge(
      challengedId,
      duel.id,
      challenger?.name ?? '',
    );

    return duel;
  }

  /**
   * MCQ components are authored in two shapes across the codebase:
   *   - aggregate (curriculum seed + legacy aggregate POST):
   *       { questions: [{ text, options, correct }] }
   *   - flat (generic POST + superadmin UI lesson editor):
   *       { question, options, correctIndex }
   * The duel runner renders `{ text, options }` and scoring reads
   * `.correct`. create() previously only read the aggregate shape, so
   * duels built from UI-authored lessons collected zero questions and
   * either failed to start or showed blank questions. Normalize both
   * shapes here — mirrors the exam runner's extractor.
   */
  private normalizeMcq(
    config: unknown,
  ): Array<{ text: string; options: string[]; correct: number }> {
    const cfg = config as {
      questions?: Array<{
        text?: string;
        options?: string[];
        correct?: number;
      }>;
      question?: string;
      options?: string[];
      correctIndex?: number;
    };
    const out: Array<{ text: string; options: string[]; correct: number }> = [];
    if (Array.isArray(cfg?.questions) && cfg.questions.length > 0) {
      for (const q of cfg.questions) {
        if (q?.text && Array.isArray(q.options) && q.options.length >= 2) {
          out.push({
            text: q.text,
            options: q.options,
            correct: typeof q.correct === 'number' ? q.correct : 0,
          });
        }
      }
    } else if (
      cfg?.question &&
      Array.isArray(cfg.options) &&
      cfg.options.length >= 2
    ) {
      out.push({
        text: cfg.question,
        options: cfg.options,
        correct: typeof cfg.correctIndex === 'number' ? cfg.correctIndex : 0,
      });
    }
    return out;
  }

  async respond(duelId: string, userId: string, accept: boolean) {
    const duel = await this.prisma.duel.findUnique({ where: { id: duelId } });
    if (!duel) throw new NotFoundException('Duel topilmadi');
    if (duel.challengedId !== userId)
      throw new ForbiddenException("Ruxsat yo'q");
    if (duel.status !== 'pending')
      throw new BadRequestException(
        'Duel allaqachon boshlangan yoki rad etilgan',
      );

    return this.prisma.duel.update({
      where: { id: duelId },
      data: { status: accept ? 'active' : 'rejected' },
    });
  }

  async submitAnswer(
    duelId: string,
    userId: string,
    questionIdx: number,
    answer: number,
    answerMs?: number,
  ) {
    const duel = await this.prisma.duel.findUnique({ where: { id: duelId } });
    if (!duel) throw new BadRequestException('Duel topilmadi');
    if (duel.status !== 'active')
      throw new BadRequestException('Duel faol emas');
    if (new Date() > duel.expiresAt)
      throw new BadRequestException("Duel muddati o'tdi");

    if (userId !== duel.challengerId && userId !== duel.challengedId) {
      throw new ForbiddenException("Ruxsat yo'q");
    }

    const existing = await this.prisma.duelAnswer.findUnique({
      where: { duelId_userId_questionIdx: { duelId, userId, questionIdx } },
    });
    if (existing)
      throw new BadRequestException('Bu savol allaqachon javoblangan');

    const questions = duel.questions as Array<{ correct: number }>;
    if (questionIdx < 0 || questionIdx >= questions.length) {
      throw new BadRequestException("Savol indeksi noto'g'ri");
    }
    const question = questions[questionIdx];
    const isCorrect = question != null && answer === question.correct;
    const isChallenger = userId === duel.challengerId;

    await this.prisma.duelAnswer.create({
      data: {
        duelId,
        userId,
        questionIdx,
        answer,
        isCorrect,
        answerMs: answerMs != null && answerMs >= 0 ? answerMs : null,
      },
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
      this.prisma.duelAnswer.count({
        where: { duelId, userId: duel.challengerId },
      }),
      this.prisma.duelAnswer.count({
        where: { duelId, userId: duel.challengedId },
      }),
    ]);

    if (challengerCount >= 10 && challengedCount >= 10) {
      // Atomic status transition — only first concurrent caller gets count > 0
      const updated = await this.prisma.duel.updateMany({
        where: { id: duelId, status: 'active' },
        data: { status: 'completed' },
      });

      if (updated.count > 0) {
        // Re-read scores after all increments are committed to determine correct winner
        const freshDuel = await this.prisma.duel.findUnique({
          where: { id: duelId },
        });
        if (freshDuel) {
          // Compute speed bonus per side: avg of max(0, 5000 - answerMs) / 100
          const allAnswers = await this.prisma.duelAnswer.findMany({
            where: { duelId },
            select: { userId: true, answerMs: true, isCorrect: true },
          });
          const speedBonus = (uid: string): number => {
            const rows = allAnswers.filter(
              (a) => a.userId === uid && a.answerMs != null,
            );
            if (rows.length === 0) return 0;
            const sum = rows.reduce(
              (s, r) => s + Math.max(0, 5000 - (r.answerMs ?? 5000)) / 100,
              0,
            );
            return Math.round(sum / rows.length);
          };
          const challengerSpeed = speedBonus(freshDuel.challengerId);
          const challengedSpeed = speedBonus(freshDuel.challengedId);
          const challengerFinal =
            freshDuel.challengerScore * 10 + challengerSpeed;
          const challengedFinal =
            freshDuel.challengedScore * 10 + challengedSpeed;

          // Final winner: highest combined score, ties → challenger.
          const winnerId =
            challengerFinal >= challengedFinal
              ? freshDuel.challengerId
              : freshDuel.challengedId;
          const loserId =
            winnerId === freshDuel.challengerId
              ? freshDuel.challengedId
              : freshDuel.challengerId;

          await this.prisma.duel.update({
            where: { id: duelId },
            data: { winnerId },
          });

          const score = `${challengerFinal}-${challengedFinal}`;

          this.gateway.emitDuelResult(winnerId, {
            won: true,
            score,
          });
          this.gateway.emitDuelResult(loserId, {
            won: false,
            score,
          });

          const winner = await this.prisma.user.findUnique({
            where: { id: winnerId },
            select: { tenantId: true },
          });
          if (winner) {
            this.feedEvent
              .emit(winner.tenantId, winnerId, 'duel_won', {
                opponentId: loserId,
                score,
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
    if (
      duel.challengerId !== requesterId &&
      duel.challengedId !== requesterId
    ) {
      throw new ForbiddenException("Ruxsat yo'q");
    }

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

  /**
   * Recent COMPLETED duels among the caller's accepted friends — so a
   * student can see how their friends did. Bidirectional friendship
   * lookup (same pattern as the social feed). The caller's own duels
   * are excluded (they already have /social/duels for that).
   */
  async listFriendsDuels(userId: string) {
    const friendships = await this.prisma.friendship.findMany({
      where: {
        status: 'accepted',
        OR: [{ userId }, { friendId: userId }],
      },
      select: { userId: true, friendId: true },
    });
    if (friendships.length === 0) return [];

    const friendIds = Array.from(
      new Set(
        friendships.map((f) =>
          f.userId === userId ? f.friendId : f.userId,
        ),
      ),
    );

    const duels = await this.prisma.duel.findMany({
      where: {
        status: 'completed',
        OR: [
          { challengerId: { in: friendIds } },
          { challengedId: { in: friendIds } },
        ],
        // Exclude duels the caller was part of — those are their own.
        NOT: [{ challengerId: userId }, { challengedId: userId }],
      },
      include: {
        challenger: { select: { id: true, name: true } },
        challenged: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });

    return duels.map((d) => {
      const winnerName =
        d.winnerId === d.challengerId
          ? d.challenger.name
          : d.winnerId === d.challengedId
            ? d.challenged.name
            : null;
      return {
        id: d.id,
        challengerId: d.challengerId,
        challengedId: d.challengedId,
        challengerName: d.challenger.name,
        challengedName: d.challenged.name,
        challengerScore: d.challengerScore,
        challengedScore: d.challengedScore,
        winnerId: d.winnerId,
        winner: winnerName,
        createdAt: d.createdAt,
      };
    });
  }

  async expireOverdue(): Promise<void> {
    const now = new Date();

    const expiredActive = await this.prisma.duel.findMany({
      where: { status: 'active', expiresAt: { lt: now } },
      select: { id: true, challengerId: true, challengedId: true },
    });

    if (expiredActive.length > 0) {
      // Flip status first — prevents double XP if cron overlaps
      await this.prisma.duel.updateMany({
        where: { id: { in: expiredActive.map((d) => d.id) } },
        data: { status: 'expired' },
      });

      // No XP awards — just expire the duels.
    }

    // Pending duels past expiresAt — just expire (no XP rewards).
    const cutoff24h = new Date(now.getTime() - 24 * 3_600_000);
    const noShowDuels = await this.prisma.duel.findMany({
      where: {
        status: 'pending',
        expiresAt: { lt: now },
        createdAt: { lt: cutoff24h },
      },
      select: { id: true },
    });

    if (noShowDuels.length > 0) {
      await this.prisma.duel.updateMany({
        where: { id: { in: noShowDuels.map((d) => d.id) } },
        data: { status: 'expired' },
      });
    }

    // Any other lingering pending duels past their expiresAt — just expire.
    await this.prisma.duel.updateMany({
      where: { status: 'pending', expiresAt: { lt: now } },
      data: { status: 'expired' },
    });
  }
}
