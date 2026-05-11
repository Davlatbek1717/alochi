import { Injectable, Logger } from '@nestjs/common';
import { Context } from 'grammy';
import { PrismaService } from '../../prisma/prisma.service';
import { VideoCheckinService } from '../../video-checkin/video-checkin.service';
import {
  currentWindow,
  nextWindowLabel,
} from '../../video-checkin/lib/tashkent-time';

@Injectable()
export class VideoCheckinHandler {
  private readonly logger = new Logger(VideoCheckinHandler.name);

  constructor(
    private prisma: PrismaService,
    private videoCheckinService: VideoCheckinService,
  ) {}

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
      const student = await this.prisma.user.findFirst({
        where: { id: userId, role: 'student' },
        select: { id: true, name: true },
      });

      if (!student) {
        await ctx.reply("O'quvchi topilmadi yoki havola eskirgan.");
        return;
      }

      await this.prisma.user.update({
        where: { id: userId },
        data: { telegramId: BigInt(telegramId) },
      });

      await ctx.reply(
        `Salom, ${student.name}! Profilingiz muvaffaqiyatli bog'landi.\n\n` +
          `Endi har kuni:\n` +
          `• 05:00–06:30 — ertalabki video\n` +
          `• 18:00–22:00 — kechki video\n\n` +
          `Video yuboring: bot ichida dumaloq yoki to'g'riburchak video yozing. ` +
          `Forward qilingan video qabul qilinmaydi.`,
      );
    } catch (err) {
      this.logger.error(`handleStart link error: ${err}`);
      await ctx.reply("Xatolik yuz berdi. Keyinroq urinib ko'ring.");
    }
  }

  /**
   * Handles incoming video or video_note messages.
   */
  async handleVideo(ctx: Context): Promise<void> {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    // 1. Lookup student by telegramId
    const student = await this.prisma.user.findFirst({
      where: {
        telegramId: BigInt(telegramId),
        role: 'student',
        status: 'active',
      },
      select: { id: true, name: true },
    });

    if (!student) {
      await ctx.reply(
        "Profilingiz hali bog'lanmagan. A'lochi profilingizdan 'Botni ulash' tugmasini bosing.",
      );
      return;
    }

    // 2. Check if forwarded
    const msg = ctx.message;
    if (!msg) return;

    const isForwarded =
      'forward_origin' in msg ||
      'forward_from' in msg ||
      'forward_from_chat' in msg ||
      'forward_sender_name' in msg ||
      'forward_date' in msg;

    if (isForwarded) {
      await ctx.reply(
        "Forward qilingan video qabul qilinmaydi. Iltimos, bot ichida to'g'ridan-to'g'ri video yozing.",
      );
      return;
    }

    // 3. Check current window
    const window = currentWindow();
    if (!window) {
      await ctx.reply(
        'Hozir video tashlash vaqti emas.\n\nVaqtlar:\n• Ertalab: 05:00–06:30\n• Kechki: 18:00–22:00',
      );
      return;
    }

    // 4. Check if already submitted for this window today
    const pending = await this.videoCheckinService.pendingFromTelegram(
      BigInt(telegramId),
    );
    if (!pending) {
      const nextLabel = nextWindowLabel(window);
      await ctx.reply(
        `Bu vaqt uchun videoni allaqachon yubordingiz. Keyingi vaqt: ${nextLabel}.`,
      );
      return;
    }

    // 5. Extract fileId + duration; enforce 90s limit
    let fileId: string;
    let kind: 'video_note' | 'video';
    let durationSec: number | null = null;

    if (msg.video_note) {
      fileId = msg.video_note.file_id;
      kind = 'video_note';
      durationSec = msg.video_note.duration ?? null;
    } else if (msg.video) {
      fileId = msg.video.file_id;
      kind = 'video';
      durationSec = msg.video.duration ?? null;
    } else {
      // Shouldn't happen given the handler filter, but guard anyway
      await ctx.reply('Faqat video xabar qabul qilinadi.');
      return;
    }

    if (durationSec !== null && durationSec > 90) {
      await ctx.reply(
        "Video juda uzun. 90 sekundgacha bo'lishi kerak. Iltimos, qisqaroq video yuboring.",
      );
      return;
    }

    // 6. Record and reply
    try {
      await this.videoCheckinService.recordSubmission(
        student.id,
        window,
        fileId,
        kind,
        durationSec,
      );

      const nextLabel = nextWindowLabel(window);
      await ctx.reply(`Qabul qilindi! Yana ${nextLabel} da kutamiz.`);
    } catch (err) {
      this.logger.error(`recordSubmission failed for ${student.id}: ${err}`);
      await ctx.reply("Xatolik yuz berdi. Iltimos, qayta urinib ko'ring.");
    }
  }

  /**
   * Handles non-video messages — instructs the student to send a video.
   * Should only be called for students (not commands).
   */
  async handleNonVideo(ctx: Context): Promise<void> {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    // Only reply if this user is a linked student (avoid spamming all users)
    const isStudent = await this.prisma.user.findFirst({
      where: { telegramId: BigInt(telegramId), role: 'student' },
      select: { id: true },
    });
    if (!isStudent) return;

    await ctx.reply(
      'Faqat video xabar qabul qilinadi. Bot ichida video yoki dumaloq video yozing.',
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
