import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Context } from 'grammy';

@Injectable()
export class StudentHandler {
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

      const shieldStatus = (xp?.shieldCount ?? 0) > 0 ? 'mavjud' : 'ishlatilgan';

      await ctx.reply(
        [`🔥 Streak: ${xp?.currentStreak ?? 0} kun`, `🛡 Shield: ${shieldStatus}`].join('\n'),
      );
    } catch {
      await ctx.reply('Xatolik yuz berdi');
    }
  }
}
