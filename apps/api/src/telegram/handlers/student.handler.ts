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

  async handleXp(ctx: Context, telegramId: bigint): Promise<void> {
    try {
      const student = await this.prisma.user.findFirst({
        where: { telegramId },
      });
      if (!student) {
        await ctx.reply('Profil topilmadi.');
        return;
      }

      const xp = await this.prisma.studentXp.findFirst({
        where: { studentId: student.id },
      });

      const totalXp = xp?.totalXp ?? 0;
      const level = Math.floor(totalXp / 100);

      await ctx.reply([`🏅 XP: ${totalXp}`, `📊 Daraja: ${level}`].join('\n'));
    } catch {
      await ctx.reply('Xatolik yuz berdi');
    }
  }

  /**
   * Spec §6.6 — `/rating` bot command. Computes the caller's rank within
   * their branch by total XP. Group-level ranking is deferred until the
   * `User.groupId` field lands (Phase 7+).
   */
  async handleRating(ctx: Context, telegramId: bigint): Promise<void> {
    try {
      const student = await this.prisma.user.findFirst({
        where: { telegramId, role: 'student' },
        select: {
          id: true,
          branchId: true,
          tenantId: true,
        },
      });
      if (!student) {
        await ctx.reply(
          '❌ Telegram hisobingiz tizimga ulanmagan. Profilingizdan ulang.',
        );
        return;
      }

      const myXp = await this.prisma.studentXp.findUnique({
        where: { studentId: student.id },
        select: { totalXp: true },
      });
      const myTotal = myXp?.totalXp ?? 0;

      // Branch ranking by total XP. We compute over the StudentXp table
      // joined to active branch students; a tie on XP keeps insertion order.
      const lines: string[] = ["📊 Sizning o'rningiz:"];

      if (student.branchId) {
        const branchPeers = await this.prisma.user.findMany({
          where: {
            branchId: student.branchId,
            role: 'student',
            status: 'active',
          },
          select: { id: true, studentXp: { select: { totalXp: true } } },
        });
        const sorted = branchPeers
          .map((p) => ({ id: p.id, xp: p.studentXp?.totalXp ?? 0 }))
          .sort((a, b) => b.xp - a.xp);
        const branchSize = sorted.length;
        const branchRank = sorted.findIndex((p) => p.id === student.id) + 1;
        if (branchRank > 0) {
          lines.push(`• Filialda: ${branchRank}/${branchSize}`);
        }
      }

      lines.push('');
      lines.push(`💪 XP: ${myTotal}`);
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

      const xp = await this.prisma.studentXp.findFirst({
        where: { studentId: student.id },
      });

      const shieldStatus =
        (xp?.shieldCount ?? 0) > 0 ? 'mavjud' : 'ishlatilgan';

      await ctx.reply(
        [
          `🔥 Streak: ${xp?.currentStreak ?? 0} kun`,
          `🛡 Shield: ${shieldStatus}`,
        ].join('\n'),
      );
    } catch {
      await ctx.reply('Xatolik yuz berdi');
    }
  }
}
