import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Bot, InlineKeyboard } from 'grammy';
import { ParentHandler } from './handlers/parent.handler';
import { StudentHandler } from './handlers/student.handler';
import { StaffHandler } from './handlers/staff.handler';
import { VideoCheckinHandler } from './handlers/video-checkin.handler';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationTemplatesService } from '../notification-templates/notification-templates.service';
import { statusEmoji } from '../student-status/status.types';

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
    private videoCheckinHandler: VideoCheckinHandler,
    private templates: NotificationTemplatesService,
  ) {}

  async onModuleInit() {
    const token = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    if (!token) {
      this.logger.warn(
        "TELEGRAM_BOT_TOKEN yo'q — bot ishga tushmadi (Faza 1 da ixtiyoriy)",
      );
      return;
    }

    this.bot = new Bot(token);
    this.setupHandlers();

    if (this.config.get('NODE_ENV') === 'production') {
      const webhookUrl = this.config.get<string>('TELEGRAM_WEBHOOK_URL');
      if (webhookUrl) {
        // grammy webhook mode requires bot.init() — without it,
        // handleUpdate() throws "Bot not initialized!" because the bot
        // doesn't know its own identity (no api.getMe call yet) and the
        // middleware chain refuses to dispatch.
        await this.bot.init();
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

      // Student self-linking: /start link:<userId>
      if (payload && payload.startsWith('link:') && telegramId) {
        await this.videoCheckinHandler.handleStart(ctx, payload);
        return;
      }

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
        await ctx.reply('Havola topilmadi yoki eskirgan.');
      } else {
        await ctx.reply(
          "A'lochi platformasiga xush kelibsiz! 🎓\n\nFarzandingizni bog'lash uchun uning profilidan havolani bosing.",
        );
      }
    });

    this.bot.command('bugun', async (ctx) => {
      await ctx.reply(
        "📚 Bugungi darslar: (profil bog'langandan so'ng ko'rsatiladi)",
      );
    });

    this.bot.command('statistika', async (ctx) => {
      await ctx.reply(
        "📊 Statistika: (profil bog'langandan so'ng ko'rsatiladi)",
      );
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

    this.bot.command('rating', async (ctx) => {
      const telegramId = BigInt(ctx.from?.id ?? 0);
      await this.studentHandler.handleRating(ctx, telegramId);
    });

    this.bot.command('davomat', async (ctx) => {
      const telegramId = BigInt(ctx.from?.id ?? 0);
      await this.staffHandler.handleDavomat(ctx, telegramId);
    });

    this.bot.callbackQuery(/^att:.+/, async (ctx) => {
      const telegramId = BigInt(ctx.from?.id ?? 0);
      await this.staffHandler.handleAttendanceCallback(ctx, telegramId);
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

    // ── Video check-in handlers ──────────────────────────────────────────────
    // Both video types route to the same handler which decides by ctx.message
    this.bot.on('message:video_note', async (ctx) => {
      await this.videoCheckinHandler.handleVideo(ctx);
    });

    this.bot.on('message:video', async (ctx) => {
      await this.videoCheckinHandler.handleVideo(ctx);
    });

    // Fallback: any other message that isn't a command or video gets the
    // "please send a video" reply. Commands are already handled above so
    // grammy won't reach this handler for them. The video handlers above
    // also fire first (grammy uses first-match per filter).
    this.bot.on('message', async (ctx) => {
      const msg = ctx.message;
      // Skip if this message is a video (handled above already)
      if (msg.video || msg.video_note) return;
      // Skip slash commands
      if (msg.text?.startsWith('/')) return;
      await this.videoCheckinHandler.handleNonVideo(ctx);
    });
  }

  async onModuleDestroy() {
    if (this.bot) {
      await this.bot.stop();
    }
  }

  async sendMessage(
    telegramId: string | bigint,
    text: string,
    extra?: { reply_markup?: unknown },
  ) {
    if (!this.bot) return;

    try {
      await this.bot.api.sendMessage(telegramId.toString(), text, {
        parse_mode: 'HTML',
        ...(extra ?? {}),
      } as Parameters<Bot['api']['sendMessage']>[2]);
    } catch (err) {
      this.logger.warn(
        `Telegram xabar yuborib bo'lmadi (${telegramId}): ${err}`,
      );
    }
  }

  /**
   * Send a templated message to a user by ID. Looks up `telegramId` from
   * the `users` table; silently skips if the user has not linked Telegram.
   */
  async sendToUser(
    userId: string,
    key: string,
    vars: Record<string, string | number | undefined> = {},
    tenantId?: string,
  ): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { telegramId: true, tenantId: true },
    });
    if (!user?.telegramId) return false;
    const text = await this.templates.render(
      key,
      vars,
      tenantId ?? user.tenantId,
    );
    await this.sendMessage(user.telegramId, text);
    return true;
  }

  /**
   * Send a templated message to a student's parent (via parentTelegramId).
   * If the student's parent telegram is not linked, logs and returns false.
   */
  async sendToParent(
    studentId: string,
    key: string,
    vars: Record<string, string | number | undefined> = {},
    tenantId?: string,
  ): Promise<boolean> {
    const student = await this.prisma.user.findUnique({
      where: { id: studentId },
      select: { parentTelegramId: true, tenantId: true, name: true },
    });
    if (!student?.parentTelegramId) {
      this.logger.warn(
        `sendToParent: student ${studentId} parentTelegramId yo'q — skip`,
      );
      return false;
    }
    const text = await this.templates.render(
      key,
      { studentName: student.name, ...vars },
      tenantId ?? student.tenantId,
    );
    await this.sendMessage(student.parentTelegramId, text);
    return true;
  }

  /**
   * Render a templated message and send it directly to a Telegram chat ID.
   */
  async sendTemplate(
    telegramId: string | bigint,
    key: string,
    vars: Record<string, string | number | undefined> = {},
    tenantId?: string,
  ) {
    const text = await this.templates.render(key, vars, tenantId);
    await this.sendMessage(telegramId, text);
  }

  /** Exposes the underlying bot so other handlers can register commands. */
  getBot(): Bot | null {
    return this.bot;
  }

  /** Helper used by /davomat keyboard rendering. */
  static buildAttendanceKeyboard(studentId: string): InlineKeyboard {
    return new InlineKeyboard()
      .text('✅', `att:${studentId}:present`)
      .text('⏰', `att:${studentId}:late`)
      .text('❌', `att:${studentId}:absent`);
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
    // Statuses arrive in Uzbek canonical (yashil/sariq/qizil); the
    // helper handles unknown / 'nomalum' values gracefully.
    return [
      `📚 <b>A'lochi — Kunlik Hisobot</b>`,
      `👦 Farzand: ${data.studentName}`,
      `📅 Sana: ${data.date}`,
      ``,
      `✅ Bugun ${data.lessons} dars tamomladı`,
      `📊 Ingliz tili:     ${statusEmoji(data.englishStatus)}`,
      `📊 Shaxsiy rivojl.: ${statusEmoji(data.personalStatus)}`,
      `📊 Tanqidiy fikrl.: ${statusEmoji(data.criticalStatus)}`,
      `⏱ O'qish vaqti: ${data.studyMinutes} daqiqa`,
      `🔥 Streak: ${data.streak} kun ketma-ket`,
      `🏅 Umumiy ball: ${data.totalXp} XP`,
    ].join('\n');
  }

  formatWarningNotification(
    studentName: string,
    warningCount: number,
    reason: string,
  ): string {
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
