import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

function startOfDayUtc(d: Date) {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
}

@Injectable()
export class CultureLessonsService {
  private readonly logger = new Logger(CultureLessonsService.name);

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  async getToday(staffId: string) {
    const today = startOfDayUtc(new Date());
    const row = await this.prisma.cultureLessonAttendance.findUnique({
      where: { staffId_date: { staffId, date: today } },
    });
    return {
      date: today.toISOString().slice(0, 10),
      completed: Boolean(row?.completedAt),
      completedAt: row?.completedAt ?? null,
      notes: row?.notes ?? null,
    };
  }

  async markToday(staffId: string, notes?: string) {
    const today = startOfDayUtc(new Date());
    return this.prisma.cultureLessonAttendance.upsert({
      where: { staffId_date: { staffId, date: today } },
      create: {
        staffId,
        date: today,
        completedAt: new Date(),
        notes,
      },
      update: {
        completedAt: new Date(),
        notes,
      },
    });
  }

  async getMissed(staffId: string, days = 30) {
    const now = new Date();
    const start = startOfDayUtc(
      new Date(now.getTime() - days * 24 * 60 * 60 * 1000),
    );
    const today = startOfDayUtc(now);

    const records = await this.prisma.cultureLessonAttendance.findMany({
      where: { staffId, date: { gte: start, lte: today } },
      select: { date: true, completedAt: true },
    });
    const completedSet = new Set(
      records
        .filter((r) => r.completedAt)
        .map((r) => r.date.toISOString().slice(0, 10)),
    );

    const missed: string[] = [];
    for (
      let cursor = new Date(start);
      cursor <= today;
      cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000)
    ) {
      const key = cursor.toISOString().slice(0, 10);
      if (!completedSet.has(key)) missed.push(key);
    }
    return { staffId, missedDates: missed };
  }

  /** Daily reminder: at 08:00 alert anyone who missed yesterday. */
  @Cron('0 8 * * *', { name: 'culture_lesson_reminder' })
  async dailyReminder() {
    const now = new Date();
    const yesterday = startOfDayUtc(
      new Date(now.getTime() - 24 * 60 * 60 * 1000),
    );

    const staff = await this.prisma.user.findMany({
      where: {
        role: { in: ['mentor', 'manager', 'filadmin', 'tester'] },
        status: 'active',
      },
      select: { id: true },
    });

    let notified = 0;
    for (const s of staff) {
      const row = await this.prisma.cultureLessonAttendance.findUnique({
        where: { staffId_date: { staffId: s.id, date: yesterday } },
      });
      if (row?.completedAt) continue;

      try {
        await this.notifications.send(
          s.id,
          'culture_reminder',
          'Madaniyat darsi',
          'Kechagi madaniyat darsi belgilanmagan. Bugun belgilang.',
        );
        notified++;
      } catch (e) {
        this.logger.warn(
          `culture reminder notify failed for ${s.id}: ${(e as Error).message}`,
        );
      }
    }
    this.logger.log(`Culture reminder sent: ${notified}`);
    return notified;
  }
}
