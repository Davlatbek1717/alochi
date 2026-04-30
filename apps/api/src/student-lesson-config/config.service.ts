import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface SetNOverrideDto {
  studentId: string;
  lessonId: string;
  tenantId: string;
  managerId: string;
  nRepetitions: number;
  reason?: string;
}

@Injectable()
export class StudentConfigService {
  constructor(private prisma: PrismaService) {}

  async setNOverride(dto: SetNOverrideDto) {
    const lesson = await this.prisma.lesson.findFirst({
      where: { id: dto.lessonId, tenantId: dto.tenantId },
    });
    if (!lesson) throw new NotFoundException('Dars topilmadi');

    if (dto.nRepetitions < 1) {
      throw new BadRequestException("N kamida 1 bo'lishi kerak");
    }
    if (dto.nRepetitions > lesson.maxNOverride) {
      throw new BadRequestException(
        `N ${lesson.maxNOverride} (maximal) dan oshib ketdi`,
      );
    }

    // Capture existing N before upsert (Phase 20.9 audit log)
    const existing = await this.prisma.studentLessonConfig.findUnique({
      where: {
        studentId_lessonId: {
          studentId: dto.studentId,
          lessonId: dto.lessonId,
        },
      },
      select: { nRepetitionsOverride: true },
    });
    const oldN = existing?.nRepetitionsOverride ?? null;

    const result = await this.prisma.studentLessonConfig.upsert({
      where: {
        studentId_lessonId: {
          studentId: dto.studentId,
          lessonId: dto.lessonId,
        },
      },
      create: {
        studentId: dto.studentId,
        lessonId: dto.lessonId,
        nRepetitionsOverride: dto.nRepetitions,
        changedBy: dto.managerId,
        reason: dto.reason,
      },
      update: {
        nRepetitionsOverride: dto.nRepetitions,
        changedBy: dto.managerId,
        changedAt: new Date(),
        reason: dto.reason,
      },
    });

    // Always write history row (Phase 20.9)
    await this.prisma.kpiOverrideLog.create({
      data: {
        studentId: dto.studentId,
        lessonId: dto.lessonId,
        oldN,
        newN: dto.nRepetitions,
        changedBy: dto.managerId,
        reason: dto.reason,
      },
    });

    return result;
  }

  async getStudentConfigs(studentId: string) {
    return this.prisma.studentLessonConfig.findMany({
      where: { studentId },
      include: { lesson: { select: { title: true, orderNumber: true } } },
    });
  }

  async getOverrideHistory(studentId: string, lessonId: string) {
    return this.prisma.kpiOverrideLog.findMany({
      where: { studentId, lessonId },
      orderBy: { changedAt: 'desc' },
      take: 100,
      include: {
        actor: { select: { id: true, name: true } },
      },
    });
  }
}
