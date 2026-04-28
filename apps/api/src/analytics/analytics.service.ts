import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  async getLessonStats(tenantId: string) {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT lesson_id, pass_rate, total_students, passed, avg_sessions, feedback_avg
       FROM lesson_stats_mv WHERE tenant_id = $1`,
      tenantId,
    );
    return rows.map((r) => ({
      lessonId: r.lesson_id,
      passRate: Number(r.pass_rate),
      totalStudents: Number(r.total_students),
      passed: Number(r.passed),
      avgSessions: Number(r.avg_sessions),
      feedbackAvg: r.feedback_avg != null ? Number(r.feedback_avg) : null,
    }));
  }

  async getBranchStats(tenantId: string) {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT branch_id, active_students, avg_streak, avg_xp
       FROM branch_stats_mv WHERE tenant_id = $1`,
      tenantId,
    );
    return rows.map((r) => ({
      branchId: r.branch_id,
      activeStudents: Number(r.active_students),
      avgStreak: Number(r.avg_streak),
      avgXp: Number(r.avg_xp),
    }));
  }

  async getStudentActivity(tenantId: string, period: 'weekly' | 'monthly') {
    const days = period === 'weekly' ? 7 : 30;
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT DATE_TRUNC('day', created_at)::date::text AS day,
              COUNT(DISTINCT student_id)::text AS count
       FROM analytics_events
       WHERE tenant_id = $1
         AND event_type = 'lesson_completed'
         AND created_at >= NOW() - INTERVAL '${days} days'
       GROUP BY 1 ORDER BY 1`,
      tenantId,
    );
    return rows.map((r) => ({ day: r.day, count: Number(r.count) }));
  }

  async logEvent(params: {
    tenantId: string;
    eventType: string;
    studentId?: string;
    branchId?: string;
    data?: object;
  }) {
    return this.prisma.analyticsEvent.create({
      data: {
        tenantId: params.tenantId,
        eventType: params.eventType,
        studentId: params.studentId ?? null,
        branchId: params.branchId ?? null,
        data: params.data ?? {},
      },
    });
  }
}
