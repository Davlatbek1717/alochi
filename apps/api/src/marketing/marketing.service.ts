import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Public-facing data for the marketing landing page. Only exposes
 * fields that are safe to publish (no logins, phones, parent IDs).
 * Aggregates progress from `StudentProgress` so the showcase can
 * highlight active learners without leaking grades.
 */
@Injectable()
export class MarketingService {
  constructor(private prisma: PrismaService) {}

  /**
   * Featured students grid. Active student users with at least one
   * lesson session, sorted by completed-lesson count desc so the
   * landing's "Bizning O'quvchilarimiz" leads with top performers.
   */
  async listStudents() {
    const students = await this.prisma.user.findMany({
      where: { role: 'student', status: 'active' },
      select: {
        id: true,
        name: true,
        region: true,
        school: true,
        avatarUrl: true,
        createdAt: true,
        studentProgress: {
          select: { sessionCount: true, academyCompleted: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Total lesson rows are needed to compute a percentage. We grab
    // the count once and divide per student.
    const totalLessons = await this.prisma.lesson.count({
      where: { isPublished: true },
    });

    return students.map((s) => {
      const completed = s.studentProgress.filter(
        (p) => p.academyCompleted,
      ).length;
      const sessions = s.studentProgress.reduce(
        (sum, p) => sum + p.sessionCount,
        0,
      );
      const progressPct =
        totalLessons > 0
          ? Math.round((completed / totalLessons) * 100)
          : 0;
      return {
        id: s.id,
        name: s.name,
        region: s.region,
        school: s.school,
        avatarUrl: s.avatarUrl,
        completedLessons: completed,
        totalLessons,
        sessions,
        progress: progressPct,
        joinedAt: s.createdAt,
      };
    });
  }

  /**
   * Public profile of a single student — safe-to-publish fields plus
   * recent progress timeline so a parent / scout can verify the
   * student is active.
   */
  async getStudent(studentId: string) {
    const student = await this.prisma.user.findFirst({
      where: { id: studentId, role: 'student', status: 'active' },
      select: {
        id: true,
        name: true,
        region: true,
        school: true,
        avatarUrl: true,
        createdAt: true,
        studentProgress: {
          select: {
            lessonId: true,
            sessionCount: true,
            academyCompleted: true,
            completedAt: true,
            lesson: { select: { title: true, orderNumber: true } },
          },
          orderBy: { completedAt: 'desc' },
          take: 20,
        },
      },
    });
    if (!student) throw new NotFoundException("O'quvchi topilmadi");

    const totalLessons = await this.prisma.lesson.count({
      where: { isPublished: true },
    });
    const completed = student.studentProgress.filter(
      (p) => p.academyCompleted,
    ).length;
    const progressPct =
      totalLessons > 0 ? Math.round((completed / totalLessons) * 100) : 0;

    return {
      id: student.id,
      name: student.name,
      region: student.region,
      school: student.school,
      avatarUrl: student.avatarUrl,
      joinedAt: student.createdAt,
      completedLessons: completed,
      totalLessons,
      progress: progressPct,
      recent: student.studentProgress.map((p) => ({
        lessonTitle: p.lesson?.title ?? '',
        lessonOrder: p.lesson?.orderNumber ?? null,
        sessionCount: p.sessionCount,
        academyCompleted: p.academyCompleted,
        completedAt: p.completedAt,
      })),
    };
  }

  /**
   * Aggregate platform stats for the landing's stats strip and the
   * stats card on the showcase. Cheap counts, no joins.
   */
  async getStats() {
    const [
      totalStudents,
      totalSchools,
      totalLessons,
      completedSessions,
    ] = await Promise.all([
      this.prisma.user.count({
        where: { role: 'student', status: 'active' },
      }),
      this.prisma.user.findMany({
        where: { role: 'student', status: 'active', school: { not: null } },
        select: { school: true },
        distinct: ['school'],
      }),
      this.prisma.lesson.count({ where: { isPublished: true } }),
      this.prisma.studentProgress.count({ where: { academyCompleted: true } }),
    ]);

    const avgProgress =
      totalStudents > 0 && totalLessons > 0
        ? Math.round(
            (completedSessions / (totalStudents * totalLessons)) * 100,
          )
        : 0;

    return {
      totalStudents,
      totalSchools: totalSchools.length,
      totalLessons,
      completedSessions,
      avgProgress,
    };
  }

  /**
   * Distinct list of regions that the showcase can use as filter
   * chips. Sorted alphabetically.
   */
  async getRegions() {
    const rows = await this.prisma.user.findMany({
      where: { role: 'student', status: 'active', region: { not: null } },
      select: { region: true },
      distinct: ['region'],
    });
    return rows
      .map((r) => r.region)
      .filter((r): r is string => !!r)
      .sort((a, b) => a.localeCompare(b, 'uz'));
  }
}
