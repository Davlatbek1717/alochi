import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { Cron } from '@nestjs/schedule';
import { chatText } from '../ai/llm-client';

const BRIEFING_SYSTEM_PROMPT = `Sen A'lojon ta'lim platformasining boshqaruv yordamchisisan.
Ozodbekka professional, qisqa, harakatga undovchi ohangda hisobot ber. Uzbek tilida yoz.
Raqamlar va faktlarga asoslan. Mubolag'a qilma.`;

@Injectable()
export class BriefingService {
  constructor(private prisma: PrismaService) {}

  @Cron('50 6 * * *', { timeZone: 'Asia/Tashkent' })
  async generateForAllTenants() {
    const tenants = await this.prisma.tenant.findMany({ select: { id: true } });
    for (const t of tenants) {
      await this.generateForTenant(t.id).catch(() => {});
    }
  }

  async generateForTenant(tenantId: string): Promise<void> {
    // Find superadmin users for this tenant
    const managers = await this.prisma.user.findMany({
      where: { tenantId, role: { in: ['superadmin', 'manager'] }, status: 'active' },
      select: { id: true, telegramId: true },
    });

    for (const user of managers) {
      await this.generateForUser(tenantId, user.id).catch(() => {});
    }
  }

  async generateForUser(tenantId: string, forUserId: string): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const rawData = await this.aggregateData(tenantId);
    const generatedText = await this.callLlm(rawData);

    await this.prisma.dailyBriefing.upsert({
      where: { tenantId_forUserId_date: { tenantId, forUserId, date: today } },
      create: {
        id: `${tenantId}:${forUserId}:${today.toISOString().slice(0, 10)}`,
        tenantId,
        forUserId,
        date: today,
        rawData: rawData as Prisma.InputJsonValue,
        generatedText,
      },
      update: { rawData: rawData as Prisma.InputJsonValue, generatedText, delivered: false },
    });
  }

  private async aggregateData(tenantId: string): Promise<Record<string, unknown>> {
    const now = Date.now();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const ago7 = new Date(now - 7 * 86_400_000);

    const [totalStudents, criticalRisks, unresolvedCheating, pendingVisits, completedToday] =
      await Promise.all([
        this.prisma.user.count({ where: { tenantId, role: 'student', status: 'active' } }),
        this.prisma.riskScore.count({
          where: { tenantId, band: 'critical', date: todayStart },
        }),
        this.prisma.cheatingSignal.count({
          where: { tenantId, resolvedAt: null },
        }),
        this.prisma.homeVisit.count({
          where: { tenantId, status: 'planned', scheduledFor: { gte: todayStart } },
        }),
        this.prisma.homeVisit.count({
          where: { tenantId, status: 'completed', completedAt: { gte: todayStart } },
        }),
      ]);

    return {
      date: todayStart.toISOString().slice(0, 10),
      totalStudents,
      criticalRisks,
      unresolvedCheating,
      pendingVisits,
      completedToday,
      generatedAt: new Date().toISOString(),
    };
  }

  private async callLlm(data: Record<string, unknown>): Promise<string> {
    try {
      return await chatText(
        [
          { role: 'system', content: BRIEFING_SYSTEM_PROMPT },
          {
            role: 'user',
            content: `Quyidagi ma'lumotlar asosida bugungi holat sharhini yoz:\n${JSON.stringify(data, null, 2)}`,
          },
        ],
        { temperature: 0.6 },
      );
    } catch {
      return `Briefing generatsiya qilinmadi. Ma'lumotlar: ${JSON.stringify(data)}`;
    }
  }

  // ── Queries ───────────────────────────────────────────────────────────────

  async getToday(tenantId: string, userId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const briefing = await this.prisma.dailyBriefing.findUnique({
      where: { tenantId_forUserId_date: { tenantId, forUserId: userId, date: today } },
    });
    if (!briefing) throw new NotFoundException('Bugungi briefing hali tayyorlanmagan');
    return briefing;
  }

  async getByDate(tenantId: string, userId: string, date: string) {
    const d = new Date(date);
    const briefing = await this.prisma.dailyBriefing.findUnique({
      where: { tenantId_forUserId_date: { tenantId, forUserId: userId, date: d } },
    });
    if (!briefing) throw new NotFoundException('Briefing topilmadi');
    return briefing;
  }

  async regenerate(tenantId: string, userId: string) {
    await this.generateForUser(tenantId, userId);
    return this.getToday(tenantId, userId);
  }
}
