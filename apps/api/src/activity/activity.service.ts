import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface ActivityEntry {
  sessionId: string;
  url: string;
  pageType: string;
  resourceId?: string;
  deviceId?: string;
  enteredAt: Date;
  leftAt?: Date;
  durationSec?: number;
  scrollDepthPct?: number;
  interactionCount?: number;
  blurEventsCount?: number;
  exitReason?: string;
}

@Injectable()
export class ActivityService {
  constructor(private prisma: PrismaService) {}

  async recordBatch(
    studentId: string,
    tenantId: string,
    entries: ActivityEntry[],
  ) {
    if (entries.length === 0) return { count: 0 };
    const result = await this.prisma.pageActivity.createMany({
      data: entries.map((e) => ({
        studentId,
        tenantId,
        sessionId: e.sessionId,
        url: e.url.slice(0, 2000),
        pageType: e.pageType,
        resourceId: e.resourceId,
        deviceId: e.deviceId,
        enteredAt: e.enteredAt,
        leftAt: e.leftAt,
        durationSec: e.durationSec !== undefined ? Math.round(e.durationSec) : undefined,
        scrollDepthPct: e.scrollDepthPct,
        interactionCount: e.interactionCount ?? 0,
        blurEventsCount: e.blurEventsCount ?? 0,
        exitReason: e.exitReason,
      })),
      skipDuplicates: true,
    });
    return { count: result.count };
  }

  async getStudentTimeline(
    studentId: string,
    tenantId: string,
    date?: string,
  ) {
    const start = date ? new Date(`${date}T00:00:00+05:00`) : undefined;
    const end = date ? new Date(`${date}T23:59:59+05:00`) : undefined;
    return this.prisma.pageActivity.findMany({
      where: {
        studentId,
        tenantId,
        ...(start && end ? { enteredAt: { gte: start, lte: end } } : {}),
      },
      orderBy: { enteredAt: 'asc' },
    });
  }

  async getHeatmap(
    studentId: string,
    tenantId: string,
    days: number,
  ): Promise<{ date: string; hour: number; seconds: number }[]> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const rows = await this.prisma.pageActivity.findMany({
      where: { studentId, tenantId, enteredAt: { gte: since }, durationSec: { not: null } },
      select: { enteredAt: true, durationSec: true },
    });

    const map = new Map<string, number>();
    for (const row of rows) {
      // key = "YYYY-MM-DD|HH" in Asia/Tashkent (UTC+5)
      const local = new Date(row.enteredAt.getTime() + 5 * 3600 * 1000);
      const key = `${local.toISOString().slice(0, 10)}|${local.getUTCHours()}`;
      map.set(key, (map.get(key) ?? 0) + (row.durationSec ?? 0));
    }

    return Array.from(map.entries()).map(([key, seconds]) => {
      const [date, hourStr] = key.split('|');
      return { date, hour: parseInt(hourStr, 10), seconds };
    });
  }
}
