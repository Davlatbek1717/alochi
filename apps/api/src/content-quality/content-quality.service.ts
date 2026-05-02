import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ContentQualityService {
  constructor(private prisma: PrismaService) {}

  private async assertLessonOwnership(
    lessonId: string,
    tenantId: string,
  ): Promise<void> {
    const lesson = await this.prisma.lesson.findFirst({
      where: { id: lessonId, tenantId },
    });
    if (!lesson) throw new Error("Dars topilmadi yoki ruxsat yo'q");
  }

  async getLessonStats(tenantId: string) {
    const lessons = await this.prisma.lesson.findMany({
      where: { tenantId, isPublished: true },
      select: { id: true, title: true },
    });

    return Promise.all(
      lessons.map(async (lesson) => {
        const [total, passed, feedbackAgg, sessionsAgg] = await Promise.all([
          this.prisma.studentProgress.count({ where: { lessonId: lesson.id } }),
          this.prisma.studentProgress.count({
            where: { lessonId: lesson.id, academyCompleted: true },
          }),
          this.prisma.lessonFeedback.aggregate({
            where: { lessonId: lesson.id },
            _avg: { rating: true },
            _count: true,
          }),
          this.prisma.studentProgress.aggregate({
            where: { lessonId: lesson.id },
            _avg: { sessionCount: true },
          }),
        ]);

        const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;
        const avgSessionsRaw = sessionsAgg._avg?.sessionCount ?? 0;
        const avgSessions =
          Math.round((Number(avgSessionsRaw) || 0) * 100) / 100;
        return {
          lessonId: lesson.id,
          title: lesson.title,
          passRate,
          totalStudents: total,
          feedbackAvg:
            feedbackAgg._avg.rating != null
              ? Number(feedbackAgg._avg.rating)
              : null,
          feedbackCount: feedbackAgg._count,
          avgSessions,
        };
      }),
    );
  }

  async submitFeedback(studentId: string, lessonId: string, rating: number) {
    if (rating < 1 || rating > 3) {
      throw new BadRequestException("Rating 1, 2 yoki 3 bo'lishi kerak");
    }
    return this.prisma.lessonFeedback.upsert({
      where: { studentId_lessonId: { studentId, lessonId } },
      create: { studentId, lessonId, rating },
      update: { rating },
    });
  }

  async createVariant(lessonId: string, config: object, tenantId: string) {
    await this.assertLessonOwnership(lessonId, tenantId);
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
    try {
      return await this.prisma.studentVariantAssignment.create({
        data: { studentId, lessonId, variantId: chosen.id },
      });
    } catch {
      return this.prisma.studentVariantAssignment.findUnique({
        where: { studentId_lessonId: { studentId, lessonId } },
      });
    }
  }

  /**
   * Same as getVariantForStudent but joins the LessonVariant row so
   * the caller gets the variant letter ('A' | 'B') and its differential
   * config in one round-trip. Returns null when this lesson has no
   * active variants — caller should fall through to the default
   * (un-variant) lesson rendering. This is what the student lesson
   * runner uses to actually apply A/B differences (§21.4).
   */
  async getVariantPayloadForStudent(studentId: string, lessonId: string) {
    const assignment = await this.getVariantForStudent(studentId, lessonId);
    if (!assignment) return null;
    const variant = await this.prisma.lessonVariant.findUnique({
      where: { id: assignment.variantId },
      select: { id: true, variant: true, config: true, isActive: true },
    });
    if (!variant || !variant.isActive) return null;
    return {
      assignmentId: assignment.id,
      variantId: variant.id,
      variant: variant.variant, // 'A' | 'B'
      config: variant.config, // Json — currently { maxComponents?: number, notes?: string }
    };
  }

  async getABResults(lessonId: string, tenantId: string) {
    await this.assertLessonOwnership(lessonId, tenantId);
    const variants = await this.prisma.lessonVariant.findMany({
      where: { lessonId },
      select: { id: true, variant: true },
    });

    return Promise.all(
      variants.map(async (v) => {
        const assignments = await this.prisma.studentVariantAssignment.findMany(
          {
            where: { variantId: v.id },
            select: { studentId: true },
          },
        );
        const studentIds = assignments.map((a) => a.studentId);
        if (studentIds.length === 0)
          return { variant: v.variant, students: 0, passRate: 0 };

        const [total, passed] = await Promise.all([
          this.prisma.studentProgress.count({
            where: { lessonId, studentId: { in: studentIds } },
          }),
          this.prisma.studentProgress.count({
            where: {
              lessonId,
              studentId: { in: studentIds },
              academyCompleted: true,
            },
          }),
        ]);

        return {
          variant: v.variant,
          students: studentIds.length,
          passRate: total > 0 ? Math.round((passed / total) * 100) : 0,
        };
      }),
    );
  }

  async promoteVariant(lessonId: string, winner: 'A' | 'B', tenantId: string) {
    await this.assertLessonOwnership(lessonId, tenantId);
    await this.prisma.lessonVariant.updateMany({
      where: { lessonId, variant: { not: winner } },
      data: { isActive: false },
    });
    return { promoted: winner };
  }
}
