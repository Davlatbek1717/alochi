import { Injectable, Logger } from '@nestjs/common';
import { Context } from 'grammy';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class VideoCheckinHandler {
  private readonly logger = new Logger(VideoCheckinHandler.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Handles `/start link_<userId>` payload — links the student's Telegram
   * account. The underscore separator (instead of `:`) is mandatory:
   * Telegram's deep-link `start` parameter only accepts `[A-Za-z0-9_-]`,
   * and silently strips colons before the bot ever sees them.
   */
  async handleStart(ctx: Context, payload: string): Promise<void> {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    // payload is "link_<userId>"
    const userId = payload.replace(/^link_/, '').trim();
    if (!userId) {
      await ctx.reply("Havola noto'g'ri. Profilingizdan qayta urinib ko'ring.");
      return;
    }

    try {
      // Works for ANY role — students link to submit videos; staff
      // (filadmin / manager / mentor / tester / superadmin) link to
      // receive reports & notifications on their own Telegram.
      const user = await this.prisma.user.findFirst({
        where: { id: userId },
        select: { id: true, name: true, role: true },
      });

      if (!user) {
        await ctx.reply("Foydalanuvchi topilmadi yoki havola eskirgan.");
        return;
      }

      await this.prisma.user.update({
        where: { id: userId },
        data: { telegramId: BigInt(telegramId) },
      });

      if (user.role === 'student') {
        await ctx.reply(
          `Salom, ${user.name}! Profilingiz muvaffaqiyatli bog'landi.\n\n` +
            `Kunlik video yuborish endi A'lojon saytida: alojon.uz\n` +
            `Profilingizga kiring va "Kunlik video" bo'limiga o'ting.`,
        );
      } else {
        await ctx.reply(
          `Salom, ${user.name}! Hisobingiz muvaffaqiyatli bog'landi. ` +
            `Muhim bildirishnoma va hisobotlarni shu yerda olasiz.`,
        );
      }
    } catch (err) {
      this.logger.error(`handleStart link error: ${err}`);
      await ctx.reply("Xatolik yuz berdi. Keyinroq urinib ko'ring.");
    }
  }

  /**
   * Video upload has moved to the web app. Inform and redirect.
   */
  async handleVideo(ctx: Context): Promise<void> {
    await ctx.reply(
      "Video yuborish endi A'lojon saytida mavjud.\n\nalojon.uz ga kiring → Profil → Kunlik video.",
    );
  }

  async handleNonVideo(ctx: Context): Promise<void> {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;
    const isStudent = await this.prisma.user.findFirst({
      where: { telegramId: BigInt(telegramId), role: 'student' },
      select: { id: true },
    });
    if (!isStudent) return;
    await ctx.reply(
      "Video yuborish endi A'lojon saytida mavjud.\n\nalojon.uz ga kiring → Profil → Kunlik video.",
    );
  }

  /**
   * Sends a reminder message to a student via their Telegram ID.
   * Used by cron jobs.
   */
  async sendReminder(
    bot: {
      api: { sendMessage: (chatId: string, text: string) => Promise<unknown> };
    },
    telegramId: bigint,
    message: string,
  ): Promise<void> {
    try {
      await bot.api.sendMessage(telegramId.toString(), message);
    } catch (err) {
      this.logger.warn(`Reminder failed for telegramId=${telegramId}: ${err}`);
    }
  }
}
