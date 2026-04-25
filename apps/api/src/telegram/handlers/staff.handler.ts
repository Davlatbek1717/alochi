import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Context } from 'grammy';

@Injectable()
export class StaffHandler {
  constructor(private prisma: PrismaService) {}

  async handleAttendance(ctx: Context, telegramId: bigint): Promise<void> {
    try {
      const staff = await this.prisma.user.findFirst({
        where: { telegramId },
      });
      if (!staff) {
        await ctx.reply('Profil topilmadi.');
        return;
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const record = await this.prisma.attendanceStaff.findFirst({
        where: { userId: staff.id, date: today },
      });

      if (record?.loginTime) {
        const time = record.loginTime.toLocaleTimeString('uz-UZ', {
          hour: '2-digit',
          minute: '2-digit',
        });
        await ctx.reply(`✅ Belgilangan: ${time}`);
      } else {
        await ctx.reply('❌ Bugun belgilanmagan');
      }
    } catch {
      await ctx.reply('Xatolik yuz berdi');
    }
  }

  async handleKpi(ctx: Context, telegramId: bigint): Promise<void> {
    try {
      const staff = await this.prisma.user.findFirst({
        where: { telegramId },
      });
      if (!staff) {
        await ctx.reply('Profil topilmadi.');
        return;
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const scores = await this.prisma.kpiScore.findMany({
        where: { userId: staff.id, date: today },
      });

      if (scores.length === 0) {
        await ctx.reply('📊 Bugun KPI berilmagan');
        return;
      }

      const total = scores.reduce((sum, s) => sum + s.score, 0);
      await ctx.reply(`📊 Bugungi KPI: ${total} ball`);
    } catch {
      await ctx.reply('Xatolik yuz berdi');
    }
  }
}
