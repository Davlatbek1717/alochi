import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface SetStatusDto {
  tenantId: string;
  studentId: string;
  date: string;
  englishStatus?: string;
  englishNote?: string;
  personalStatus?: string;
  personalNote?: string;
  criticalStatus?: string;
  criticalNote?: string;
}

@Injectable()
export class StatusService {
  constructor(private prisma: PrismaService) {}

  async setStatus(dto: SetStatusDto) {
    const { studentId, date, englishStatus, englishNote, personalStatus, personalNote, criticalStatus, criticalNote } = dto;
    const dateObj = new Date(date);

    return this.prisma.studentStatus.upsert({
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

  async getHighPerformers(tenantId: string) {
    const totalLessons = await this.prisma.lesson.count({
      where: { tenantId, isPublished: true },
    });
    const threshold = Math.floor(totalLessons * 0.9);

    const students = await this.prisma.user.findMany({
      where: { tenantId, role: 'student', status: 'active' },
      select: {
        id: true,
        name: true,
        studentStatuses: {
          orderBy: { date: 'desc' },
          take: 1,
          select: { englishStatus: true, personalStatus: true, criticalStatus: true },
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
