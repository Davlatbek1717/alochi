import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Bot } from 'grammy';
import { ParentHandler } from './handlers/parent.handler';
import { StudentHandler } from './handlers/student.handler';
import { StaffHandler } from './handlers/staff.handler';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TelegramService implements OnModuleInit, OnModuleDestroy {
  private bot: Bot | null = null;
  private readonly logger = new Logger(TelegramService.name);

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
    private parentHandler: ParentHandler,
    private studentHandler: StudentHandler,
    private staffHandler: StaffHandler,
  ) {}

  async onModuleInit() {
    const token = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    if (!token) {
      this.logger.warn("TELEGRAM_BOT_TOKEN yo'q — bot ishga tushmadi (Faza 1 da ixtiyoriy)");
      return;
    }

    this.bot = new Bot(token);
    this.setupHandlers();

    if (this.config.get('NODE_ENV') === 'production') {
      const webhookUrl = this.config.get<string>('TELEGRAM_WEBHOOK_URL');
      if (webhookUrl) {
        await this.bot.api.setWebhook(webhookUrl);
        this.logger.log(`Telegram webhook: ${webhookUrl}`);
      }
    } else {
      this.bot.start().catch((err) => this.logger.error(err));
      this.logger.log('Telegram bot long polling ishga tushdi');
    }
  }

  private setupHandlers() {
    if (!this.bot) return;

    this.bot.command('start', async (ctx) => {
      const payload = ctx.match?.trim();
      const telegramId = ctx.from?.id;

      if (payload && payload.includes(':') && telegramId) {
        const [tenantId, studentId] = payload.split(':');
        try {
          const student = await this.prisma.user.findFirst({
            where: { id: studentId, tenantId, role: 'student' },
            select: { id: true, name: true },
          });
          if (student) {
            await this.prisma.user.update({
              where: { id: studentId },
              data: { parentTelegramId: String(telegramId) },
            });
            await ctx.reply(
              `✅ Muvaffaqiyatli bog'landi!\nFarzand: ${student.name}\n\n` +
              `/status — bugungi holat\n/progress — oylik progress\n/payment — to'lov holati`,
            );
            return;
          }
        } catch (err) {
          this.logger.error(`Telegram parent link: ${err}`);
        }
        await ctx.reply("Havola topilmadi yoki eskirgan.");
      } else {
        await ctx.reply(
          "A'lochi platformasiga xush kelibsiz! 🎓\n\nFarzandingizni bog'lash uchun uning profilidan havolani bosing.",
        );
      }
    });

    this.bot.command('bugun', async (ctx) => {
      await ctx.reply("📚 Bugungi darslar: (profil bog'langandan so'ng ko'rsatiladi)");
    });

    this.bot.command('statistika', async (ctx) => {
      await ctx.reply("📊 Statistika: (profil bog'langandan so'ng ko'rsatiladi)");
    });

    this.bot.command('status', async (ctx) => {
      const telegramId = BigInt(ctx.from?.id ?? 0);
      await this.parentHandler.handleStatus(ctx, telegramId);
    });

    this.bot.command('progress', async (ctx) => {
      const telegramId = BigInt(ctx.from?.id ?? 0);
      await this.parentHandler.handleProgress(ctx, telegramId);
    });

    this.bot.command('payment', async (ctx) => {
      const telegramId = BigInt(ctx.from?.id ?? 0);
      await this.parentHandler.handlePayment(ctx, telegramId);
    });

    this.bot.command('lesson', async (ctx) => {
      const telegramId = BigInt(ctx.from?.id ?? 0);
      await this.studentHandler.handleLesson(ctx, telegramId);
    });

    this.bot.command('xp', async (ctx) => {
      const telegramId = BigInt(ctx.from?.id ?? 0);
      await this.studentHandler.handleXp(ctx, telegramId);
    });

    this.bot.command('streak', async (ctx) => {
      const telegramId = BigInt(ctx.from?.id ?? 0);
      await this.studentHandler.handleStreak(ctx, telegramId);
    });

    this.bot.command('attendance', async (ctx) => {
      const telegramId = BigInt(ctx.from?.id ?? 0);
      await this.staffHandler.handleAttendance(ctx, telegramId);
    });

    this.bot.command('kpi', async (ctx) => {
      const telegramId = BigInt(ctx.from?.id ?? 0);
      await this.staffHandler.handleKpi(ctx, telegramId);
    });

    this.bot.command('vazifalar', async (ctx) => {
      const telegramId = BigInt(ctx.from?.id ?? 0);
      await this.staffHandler.handleVazifalar(ctx, telegramId);
    });
  }

  async onModuleDestroy() {
    if (this.bot) {
      await this.bot.stop();
    }
  }

  async sendMessage(telegramId: string | bigint, text: string) {
    if (!this.bot) return;

    try {
      await this.bot.api.sendMessage(telegramId.toString(), text, {
        parse_mode: 'HTML',
      });
    } catch (err) {
      this.logger.warn(`Telegram xabar yuborib bo'lmadi (${telegramId}): ${err}`);
    }
  }

  formatDailyReport(data: {
    studentName: string;
    date: string;
    lessons: number;
    englishStatus: string;
    personalStatus: string;
    criticalStatus: string;
    studyMinutes: number;
    streak: number;
    totalXp: number;
  }): string {
    const s = (status: string) =>
      status === 'green' ? '🟢' : status === 'yellow' ? '🟡' : '🔴';
    return [
      `📚 <b>A'lochi — Kunlik Hisobot</b>`,
      `👦 Farzand: ${data.studentName}`,
      `📅 Sana: ${data.date}`,
      ``,
      `✅ Bugun ${data.lessons} dars tamomladı`,
      `📊 Ingliz tili:     ${s(data.englishStatus)}`,
      `📊 Shaxsiy rivojl.: ${s(data.personalStatus)}`,
      `📊 Tanqidiy fikrl.: ${s(data.criticalStatus)}`,
      `⏱ O'qish vaqti: ${data.studyMinutes} daqiqa`,
      `🔥 Streak: ${data.streak} kun ketma-ket`,
      `🏅 Umumiy ball: ${data.totalXp} XP`,
    ].join('\n');
  }

  formatWarningNotification(studentName: string, warningCount: number, reason: string): string {
    if (warningCount >= 3) {
      return [
        `⛔ <b>Profil bloklandi!</b>`,
        `O'quvchi: ${studentName}`,
        `${warningCount} ta ogohlantirish to'plandi`,
        `Sabab: ${reason}`,
        `Filial bilan bog'laning!`,
      ].join('\n');
    }
    return [
      `⚠️ <b>Ogohlantirish berildi</b> (${warningCount}/3)`,
      `O'quvchi: ${studentName}`,
      `Sabab: ${reason}`,
    ].join('\n');
  }

  formatPaymentReminder(studentName: string, daysLeft: number): string {
    return [
      `💳 <b>To'lov eslatmasi</b>`,
      `Farzand: ${studentName}`,
      `To'lov muddatiga ${daysLeft} kun qoldi`,
      `Iltimos, o'z vaqtida to'lovni amalga oshiring`,
    ].join('\n');
  }
}
