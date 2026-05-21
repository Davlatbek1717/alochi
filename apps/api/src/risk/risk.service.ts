import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Cron } from '@nestjs/schedule';

type Band = 'safe' | 'watch' | 'risk' | 'critical';

function toBand(score: number): Band {
  if (score <= 30) return 'safe';
  if (score <= 60) return 'watch';
  if (score <= 80) return 'risk';
  return 'critical';
}

@Injectable()
export class RiskService {
  constructor(private prisma: PrismaService) {}

  // ── Cron ─────────────────────────────────────────────────────────────────

  @Cron('30 4 * * *', { timeZone: 'Asia/Tashkent' })
  async computeAllTenants() {
    const tenants = await this.prisma.tenant.findMany({ select: { id: true } });
    for (const t of tenants) {
      await this.computeForTenant(t.id).catch(() => {});
    }
  }

  async computeForTenant(tenantId: string) {
    const students = await this.prisma.user.findMany({
      where: { tenantId, role: 'student', status: { not: 'inactive' } },
      select: { id: true },
    });
    for (const s of students) {
      await this.computeForStudent(s.id, tenantId).catch(() => {});
    }
  }

  async computeForStudent(studentId: string, tenantId: string): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [components, prevScore] = await Promise.all([
      this.gatherComponents(studentId, tenantId),
      this.prisma.riskScore.findFirst({
        where: { studentId, tenantId },
        orderBy: { date: 'desc' },
        select: { totalScore: true },
      }),
    ]);

    const componentValues = Object.values(components) as number[];
    const totalScore = Math.min(100, componentValues.reduce((s, v) => s + v, 0));

