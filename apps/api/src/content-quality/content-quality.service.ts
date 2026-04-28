import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ContentQualityService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  async getLessonStats(tenantId: string) {
    const lessons = await this.prisma.lesson.findMany({
      where: { tenantId, isPublished: true },
      select: { id: true, title: true },
    });

    return Promise.all(
      lessons.map(async (lesson) => {
        const [total, passed, feedbackAgg] = await Promise.all([
          this.prisma.studentProgress.count({ where: { lessonId: lesson.id } }),
          this.prisma.studentProgress.count({ where: { lessonId: lesson.id, academyCompleted: true } }),
          this.prisma.lessonFeedback.aggregate({
            where: { lessonId: lesson.id },
            _avg: { rating: true },
            _count: true,
          }),
        ]);

        const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;
        return {
          lessonId: lesson.id,
          title: lesson.title,
          passRate,
          totalStudents: total,
          feedbackAvg: feedbackAgg._avg.rating != null ? Number(feedbackAgg._avg.rating) : null,
          feedbackCount: feedbackAgg._count,
        };
      }),
    );
  }

  async submitFeedback(studentId: string, lessonId: string, rating: number) {
    return this.prisma.lessonFeedback.upsert({
      where: { studentId_lessonId: { studentId, lessonId } },
      create: { studentId, lessonId, rating },
      update: { rating },
    });
  }

  async createVariant(lessonId: string, config: object) {
    return this.prisma.lessonVariant.create({
      data: { lessonId, variant: 'B', config },
    });
  }

  async getVariantForStudent(studentId: string, lessonId: string) {
    const existing = await this.prisma.studentVariantAssignment.findUnique({
      where: { studentId_lessonId: { studentId, lessonId } },
    });
    if (existing) return existing;

    const variants = await this.prisma.lessonVariant.findMany({
      where: { lessonId, isActive: true },
      select: { id: true, variant: true },
    });
    if (variants.length === 0) return null;

    const chosen = variants[Math.floor(Math.random() * variants.length)];
    return this.prisma.studentVariantAssignment.create({
      data: { studentId, lessonId, variantId: chosen.id },
    });
  }

  async getABResults(lessonId: string) {
    const variants = await this.prisma.lessonVariant.findMany({
      where: { lessonId },
      select: { id: true, variant: true },
    });

    return Promise.all(
      variants.map(async (v) => {
        const assignments = await this.prisma.studentVariantAssignment.findMany({
          where: { variantId: v.id },
          select: { studentId: true },
        });
        const studentIds = assignments.map((a) => a.studentId);
        if (studentIds.length === 0) return { variant: v.variant, students: 0, passRate: 0 };

        const [total, passed] = await Promise.all([
          this.prisma.studentProgress.count({ where: { lessonId, studentId: { in: studentIds } } }),
          this.prisma.studentProgress.count({ where: { lessonId, studentId: { in: studentIds }, academyCompleted: true } }),
        ]);

        return {
          variant: v.variant,
          students: studentIds.length,
          passRate: total > 0 ? Math.round((passed / total) * 100) : 0,
        };
      }),
    );
  }

  async promoteVariant(lessonId: string, winner: 'A' | 'B') {
    await this.prisma.lessonVariant.updateMany({
      where: { lessonId, variant: { not: winner } },
      data: { isActive: false },
    });
    return { promoted: winner };
  }
}
