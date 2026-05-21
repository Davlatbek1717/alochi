import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AttendanceStaffService {
  constructor(private prisma: PrismaService) {}

  /**
   * Compute lateMinutes given a workStart string ("HH:mm"), grace minutes,
   * and a "now" instant. Returns 0 if not late, else minutes past
   * (workStart + grace).
   */
  // Tashkent is UTC+5 — fixed offset, no DST.
  private static readonly TASHKENT_OFFSET_MS = 5 * 60 * 60 * 1000;

  static computeLateMinutes(
    workStart: string,
    graceMinutes: number,
    now: Date,
  ): number {
    const [hh, mm] = (workStart ?? '09:00').split(':').map(Number);
    // Derive today's calendar date in Tashkent
    const tashkentNow = new Date(now.getTime() + AttendanceStaffService.TASHKENT_OFFSET_MS);
    const year = tashkentNow.getUTCFullYear();
    const month = tashkentNow.getUTCMonth();
    const day = tashkentNow.getUTCDate();
    // Build work-start as a UTC timestamp (workStart is Tashkent local)
    const workStartUtcMs =
      Date.UTC(year, month, day, hh, mm) - AttendanceStaffService.TASHKENT_OFFSET_MS;
    const diffMin = Math.floor((now.getTime() - workStartUtcMs) / 60000);
    return Math.max(0, diffMin - (graceMinutes ?? 0));
  }

  async checkIn(
    userId: string,
    tenantId: string,
    branchId: string,
    method: string,
    extra: { confidence?: number; deviceId?: string } = {},
  ) {
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
    });
    if (!branch) throw new NotFoundException('Branch topilmadi');

    const now = new Date();
    const today = new Date(now.toISOString().split('T')[0]);
    const lateMinutes = AttendanceStaffService.computeLateMinutes(
      branch.workStartTime,
      branch.lateGraceMinutes,
      now,
    );
    const isLate = lateMinutes > 0;

    // Task 18.8: 409 on duplicate check-in
    const existing = await this.prisma.attendanceStaff.findFirst({
      where: { userId, date: today },
    });
    if (existing) {
      throw new ConflictException({
        code: 'ATTENDANCE_ALREADY_RECORDED',
        message: 'Bugun allaqachon belgilangansiz',
        details: { recordedAt: existing.loginTime },
      });
    }

    return this.prisma.attendanceStaff.create({
      data: {
        tenantId,
        branchId,
        userId,
        date: today,
        loginTime: now,
        isLate,
        lateMinutes,
        recognitionMethod: method,
        confidence: extra.confidence,
        deviceId: extra.deviceId,
      },
    });
  }

  async confirm(userId: string, confirmedBy: string, date: string) {
    return this.prisma.attendanceStaff.update({
      where: { userId_date: { userId, date: new Date(date) } },
      data: {
        confirmedAt: new Date(),
        confirmedBy,
      },
    });
  }

  async getDailyStaff(branchId: string, date: string) {
    const targetDate = new Date(date);
    const [staffUsers, attendanceRecords] = await Promise.all([
      this.prisma.user.findMany({
        where: { branchId, role: { in: ['mentor', 'manager', 'tester'] } },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.attendanceStaff.findMany({
        where: { branchId, date: targetDate },
      }),
    ]);

    const recMap = new Map(attendanceRecords.map((r) => [r.userId, r]));
    return staffUsers.map((u) => {
      const rec = recMap.get(u.id);
      return {
        id: rec?.id ?? null,
        userId: u.id,
        loginTime: rec?.loginTime ?? null,
        isLate: rec?.isLate ?? false,
        lateMinutes: rec?.lateMinutes ?? 0,
        recognitionMethod: rec?.recognitionMethod ?? null,
        confirmedAt: rec?.confirmedAt ?? null,
        confirmedBy: rec?.confirmedBy ?? null,
        user: { id: u.id, name: u.name },
      };
    });
  }

  /**
   * Filadmin dashboard helper — returns the count of staff who checked
   * in today (loginTime IS NOT NULL) for a given branch.
   */
  async getTodayCount(branchId: string): Promise<{ count: number }> {
    const nowUtc = new Date();
    const tashkentNow = new Date(nowUtc.getTime() + AttendanceStaffService.TASHKENT_OFFSET_MS);
    const year = tashkentNow.getUTCFullYear();
    const month = tashkentNow.getUTCMonth();
    const day = tashkentNow.getUTCDate();
    const todayUtc = new Date(Date.UTC(year, month, day) - AttendanceStaffService.TASHKENT_OFFSET_MS);
    const tomorrowUtc = new Date(todayUtc.getTime() + 86_400_000);
    const count = await this.prisma.attendanceStaff.count({
      where: {
        branchId,
        date: { gte: todayUtc, lt: tomorrowUtc },
        loginTime: { not: null },
      },
    });
    return { count };
  }

  /**
   * 25.D.2: Staff attendance history for a branch in [from, to] inclusive.
   * Dates are ISO YYYY-MM-DD; returns chronological order.
   */
  async getHistory(branchId: string, from: string, to: string) {
    if (!branchId || !from || !to) return [];
    return this.prisma.attendanceStaff.findMany({
      where: {
        branchId,
        date: { gte: new Date(from), lte: new Date(to) },
      },
      include: { user: { select: { id: true, name: true } } },
      orderBy: [{ date: 'asc' }, { user: { name: 'asc' } }],
    });
  }
}
