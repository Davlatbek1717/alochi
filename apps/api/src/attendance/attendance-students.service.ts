import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AnalyticsService } from '../analytics/analytics.service';

interface MarkRecord {
  studentId: string;
  status: string;
  markedBy?: string;
  tenantId: string;
  branchId: string;
  date: string;
}

@Injectable()
export class AttendanceStudentsService {
  constructor(
    private prisma: PrismaService,
    private analytics: AnalyticsService,
  ) {}

  async markBulk(records: MarkRecord[]) {
    const results = await Promise.all(
      records.map((r) =>
        this.prisma.attendanceStudent.upsert({
          where: { studentId_date: { studentId: r.studentId, date: new Date(r.date) } },
          create: {
            tenantId: r.tenantId,
            branchId: r.branchId,
            studentId: r.studentId,
            date: new Date(r.date),
            status: r.status,
            markedBy: r.markedBy ?? null,
          },
          update: {
            status: r.status,
            markedBy: r.markedBy ?? null,
          },
        }),
      ),
    );
    for (const r of records) {
      this.analytics.logEvent({
        tenantId: r.tenantId,
        eventType: 'attendance_marked',
        studentId: r.studentId,
        branchId: r.branchId,
        data: { isPresent: r.status === 'present', isLate: r.status === 'late' },
      }).catch(() => {});
    }
    return results;
  }

  async getDailyList(branchId: string, date: string) {
    return this.prisma.attendanceStudent.findMany({
      where: { branchId, date: new Date(date) },
      include: {
        student: { select: { id: true, name: true } },
      },
      orderBy: { student: { name: 'asc' } },
    });
  }
}
