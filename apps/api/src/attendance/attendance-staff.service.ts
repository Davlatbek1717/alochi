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
  static computeLateMinutes(
    workStart: string,
    graceMinutes: number,
    now: Date,
  ): number {
    const [hh, mm] = (workStart ?? '09:00').split(':').map(Number);
    const startToday = new Date(now);
    startToday.setHours(hh, mm, 0, 0);
    const diffMin = Math.floor((now.getTime() - startToday.getTime()) / 60000);
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
    return this.prisma.attendanceStaff.findMany({
      where: { branchId, date: new Date(date) },
      include: {
        user: { select: { id: true, name: true } },
      },
      orderBy: { user: { name: 'asc' } },
    });
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
