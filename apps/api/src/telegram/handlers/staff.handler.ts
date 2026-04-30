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

  async handleVazifalar(ctx: Context, telegramId: bigint): Promise<void> {
    try {
      const staff = await this.prisma.user.findFirst({
        where: { telegramId },
        select: { id: true },
      });
      if (!staff) {
        await ctx.reply('Profil topilmadi.');
        return;
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const tasks = await this.prisma.task.findMany({
        where: {
          assignedTo: staff.id,
          status: { not: 'completed' },
          OR: [{ deadline: null }, { deadline: { lt: tomorrow } }],
        },
        orderBy: { deadline: 'asc' },
        take: 10,
        select: { title: true, status: true, deadline: true },
      });

      if (tasks.length === 0) {
        await ctx.reply("✅ Bugun vazifa yo'q");
        return;
      }

      const lines = tasks.map((t, i) => {
        const icon = t.status === 'sent' ? '📋' : '🔄';
        const deadline = t.deadline
          ? ` (${t.deadline.toLocaleDateString('uz-UZ')})`
          : '';
        return `${icon} ${i + 1}. ${t.title}${deadline}`;
      });

      await ctx.reply(`📋 Bugungi vazifalar:\n\n${lines.join('\n')}`);
    } catch {
      await ctx.reply('Xatolik yuz berdi');
    }
  }
}
