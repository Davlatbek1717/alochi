import { Injectable, ForbiddenException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { AnalyticsService } from '../analytics/analytics.service';

interface MarkRecord {
  studentId: string;
  status: string;
  markedBy?: string;
  tenantId: string;
  branchId: string;
  date: string;
  lessonId?: string | null;
}

@Injectable()
export class AttendanceStudentsService {
  constructor(
    private prisma: PrismaService,
    private analytics: AnalyticsService,
    private events: EventEmitter2,
  ) {}

  /**
   * Mentor records attendance for their own group only. `mentorId` is
   * the marking mentor; we resolve their group and reject the whole
   * batch if any studentId is outside it (no partial writes — a mixed
   * batch means the client is out of sync, fail loudly).
   */
  async markBulk(records: MarkRecord[], mentorId?: string) {
    if (records.length === 0) return [];

    if (mentorId) {
      const mentor = await this.prisma.user.findUnique({
        where: { id: mentorId },
        select: { groupId: true },
      });
      if (!mentor?.groupId) {
        throw new ForbiddenException(
          "Sizga guruh biriktirilmagan — davomat belgilab bo'lmaydi",
        );
      }
      const ids = Array.from(new Set(records.map((r) => r.studentId)));
      const inGroup = await this.prisma.user.count({
        where: {
          id: { in: ids },
          role: 'student',
          groupId: mentor.groupId,
        },
      });
      if (inGroup !== ids.length) {
        throw new ForbiddenException(
          "Faqat o'z guruhingiz o'quvchilari uchun davomat belgilay olasiz",
        );
      }
    }

    const results = await Promise.all(
      records.map((r) =>
        this.prisma.attendanceStudent.upsert({
          where: {
            studentId_date: { studentId: r.studentId, date: new Date(r.date) },
          },
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
    const timestamp = new Date().toISOString();
    for (const r of records) {
      this.analytics
        .logEvent({
          tenantId: r.tenantId,
          eventType: 'attendance_marked',
          studentId: r.studentId,
          branchId: r.branchId,
          data: {
            isPresent: r.status === 'present',
            isLate: r.status === 'late',
          },
        })
        .catch(() => {});
      this.events.emit('attendance.marked', {
        studentId: r.studentId,
        status: r.status,
        timestamp,
      });
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
