import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Context } from 'grammy';

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

      const s = (v: string | null | undefined) =>
        v === 'green' ? '🟢' : v === 'yellow' ? '🟡' : '🔴';

      await ctx.reply(
        [
          `📊 Farzand: ${child.name}`,
          `Ingliz: ${s(status?.englishStatus)} ${status?.englishStatus ?? 'nomalum'}`,
          `Shaxsiy: ${s(status?.personalStatus)} ${status?.personalStatus ?? 'nomalum'}`,
          `Tanqidiy: ${s(status?.criticalStatus)} ${status?.criticalStatus ?? 'nomalum'}`,
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

      const xp = await this.prisma.studentXp.findFirst({
        where: { studentId: child.id },
      });

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const lessonsCount = await this.prisma.studentProgress.count({
        where: {
          studentId: child.id,
          academyCompleted: true,
          completedAt: { gte: startOfMonth },
        },
      });

      await ctx.reply(
        [
          `📈 Farzand: ${child.name}`,
          `🏅 XP: ${xp?.totalXp ?? 0}`,
          `🔥 Streak: ${xp?.currentStreak ?? 0} kun`,
          `📚 Bu oy: ${lessonsCount} dars`,
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
