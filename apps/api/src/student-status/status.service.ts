import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';

interface SetStatusDto {
  tenantId: string;
  studentId: string;
  date: string;
  changedBy?: string;
  englishStatus?: string;
  englishNote?: string;
  personalStatus?: string;
  personalNote?: string;
  criticalStatus?: string;
  criticalNote?: string;
}

@Injectable()
export class StatusService {
  constructor(
    private prisma: PrismaService,
    private events: EventEmitter2,
  ) {}

  async setStatus(dto: SetStatusDto) {
    const {
      tenantId,
      studentId,
      date,
      changedBy,
      englishStatus,
      englishNote,
      personalStatus,
      personalNote,
      criticalStatus,
      criticalNote,
    } = dto;
    const dateObj = new Date(date);

    const result = await this.prisma.studentStatus.upsert({
      where: { studentId_date: { studentId, date: dateObj } },
      create: {
        studentId,
        date: dateObj,
        englishStatus,
        englishNote,
        personalStatus,
        personalNote,
        criticalStatus,
        criticalNote,
      },
      update: {
        englishStatus,
        englishNote,
        personalStatus,
        personalNote,
        criticalStatus,
        criticalNote,
      },
    });

    // Emit a domain event with the most-severe-color (qizil > sariq > yashil)
    // so the gateway can broadcast `status:updated` after Uzbek→English mapping.
    const worst = this.worstColor([
      englishStatus,
      personalStatus,
      criticalStatus,
    ]);
    this.events.emit('status.updated', {
      studentId,
      color: worst,
      changedBy: changedBy ?? null,
      tenantId,
      timestamp: new Date().toISOString(),
    });

    return result;
  }

  private worstColor(values: (string | undefined)[]): string | null {
    const order: Record<string, number> = { qizil: 3, sariq: 2, yashil: 1 };
    let best: string | null = null;
    let bestRank = 0;
    for (const v of values) {
      if (!v) continue;
      const rank = order[v] ?? 0;
      if (rank > bestRank) {
        bestRank = rank;
        best = v;
      }
    }
    return best;
  }

  async getLatest(studentId: string) {
    return this.prisma.studentStatus.findFirst({
      where: { studentId },
      orderBy: { date: 'desc' },
    });
  }

  async getHistory(studentId: string, limit = 30) {
    return this.prisma.studentStatus.findMany({
      where: { studentId },
      orderBy: { date: 'desc' },
      take: limit,
    });
  }

  async getRedStudents(tenantId: string) {
    return this.getStudentsByColor(tenantId, 'qizil');
  }

  async getYellowStudents(tenantId: string) {
    return this.getStudentsByColor(tenantId, 'sariq');
  }

  private getStudentsByColor(tenantId: string, color: string) {
    return this.prisma.studentStatus.findMany({
      where: {
        student: { tenantId },
        OR: [
          { englishStatus: color },
          { personalStatus: color },
          { criticalStatus: color },
        ],
      },
      orderBy: { date: 'desc' },
      distinct: ['studentId'],
      include: {
        student: { select: { id: true, name: true } },
      },
    });
  }

  async getHighPerformers(tenantId: string, branchId?: string | null) {
    const totalLessons = await this.prisma.lesson.count({
      where: { tenantId, isPublished: true },
    });
    if (totalLessons === 0) return [];
    const threshold = Math.floor(totalLessons * 0.9);

    const students = await this.prisma.user.findMany({
      where: {
        tenantId,
        role: 'student',
        status: 'active',
        ...(branchId ? { branchId } : {}),
      },
      select: {
        id: true,
        name: true,
        studentStatuses: {
          orderBy: { date: 'desc' },
          take: 1,
          select: {
            englishStatus: true,
            personalStatus: true,
            criticalStatus: true,
          },
        },
        studentProgress: {
          where: { academyCompleted: true },
          select: { id: true },
        },
      },
    });

    return students
      .filter((s) => {
        const status = s.studentStatuses[0];
        if (!status) return false;
        const allGreen =
          status.englishStatus === 'yashil' &&
          status.personalStatus === 'yashil' &&
          status.criticalStatus === 'yashil';
        const progressOk = s.studentProgress.length >= threshold;
        return allGreen && progressOk;
      })
      .map((s) => ({
        id: s.id,
        name: s.name,
        lessonsCompleted: s.studentProgress.length,
        totalLessons,
      }));
  }
}
