import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AttendanceStaffService {
  constructor(private prisma: PrismaService) {}

  async checkIn(
    userId: string,
    tenantId: string,
    branchId: string,
    method: string,
  ) {
    const now = new Date();
    const today = new Date(now.toISOString().split('T')[0]);

    // Determine if late: after 09:00 local time (use UTC for simplicity)
    const isLate =
      now.getUTCHours() > 9 ||
      (now.getUTCHours() === 9 && now.getUTCMinutes() > 0);

    return this.prisma.attendanceStaff.upsert({
      where: { userId_date: { userId, date: today } },
      create: {
        tenantId,
        branchId,
        userId,
        date: today,
        loginTime: now,
        isLate,
        recognitionMethod: method,
      },
      update: {
        loginTime: now,
        isLate,
        recognitionMethod: method,
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
}
