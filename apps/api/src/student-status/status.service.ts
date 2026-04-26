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
}
