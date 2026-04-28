import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface AdaptiveConfig {
  minN: number;
  maxN: number;
  hardThreshold: number;
  easyThreshold: number;
}

@Injectable()
export class AdaptiveService {
  private readonly logger = new Logger(AdaptiveService.name);

  constructor(private prisma: PrismaService) {}

  computeNewN(currentN: number, errorCount: number, totalQuestions: number, config: AdaptiveConfig): number {
    if (totalQuestions === 0) return currentN;
    const errorRate = errorCount / totalQuestions;
    if (errorRate > config.hardThreshold) return Math.min(currentN + 1, config.maxN);
    if (errorRate < config.easyThreshold) return Math.max(currentN - 1, config.minN);
    return currentN;
  }

  async getAdaptiveConfig(tenantId: string) {
    const existing = await this.prisma.adaptiveDifficultyConfig.findUnique({ where: { tenantId } });
    if (existing) return existing;
    return this.prisma.adaptiveDifficultyConfig.upsert({
      where: { tenantId },
      create: { tenantId },
      update: {},
    });
  }

  async updateAdaptiveConfig(tenantId: string, dto: Partial<AdaptiveConfig>) {
    await this.getAdaptiveConfig(tenantId); // lazy-create if missing
    return this.prisma.adaptiveDifficultyConfig.update({
      where: { tenantId },
      data: dto,
    });
  }

  async getStudentAdaptiveLogs(studentId: string) {
    return this.prisma.adaptiveDifficultyLog.findMany({
      where: { studentId },
      orderBy: { changedAt: 'desc' },
      take: 50,
    });
  }

  async runNightlyAdaptation(tenantId: string) {
    const config = await this.getAdaptiveConfig(tenantId);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const students = await this.prisma.user.findMany({
      where: { tenantId, role: 'student', status: 'active' },
      select: { id: true },
    });

    const lessons = await this.prisma.lesson.findMany({
      where: { tenantId, isPublished: true },
      select: { id: true, nRepetitions: true },
    });

    let adjusted = 0;

    for (const student of students) {
      for (const lesson of lessons) {
        const components = await this.prisma.lessonComponent.findMany({
          where: { lessonId: lesson.id },
          select: { config: true },
        });

        const totalQuestions = components.reduce((acc, c) => {
          const q = (c.config as { questions?: unknown[] } | null)?.questions;
          return acc + (Array.isArray(q) ? q.length : 0);
        }, 0);

        if (totalQuestions === 0) continue;

        const agg = await this.prisma.errorLog.aggregate({
          where: { studentId: student.id, lessonId: lesson.id, lastError: { gte: sevenDaysAgo } },
          _sum: { errorCount: true },
        });
        const errorCount = agg._sum.errorCount ?? 0;

        const existing = await this.prisma.studentLessonConfig.findUnique({
          where: { studentId_lessonId: { studentId: student.id, lessonId: lesson.id } },
        });

        const currentN = existing?.nRepetitionsOverride ?? lesson.nRepetitions;
        const newN = this.computeNewN(currentN, errorCount, totalQuestions, config);

        if (newN === currentN) continue;

        await this.prisma.studentLessonConfig.upsert({
          where: { studentId_lessonId: { studentId: student.id, lessonId: lesson.id } },
          create: { studentId: student.id, lessonId: lesson.id, nRepetitionsOverride: newN },
          update: { nRepetitionsOverride: newN },
        });

        await this.prisma.adaptiveDifficultyLog.create({
          data: {
            studentId: student.id,
            lessonId: lesson.id,
            oldN: currentN,
            newN,
            errorRate: errorCount / totalQuestions,
          },
        });

        adjusted++;
      }
    }

    this.logger.log(`Tenant ${tenantId}: ${adjusted} adaptatsiya amalga oshirildi`);
    return adjusted;
  }
}