    const topReasons = Object.entries(components)
      .filter(([, v]) => v > 0)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([k]) => k);

    const prev = prevScore?.totalScore ?? totalScore;
    const diff = totalScore - prev;
    const trend =
      diff <= -5 ? 'improving' : diff >= 5 ? 'declining' : 'stable';

    await this.prisma.riskScore.upsert({
      where: { studentId_date: { studentId, date: today } },
      create: {
        id: `${studentId}:${today.toISOString().slice(0, 10)}`,
        studentId,
        tenantId,
        date: today,
        totalScore,
        components,
        band: toBand(totalScore),
        topReasons,
        trend,
        prevScore: prev,
      },
      update: {
        totalScore,
        components,
        band: toBand(totalScore),
        topReasons,
        trend,
        prevScore: prev,
      },
    });
  }

  private async gatherComponents(
    studentId: string,
    tenantId: string,
  ): Promise<Record<string, number>> {
    const now = Date.now();
    const ago7 = new Date(now - 7 * 86_400_000);
    const ago3 = new Date(now - 3 * 86_400_000);
    const ago14 = new Date(now - 14 * 86_400_000);

    const [progressTotal, progressDone, videoCheckins, warnings, cheating, presence, paymentRow, paymentSetting, latestStatus] =
      await Promise.all([
        // 7-day lessons attempted
        this.prisma.studentProgress.count({
          where: { lesson: { tenantId }, studentId, lastActivityAt: { gte: ago7 } },
        }),
        // 7-day lessons completed
        this.prisma.studentProgress.count({
          where: { lesson: { tenantId }, studentId, completedAt: { gte: ago7 } },
        }),
        // 3-day video checkin misses
        this.prisma.videoCheckin.count({
          where: {
            studentId,
            student: { tenantId },
            status: { in: ['missed', 'rejected'] },
            createdAt: { gte: ago3 },
          },
        }),
        // active (not-cancelled) warnings
        this.prisma.warning.count({
          where: { studentId, tenantId, isCancelled: false },
        }),
        // latest cheating score
        this.prisma.cheatingScore.findFirst({
          where: { studentId, tenantId },
          orderBy: { date: 'desc' },
          select: { score: true },
        }),
        // presence mismatches in 7 days
        this.prisma.presenceCheck.count({
          where: { studentId, tenantId, matched: false, capturedAt: { gte: ago7 } },
        }),
        // payment for current month
        this.prisma.payment.findFirst({
          where: { studentId, tenantId, month: new Date().toISOString().slice(0, 7) },
          select: { paidAt: true },
        }),
        // payment end day setting
        this.prisma.paymentSetting.findFirst({
          where: { tenantId },
          select: { paymentEndDay: true },
        }),
        // latest student status
        this.prisma.studentStatus.findFirst({
          where: { studentId },
          orderBy: { createdAt: 'desc' },
          select: { englishStatus: true, personalStatus: true, criticalStatus: true },
        }),
      ]);

    const passRate =
      progressTotal > 0 ? progressDone / progressTotal : 1;
    const passRateScore = Math.round((1 - passRate) * 15);

    const videoMissScore = Math.min(15, videoCheckins * 5);
    const warningScore = Math.min(10, warnings * 3);
    const cheatingScore = Math.round(((cheating?.score ?? 0) / 100) * 10);
    const presenceScore = Math.min(10, presence * 2);

    // Streak loss: check StudentStreak for recent loss (simple: low streak = risk)
    const streak = await this.prisma.studentStreak.findFirst({
      where: { studentId },
      select: { currentStreak: true, lastActivity: true },
    }).catch(() => null);

    const streakScore =
      streak?.lastActivity && streak.lastActivity < ago14 && streak.currentStreak === 0
        ? 5
        : 0;

    // Payment overdue signal (max 10)
    const currentMonth = new Date().toISOString().slice(0, 7);
    const endDay = paymentSetting?.paymentEndDay ?? 10;
    const todayDay = new Date().getDate();
    const isOverdue = !paymentRow?.paidAt && todayDay > endDay;
    const paymentScore = isOverdue ? 10 : 0;

    // StudentStatus red-flag signal (max 5)
    const redCount = [
      latestStatus?.englishStatus,
      latestStatus?.personalStatus,
      latestStatus?.criticalStatus,
    ].filter((s) => s === 'red').length;
    const studentStatusScore = Math.min(5, redCount * 2);

    return {
      passRate: passRateScore,
      videoCheckin: videoMissScore,
      warnings: warningScore,
      cheating: cheatingScore,
      presence: presenceScore,
      streak: streakScore,
      payment: paymentScore,
      studentStatus: studentStatusScore,
    };
  }

  // ── Queries ───────────────────────────────────────────────────────────────

  async getStudentRisk(studentId: string, tenantId: string) {
    const [today, history] = await Promise.all([
      this.prisma.riskScore.findFirst({
        where: { studentId, tenantId },
        orderBy: { date: 'desc' },
      }),
      this.prisma.riskScore.findMany({
        where: { studentId, tenantId },
        orderBy: { date: 'desc' },
        take: 30,
        select: { date: true, totalScore: true, band: true, trend: true },
      }),
    ]);
    return { today, history };
  }

  async getBranchRisk(branchId: string, tenantId: string, date?: string) {
    const targetDate = date ? new Date(date) : new Date();
    targetDate.setHours(0, 0, 0, 0);

    const students = await this.prisma.user.findMany({
      where: { branchId, tenantId, role: 'student', status: { not: 'inactive' } },
      select: { id: true, name: true },
    });

    const scores = await this.prisma.riskScore.findMany({
      where: {
        studentId: { in: students.map((s) => s.id) },
        date: targetDate,
      },
    });

    const scoreMap = new Map(scores.map((s) => [s.studentId, s]));
    return students.map((s) => ({
      student: s,
      risk: scoreMap.get(s.id) ?? null,
    }));
  }

  async getDistribution(tenantId: string, date?: string) {
    const targetDate = date ? new Date(date) : new Date();
    targetDate.setHours(0, 0, 0, 0);

    const scores = await this.prisma.riskScore.groupBy({
      by: ['band'],
      where: { tenantId, date: targetDate },
      _count: { band: true },
    });

    return {
      safe: 0,
      watch: 0,
      risk: 0,
      critical: 0,
      ...Object.fromEntries(scores.map((s) => [s.band, s._count.band])),
    };
  }
}
