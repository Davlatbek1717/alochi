import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Context } from 'grammy';
import { statusEmoji } from '../../student-status/status.types';

@Injectable()
export class ParentHandler {
  constructor(private prisma: PrismaService) {}

  async handleStatus(ctx: Context, telegramId: bigint): Promise<void> {
    try {
      const child = await this.prisma.user.findFirst({
        where: { parentTelegramId: telegramId.toString() },
      });
      if (!child) {
        await ctx.reply("Hisob bog'lanmagan. /start orqali boshlang.");
        return;
      }

      const status = await this.prisma.studentStatus.findFirst({
        where: { studentId: child.id },
        orderBy: { date: 'desc' },
      });

      // statusEmoji handles Uzbek canonical (yashil/sariq/qizil) and
      // returns ⚪ for null/unknown.
      await ctx.reply(
        [
          `📊 Farzand: ${child.name}`,
          `Ingliz: ${statusEmoji(status?.englishStatus)} ${status?.englishStatus ?? 'nomalum'}`,
          `Shaxsiy: ${statusEmoji(status?.personalStatus)} ${status?.personalStatus ?? 'nomalum'}`,
          `Tanqidiy: ${statusEmoji(status?.criticalStatus)} ${status?.criticalStatus ?? 'nomalum'}`,
        ].join('\n'),
      );
    } catch {
      await ctx.reply('Xatolik yuz berdi');
    }
  }

  async handleProgress(ctx: Context, telegramId: bigint): Promise<void> {
    try {
      const child = await this.prisma.user.findFirst({
        where: { parentTelegramId: telegramId.toString() },
      });
      if (!child) {
        await ctx.reply("Hisob bog'lanmagan. /start orqali boshlang.");
        return;
      }

      const streak = await this.prisma.studentStreak.findFirst({
        where: { studentId: child.id },
      });

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const [lessonsCount, totalLessons] = await Promise.all([
        this.prisma.studentProgress.count({
          where: {
            studentId: child.id,
            homeCompleted: true,
            completedAt: { gte: startOfMonth },
          },
        }),
        this.prisma.studentProgress.count({
          where: { studentId: child.id, homeCompleted: true },
        }),
      ]);

      await ctx.reply(
        [
          `📈 Farzand: ${child.name}`,
          `🔥 Streak: ${streak?.currentStreak ?? 0} kun`,
          `📚 Bu oy: ${lessonsCount} dars`,
          `📖 Jami: ${totalLessons} dars tugatildi`,
        ].join('\n'),
      );
    } catch {
      await ctx.reply('Xatolik yuz berdi');
    }
  }

  async handlePayment(ctx: Context, telegramId: bigint): Promise<void> {
    try {
      const child = await this.prisma.user.findFirst({
        where: { parentTelegramId: telegramId.toString() },
      });
      if (!child) {
        await ctx.reply("Hisob bog'lanmagan. /start orqali boshlang.");
        return;
      }

      const payment = await this.prisma.payment.findFirst({
        where: { studentId: child.id },
        orderBy: { paidAt: 'desc' },
      });

      if (payment?.paidAt) {
        await ctx.reply("✅ To'langan");
      } else {
        await ctx.reply("❌ To'lov kutilmoqda");
      }
    } catch {
      await ctx.reply('Xatolik yuz berdi');
    }
  }
}
