import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Context, InlineKeyboard } from 'grammy';

const ATT_STATUS_LABEL: Record<string, string> = {
  present: '✅ Keldi',
  late: '⏰ Kechikdi',
  absent: '❌ Kelmadi',
};

@Injectable()
export class StaffHandler {
  private readonly logger = new Logger(StaffHandler.name);

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

  /**
   * Spec §6.7 — `/davomat` mentor inline-button attendance.
   * The mentor sees a list of their branch students with three quick-mark
   * buttons (✅ keldi / ⏰ kechikdi / ❌ kelmadi). Each button triggers
   * `handleAttendanceCallback` which upserts an attendance row for today.
   *
   * NOTE: until `User.groupId` lands, mentors mark attendance for all
   * active students in their branch.
   */
  async handleDavomat(ctx: Context, telegramId: bigint): Promise<void> {
    try {
      const mentor = await this.prisma.user.findFirst({
        where: { telegramId, role: 'mentor' },
        select: { id: true, branchId: true, tenantId: true },
      });
      if (!mentor) {
        await ctx.reply('❌ Faqat mentorlar uchun.');
        return;
      }
      if (!mentor.branchId) {
        await ctx.reply('❌ Filial topilmadi.');
        return;
      }

      const students = await this.prisma.user.findMany({
        where: {
          tenantId: mentor.tenantId,
          branchId: mentor.branchId,
          role: 'student',
          status: 'active',
        },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
        take: 30,
      });

      if (students.length === 0) {
        await ctx.reply("Filial uchun o'quvchilar topilmadi.");
        return;
      }

      await ctx.reply("📋 Bugungi davomat:\n\nHar bir o'quvchini belgilang.");

      for (const s of students) {
        const kb = new InlineKeyboard()
          .text('✅', `att:${s.id}:present`)
          .text('⏰', `att:${s.id}:late`)
          .text('❌', `att:${s.id}:absent`);
        await ctx.reply(s.name, { reply_markup: kb });
      }
    } catch (err) {
      this.logger.error(`/davomat handler xatosi: ${err}`);
      await ctx.reply('Xatolik yuz berdi');
    }
  }

  async handleAttendanceCallback(
    ctx: Context,
    telegramId: bigint,
  ): Promise<void> {
    try {
      const data = ctx.callbackQuery?.data ?? '';
      const m = /^att:([^:]+):(present|late|absent)$/.exec(data);
      if (!m) {
        await ctx.answerCallbackQuery({ text: "Noto'g'ri format" });
        return;
      }
      const [, studentId, status] = m;

      const mentor = await this.prisma.user.findFirst({
        where: { telegramId, role: 'mentor' },
        select: {
          id: true,
          branchId: true,
          tenantId: true,
        },
      });
      if (!mentor) {
        await ctx.answerCallbackQuery({ text: 'Ruxsat yoʼq' });
        return;
      }

      const student = await this.prisma.user.findFirst({
        where: {
          id: studentId,
          role: 'student',
          tenantId: mentor.tenantId,
          ...(mentor.branchId ? { branchId: mentor.branchId } : {}),
        },
        select: { id: true, name: true, branchId: true, tenantId: true },
      });
      if (!student || !student.branchId) {
        await ctx.answerCallbackQuery({ text: 'Talaba topilmadi' });
        return;
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      await this.prisma.attendanceStudent.upsert({
        where: { studentId_date: { studentId: student.id, date: today } },
        create: {
          tenantId: student.tenantId,
          branchId: student.branchId,
          studentId: student.id,
          date: today,
          status,
          markedBy: mentor.id,
        },
        update: {
          status,
          markedBy: mentor.id,
        },
      });

      const newText = `${student.name} — ${ATT_STATUS_LABEL[status]}`;
      try {
        await ctx.editMessageText(newText);
      } catch {
        // Message may already be edited — fall back to reply.
        await ctx.reply(newText);
      }
      await ctx.answerCallbackQuery({ text: ATT_STATUS_LABEL[status] });
    } catch (err) {
      this.logger.error(`davomat callback xatosi: ${err}`);
      try {
        await ctx.answerCallbackQuery({ text: 'Xatolik yuz berdi' });
      } catch {
        // ignore answerCallbackQuery failure
      }
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
          status: { not: 'confirmed' },
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
