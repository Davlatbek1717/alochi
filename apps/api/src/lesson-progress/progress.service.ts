import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProgressService {
  constructor(private prisma: PrismaService) {}

  private async getEffectiveN(studentId: string, lessonId: string, tenantId: string): Promise<number> {
    const lesson = await this.prisma.lesson.findFirst({ where: { id: lessonId, tenantId } });
    if (!lesson) throw new NotFoundException('Dars topilmadi');

    const override = await this.prisma.studentLessonConfig.findUnique({
      where: { studentId_lessonId: { studentId, lessonId } },
    });

    if (override) return Math.min(override.nRepetitionsOverride, lesson.maxNOverride);
    return lesson.nRepetitions;
  }

  async completeSession(studentId: string, lessonId: string, tenantId: string) {
    const effectiveN = await this.getEffectiveN(studentId, lessonId, tenantId);

    const current = await this.prisma.studentProgress.findUnique({
      where: { studentId_lessonId: { studentId, lessonId } },
    });

    const newCount = (current?.sessionCount ?? 0) + 1;
    const homeCompleted = newCount >= effectiveN;

    return this.prisma.studentProgress.upsert({
      where: { studentId_lessonId: { studentId, lessonId } },
      create: {
        studentId,
        lessonId,
        sessionCount: newCount,
        homeCompleted,
        lastActivityAt: new Date(),
        ...(homeCompleted ? { completedAt: new Date() } : {}),
      },
      update: {
        sessionCount: newCount,
        homeCompleted,
        lastActivityAt: new Date(),
        ...(homeCompleted ? { completedAt: new Date() } : {}),
      },
    });
  }

  async markAcademyCompleted(studentId: string, lessonId: string) {
    return this.prisma.studentProgress.update({
      where: { studentId_lessonId: { studentId, lessonId } },
      data: { academyCompleted: true, completedAt: new Date() },
    });
  }

  async getStudentProgress(studentId: string) {
    return this.prisma.studentProgress.findMany({
      where: { studentId },
      include: { lesson: { select: { id: true, title: true, orderNumber: true } } },
      orderBy: { lesson: { orderNumber: 'asc' } },
    });
  }
}
