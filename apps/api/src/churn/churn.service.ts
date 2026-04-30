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
    streak_value: number;
    lessons_completed_30d: number;
    lessons_failed_30d: number;
    has_red_status: number;
    has_parent_tg: number;
    pass_rate_30d: number;
  }> {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [user, xp, events, status] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: studentId },
        select: { parentTelegramId: true },
      }),
      this.prisma.studentXp.findUnique({ where: { studentId } }),
      this.prisma.analyticsEvent.findMany({
        where: { studentId, createdAt: { gte: since } },
        select: { eventType: true },
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

    // Absent days from attendance table using status field
    const absentEvents = await this.prisma.attendanceStudent
      .count({
        where: { studentId, date: { gte: since }, status: 'absent' },
      })
      .catch(() => 0);

    return {
      absent_days_30d: absentEvents,
      streak_value: xp?.currentStreak ?? 0,
      lessons_completed_30d: lessonsCompleted,
      lessons_failed_30d: lessonsFailed,
      has_red_status: status?.englishStatus === 'qizil' ? 1 : 0,
      has_parent_tg: user?.parentTelegramId ? 1 : 0,
      pass_rate_30d:
        totalLessons > 0
          ? Math.round((lessonsCompleted * 100) / totalLessons)
          : 0,
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
    // Convert features to legacy signal format and use rule-based scoring
    const signals = {
      absent3Days: (features.absent_days_30d as number) >= 3,
      streakBroken: (features.streak_value as number) === 0,
      passRateDrop: (features.pass_rate_30d as number) < 50,
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
