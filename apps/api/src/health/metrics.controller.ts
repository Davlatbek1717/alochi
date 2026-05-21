import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/auth.guard';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Lightweight operational metrics for internal dashboards.
 * Not a replacement for Prometheus — just a fast snapshot for ops team.
 */
@UseGuards(JwtAuthGuard)
@Controller('metrics/summary')
export class MetricsSummaryController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async getSummary() {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [
      activeStudents,
      activeDevices,
      todayPings,
      criticalRisks,
      pendingVisits,
      unresolvedCheating,
    ] = await Promise.all([
      this.prisma.user.count({ where: { role: 'student', status: 'active' } }),
      this.prisma.device.count({ where: { status: 'active' } }),
      this.prisma.studyTimeDaily.count({ where: { date: todayStart } }),
      this.prisma.riskScore.count({ where: { band: 'critical', date: todayStart } }),
      this.prisma.homeVisit.count({ where: { status: 'planned', scheduledFor: { gte: todayStart } } }),
      this.prisma.cheatingSignal.count({ where: { resolvedAt: null } }),
    ]);

    return {
      timestamp: new Date().toISOString(),
      activeStudents,
      activeDevices,
      studyPingsToday: todayPings,
      criticalRiskStudents: criticalRisks,
      pendingVisitsToday: pendingVisits,
      unresolvedCheatingSignals: unresolvedCheating,
    };
  }
}
