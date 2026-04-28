import { Injectable, Logger } from '@nestjs/common';
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
  ) {}

  computeScore(signals: ChurnSignals): number {
    let raw = 0;
    if (signals.absent3Days) raw += 30;
    if (signals.streakBroken) raw += 20;
    if (signals.passRateDrop) raw += 25;
    if (signals.redStatus) raw += 25;
    if (signals.noParentTg) raw += 10;
    return Math.min(raw, 100);
  }

  async getHighRiskStudents(tenantId: string, branchId?: string) {
    return this.prisma.churnScore.findMany({
      where: {
        tenantId,
        score: { gt: 60 },
        ...(branchId ? { student: { branchId } } : {}),
      },
      include: { student: { select: { id: true, name: true, branchId: true } } },
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
      include: { student: { select: { id: true, name: true, branchId: true } } },
      orderBy: { score: 'desc' },
    });
  }

  async runDailyScoring(tenantId: string) {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

    const students = await this.prisma.user.findMany({
      where: { tenantId, role: 'student', status: 'active' },
      select: { id: true, parentTelegramId: true, branchId: true },
    });

    for (const student of students) {
      const [absenceCount, xp, thisWeekPassed, lastWeekPassed, latestStatus] = await Promise.all([
        this.prisma.attendanceStudent.count({
          where: { studentId: student.id, date: { gte: threeDaysAgo }, status: 'absent' },
        }),
        this.prisma.studentXp.findUnique({ where: { studentId: student.id } }),
        this.prisma.studentProgress.count({
          where: { studentId: student.id, academyCompleted: true, completedAt: { gte: sevenDaysAgo } },
        }),
        this.prisma.studentProgress.count({
          where: { studentId: student.id, academyCompleted: true, completedAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo } },
        }),
        this.prisma.studentStatus.findFirst({
          where: { studentId: student.id },
          orderBy: { date: 'desc' },
        }),
      ]);

      const signals: ChurnSignals = {
        absent3Days: absenceCount >= 3,
        streakBroken: (xp?.currentStreak ?? 0) === 0,
        passRateDrop: lastWeekPassed > 0 && thisWeekPassed < lastWeekPassed * 0.8,
        redStatus: latestStatus?.englishStatus === 'qizil' || latestStatus?.personalStatus === 'qizil',
        noParentTg: !student.parentTelegramId,
      };

      const score = this.computeScore(signals);

      const existing = await this.prisma.churnScore.findUnique({ where: { studentId: student.id } });
      const wasHighRisk = (existing?.score ?? 0) > 60;
      const isHighRisk = score > 60;
      const alertAlreadySent = existing?.alertSent ?? false;

      await this.prisma.churnScore.upsert({
        where: { studentId: student.id },
        create: { studentId: student.id, tenantId, score, signals: signals as any, alertSent: false },
        update: { score, signals: signals as any, alertSent: isHighRisk ? alertAlreadySent : false },
      });

      if (isHighRisk && !alertAlreadySent) {
        const managers = await this.prisma.user.findMany({
          where: { tenantId, role: 'manager', branchId: student.branchId ?? undefined },
          select: { id: true },
        });
        for (const mgr of managers) {
          await this.notifications
            .send(mgr.id, 'churn', "Yuqori xavfli o'quvchi", `Ball: ${score}`, { studentId: student.id, score, signals })
            .catch(() => {});
        }
        await this.prisma.churnScore.update({ where: { studentId: student.id }, data: { alertSent: true } });
      }

      if (!isHighRisk && wasHighRisk) {
        await this.prisma.churnScore.update({ where: { studentId: student.id }, data: { alertSent: false } });
      }
    }

    this.logger.log(`Tenant ${tenantId}: churn scoring yakunlandi`);
  }
}
