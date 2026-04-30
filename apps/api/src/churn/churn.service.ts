import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

interface ChurnSignals {
  absent3Days: boolean;
  streakBroken: boolean;
  passRateDrop: boolean;
  redStatus: boolean;
  noParentTg: boolean;
}

@Injectable()
export class ChurnService {
  private readonly logger = new Logger(ChurnService.name);

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private http: HttpService,
    private config: ConfigService,
  ) {}

  computeScoreRuleBased(signals: ChurnSignals): number {
    let raw = 0;
    if (signals.absent3Days) raw += 30;
    if (signals.streakBroken) raw += 20;
    if (signals.passRateDrop) raw += 25;
    if (signals.redStatus) raw += 25;
    if (signals.noParentTg) raw += 10;
    return Math.min(raw, 100);
  }

  async computeScoreML(studentId: string): Promise<{
    score: number;
    signals: Record<string, unknown>;
    method: 'ml' | 'rule_fallback';
  }> {
    // Build features from PG
    const features = await this.buildFeatures(studentId);

    const mlUrl = this.config.get<string>('ML_SERVICE_URL');
    const timeout = parseInt(
      this.config.get<string>('ML_SERVICE_TIMEOUT_MS') ?? '2000',
      10,
    );

    if (!mlUrl) {
      return this.fallbackScore(studentId, features, 'no_ml_url');
    }

    try {
      const response = await firstValueFrom(
        this.http.post(`${mlUrl}/predict`, { features }, { timeout }),
      );
      const data = response.data as {
        probability: number;
        score: number;
        modelVersion?: string;
      };
      return {
        score: data.score,
        signals: {
          ...features,
          mlProbability: data.probability,
          modelVersion: data.modelVersion ?? null,
        },
        method: 'ml',
      };
    } catch (e) {
      this.logger.warn(
        `ML service failed (${(e as Error).message}), falling back to rules`,
      );
      return this.fallbackScore(studentId, features, 'ml_error');
    }
  }

  private async buildFeatures(studentId: string): Promise<{
    absent_days_30d: number;
    consecutive_absent_3d: number;
    streak_value: number;
    lessons_completed_30d: number;
    lessons_failed_30d: number;
    has_red_status: number;
    has_parent_tg: number;
    pass_rate_30d: number;
    pass_rate_change: number;
    avg_session_count: number;
    xp_gained_7d: number;
  }> {
    const now = Date.now();
    const since30 = new Date(now - 30 * 24 * 60 * 60 * 1000);
    const since7 = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const since14 = new Date(now - 14 * 24 * 60 * 60 * 1000);

    const [user, xp, events, status] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: studentId },
        select: { parentTelegramId: true },
      }),
      this.prisma.studentXp.findUnique({ where: { studentId } }),
      this.prisma.analyticsEvent.findMany({
        where: { studentId, createdAt: { gte: since30 } },
        select: { eventType: true, createdAt: true },
      }),
      this.prisma.studentStatus.findFirst({ where: { studentId } }),
    ]);

    const lessonsCompleted = events.filter(
      (e) => e.eventType === 'lesson_completed',
    ).length;
    const lessonsFailed = events.filter(
      (e) => e.eventType === 'lesson_failed',
    ).length;
    const totalLessons = lessonsCompleted + lessonsFailed;

    // Pass-rate change = (this week's pass rate) - (last week's pass rate).
    // Each window uses analytics_events.lesson_completed / lesson_failed.
    const passRateForWindow = (start: Date, end: Date): number => {
      let c = 0;
      let f = 0;
      for (const e of events) {
        if (e.createdAt < start || e.createdAt >= end) continue;
        if (e.eventType === 'lesson_completed') c++;
        else if (e.eventType === 'lesson_failed') f++;
      }
      const t = c + f;
      return t > 0 ? (c * 100) / t : 0;
    };
    const nowDate = new Date(now);
    const passRateThisWeek = passRateForWindow(since7, nowDate);
    const passRateLastWeek = passRateForWindow(since14, since7);
    const passRateChange =
      Math.round((passRateThisWeek - passRateLastWeek) * 100) / 100;

    // Absent days from attendance table using status field (30-day count).
    const absentEvents = await this.prisma.attendanceStudent
      .count({
        where: { studentId, date: { gte: since30 }, status: 'absent' },
      })
      .catch(() => 0);

    // Phase 23.12: consecutive 3-day absence signal. Look at the last 3
    // calendar days (today, yesterday, day-before): if every record for those
    // days has status='absent' AND there are 3 records (one per day), the
    // signal fires. If any day has 'present' or 'late', signal=0.
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const since3Days = new Date(
      startOfToday.getTime() - 2 * 24 * 60 * 60 * 1000,
    );
    const recent3 = await this.prisma.attendanceStudent
      .findMany({
        where: { studentId, date: { gte: since3Days } },
        select: { date: true, status: true },
      })
      .catch(() => [] as Array<{ date: Date; status: string }>);
    const dayKeys = new Set<string>();
    for (const r of recent3) {
      if (r.status === 'absent') {
        dayKeys.add(new Date(r.date).toISOString().slice(0, 10));
      } else {
        // Any non-absent record breaks the streak.
        dayKeys.clear();
        break;
      }
    }
    const consecutiveAbsent3d = dayKeys.size >= 3 ? 1 : 0;

    // Mean StudentProgress.sessionCount over last 30 days (last_activity_at or completed_at).
    const avgSessionCount = await this.prisma.studentProgress
      .aggregate({
        where: {
          studentId,
          OR: [
            { lastActivityAt: { gte: since30 } },
            { completedAt: { gte: since30 } },
          ],
        },
        _avg: { sessionCount: true },
      })
      .then(
        (r: { _avg: { sessionCount: number | null } }) =>
          r._avg.sessionCount ?? 0,
      )
      .catch(() => 0);

    // XP gained in last 7 days (sum of XpEvent.amount).
    const xpGained7d = await this.prisma.xpEvent
      .aggregate({
        where: { studentId, createdAt: { gte: since7 } },
        _sum: { amount: true },
      })
      .then((r: { _sum: { amount: number | null } }) => r._sum.amount ?? 0)
      .catch(() => 0);

    return {
      absent_days_30d: absentEvents,
      consecutive_absent_3d: consecutiveAbsent3d,
      streak_value: xp?.currentStreak ?? 0,
      lessons_completed_30d: lessonsCompleted,
      lessons_failed_30d: lessonsFailed,
      // Phase 23.12: redStatus fires when EITHER english OR personal status
      // is 'qizil' (was previously english-only).
      has_red_status:
        status?.englishStatus === 'qizil' || status?.personalStatus === 'qizil'
          ? 1
          : 0,
      has_parent_tg: user?.parentTelegramId ? 1 : 0,
      pass_rate_30d:
        totalLessons > 0
          ? Math.round((lessonsCompleted * 100) / totalLessons)
          : 0,
      pass_rate_change: passRateChange,
      avg_session_count: Math.round(avgSessionCount * 100) / 100,
      xp_gained_7d: xpGained7d,
    };
  }

  private async fallbackScore(
    studentId: string,
    features: Record<string, unknown>,
    reason: string,
  ): Promise<{
    score: number;
    signals: Record<string, unknown>;
    method: 'rule_fallback';
  }> {
    // Phase 23.12: corrected semantics.
    //   absent3Days  = 3 *consecutive* calendar days absent (was 30-day count).
    //   passRateDrop = (prev week - curr week) >= 20 percentage points
    //                  (was a flat <50% test).
    //   redStatus    = englishStatus OR personalStatus === 'qizil'
    //                  (already wired in buildFeatures via has_red_status).
    const signals = {
      absent3Days: (features.consecutive_absent_3d as number) === 1,
      streakBroken: (features.streak_value as number) === 0,
      passRateDrop: (features.pass_rate_change as number) <= -20,
      redStatus: features.has_red_status === 1,
      noParentTg: features.has_parent_tg === 0,
    };
    const score = this.computeScoreRuleBased(signals);
    return {
      score,
      signals: { ...features, ...signals, fallbackReason: reason },
      method: 'rule_fallback',
    };
  }

  async getHighRiskStudents(tenantId: string, branchId?: string) {
    return this.prisma.churnScore.findMany({
      where: {
        tenantId,
        score: { gt: 60 },
        ...(branchId ? { student: { branchId } } : {}),
      },
      include: {
        student: { select: { id: true, name: true, branchId: true } },
      },
      orderBy: { score: 'desc' },
    });
  }

  async getMediumRiskStudents(tenantId: string, branchId?: string) {
    return this.prisma.churnScore.findMany({
      where: {
        tenantId,
        score: { gte: 31, lte: 60 },
        ...(branchId ? { student: { branchId } } : {}),
      },
      include: {
        student: { select: { id: true, name: true, branchId: true } },
      },
      orderBy: { score: 'desc' },
    });
  }

  async runDailyScoring(tenantId: string) {
    const students = await this.prisma.user.findMany({
      where: { tenantId, role: 'student', status: 'active' },
      select: { id: true, parentTelegramId: true, branchId: true },
    });

    for (const student of students) {
      const { score, signals } = await this.computeScoreML(student.id);

      const existing = await this.prisma.churnScore.findUnique({
        where: { studentId: student.id },
      });
      const prevAlertSent = existing?.alertSent ?? false;
      const isHighRisk = score > 60;

      await this.prisma.churnScore.upsert({
        where: { studentId: student.id },
        create: {
          studentId: student.id,
          tenantId,
          score,
          signals: signals as any,
          alertSent: isHighRisk,
        },
        update: { score, signals: signals as any, alertSent: isHighRisk },
      });

      if (isHighRisk && !prevAlertSent) {
        const managers = await this.prisma.user.findMany({
          where: {
            tenantId,
            role: 'manager',
            branchId: student.branchId ?? undefined,
          },
          select: { id: true },
        });
        for (const mgr of managers) {
          await this.notifications
            .send(mgr.id, 'churn', "Yuqori xavfli o'quvchi", `Ball: ${score}`, {
              studentId: student.id,
              score,
              signals,
            })
            .catch(() => {});
        }
      }
    }

    this.logger.log(`Tenant ${tenantId}: churn scoring yakunlandi`);
  }
}
