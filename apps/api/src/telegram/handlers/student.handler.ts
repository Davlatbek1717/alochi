import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Context } from 'grammy';

@Injectable()
export class StudentHandler {
  private readonly logger = new Logger(StudentHandler.name);

  constructor(private prisma: PrismaService) {}

  async handleLesson(ctx: Context, telegramId: bigint): Promise<void> {
    try {
      const student = await this.prisma.user.findFirst({
        where: { telegramId },
      });
      if (!student) {
        await ctx.reply('Profil topilmadi.');
        return;
      }

      const progress = await this.prisma.studentProgress.findFirst({
        where: { studentId: student.id, academyCompleted: false },
        include: { lesson: true },
      });

      if (!progress) {
        await ctx.reply('Hamma darslar bajarildi 🎉');
        return;
      }

      await ctx.reply(`📚 Keyingi dars: ${progress.lesson.title}`);
    } catch {
      await ctx.reply('Xatolik yuz berdi');
    }
  }

  /**
   * /rating — shows the caller's branch rank by completed lessons (home_completed).
   */
  async handleRating(ctx: Context, telegramId: bigint): Promise<void> {
    try {
      const student = await this.prisma.user.findFirst({
        where: { telegramId, role: 'student' },
        select: { id: true, branchId: true },
      });
      if (!student) {
        await ctx.reply(
          '❌ Telegram hisobingiz tizimga ulanmagan. Profilingizdan ulang.',
        );
        return;
      }

      const myCount = await this.prisma.studentProgress.count({
        where: { studentId: student.id, homeCompleted: true },
      });

      const lines: string[] = ["📊 Sizning o'rningiz:"];

      if (student.branchId) {
        const branchPeers = await this.prisma.user.findMany({
          where: {
            branchId: student.branchId,
            role: 'student',
            status: 'active',
          },
          select: { id: true },
        });
        const counts = await Promise.all(
          branchPeers.map((p) =>
            this.prisma.studentProgress
              .count({ where: { studentId: p.id, homeCompleted: true } })
              .then((c) => ({ id: p.id, count: c })),
          ),
        );
        const sorted = counts.sort((a, b) => b.count - a.count);
        const branchRank = sorted.findIndex((p) => p.id === student.id) + 1;
        if (branchRank > 0) {
          lines.push(`• Filialda: ${branchRank}/${sorted.length}`);
        }
      }

      lines.push('');
      lines.push(`📚 Tugatilgan darslar: ${myCount}`);
      await ctx.reply(lines.join('\n'));
    } catch (err) {
      this.logger.error(`/rating handler xatosi: ${err}`);
      await ctx.reply('Xatolik yuz berdi');
    }
  }

  async handleStreak(ctx: Context, telegramId: bigint): Promise<void> {
    try {
      const student = await this.prisma.user.findFirst({
        where: { telegramId },
      });
      if (!student) {
        await ctx.reply('Profil topilmadi.');
        return;
      }

      const streak = await this.prisma.studentStreak.findFirst({
        where: { studentId: student.id },
      });

      const shieldStatus =
        (streak?.shieldCount ?? 0) > 0 ? 'mavjud' : 'ishlatilgan';

      await ctx.reply(
        [
          `🔥 Streak: ${streak?.currentStreak ?? 0} kun`,
          `🛡 Shield: ${shieldStatus}`,
        ].join('\n'),
      );
    } catch {
      await ctx.reply('Xatolik yuz berdi');
    }
  }
}
