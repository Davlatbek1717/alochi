import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Cron } from '@nestjs/schedule';
import { chatText } from '../ai/llm-client';

const PARENT_MSG_SYSTEM = `Sen A'lojon ta'lim platformasida o'quvchining mentori sifatida ota-onaga haftalik xat yozyapsan.
Samimiy, qisqa va xushmuomala bo'l. O'zbek tilida yoz. Faktlarga asoslan — mubolag'a qilma.
Yutqiziqlar va muammolar ikkalasini ham qayd et. Amaliy maslahat ber.`;

@Injectable()
export class ParentMessagesService {
  constructor(private prisma: PrismaService) {}

  @Cron('0 8 * * 1', { timeZone: 'Asia/Tashkent' })
  async sendWeeklyMessages() {
    const tenants = await this.prisma.tenant.findMany({ select: { id: true } });
    for (const t of tenants) {
      await this.generateForTenant(t.id).catch(() => {});
    }
  }

  async generateForTenant(tenantId: string): Promise<void> {
    const students = await this.prisma.user.findMany({
      where: { tenantId, role: 'student', status: 'active' },
      select: { id: true, name: true, telegramId: true },
    });
    for (const student of students) {
      await this.generateForStudent(student.id, tenantId).catch(() => {});
    }
  }

  async generateForStudent(studentId: string, tenantId: string): Promise<void> {
    const data = await this.gatherStudentWeeklyData(studentId, tenantId);
    if (!data.parentTgId) return;

    const content = await this.callLlm(data);

    await this.prisma.parentMessage.create({
      data: {
        id: `${studentId}:${Date.now()}`,
        studentId,
        parentTgId: data.parentTgId as string,
        messageType: 'weekly',
        content,
        tenantId,
      },
    });
  }

  private async gatherStudentWeeklyData(
    studentId: string,
    tenantId: string,
  ): Promise<Record<string, unknown>> {
    const ago7 = new Date(Date.now() - 7 * 86_400_000);

    const [student, progressTotal, progressDone, videoCounts, warnings] =
      await Promise.all([
        this.prisma.user.findFirst({
          where: { id: studentId, tenantId },
          select: {
            name: true,
            parentName: true,
            parentPhone: true,
            telegramId: true,
          },
        }),
        this.prisma.studentProgress.count({
          where: { lesson: { tenantId }, studentId, lastActivityAt: { gte: ago7 } },
        }),
        this.prisma.studentProgress.count({
          where: { lesson: { tenantId }, studentId, completedAt: { gte: ago7 } },
        }),
        this.prisma.videoCheckin.groupBy({
          by: ['status'],
          where: { studentId, student: { tenantId }, createdAt: { gte: ago7 } },
          _count: { status: true },
        }),
        this.prisma.warning.count({
          where: { studentId, tenantId, isCancelled: false },
        }),
      ]);

    const videoMap = Object.fromEntries(
      videoCounts.map((v) => [v.status, v._count.status]),
    );

    const passRate =
      progressTotal > 0 ? Math.round((progressDone / progressTotal) * 100) : 0;

    return {
      studentName: student?.name ?? 'O\'quvchi',
      parentName: student?.parentName ?? 'Hurmatli ota-ona',
      parentTgId: student?.telegramId ? String(student.telegramId) : null,
      weeklyLessons: progressTotal,
      passRate,
      videoCheckinOk: videoMap['approved'] ?? 0,
      videoCheckinMissed: videoMap['missed'] ?? 0,
      activeWarnings: warnings,
    };
  }

  private async callLlm(data: Record<string, unknown>): Promise<string> {
    try {
      return await chatText(
        [
          { role: 'system', content: PARENT_MSG_SYSTEM },
          {
            role: 'user',
            content: `Quyidagi ma'lumotlar asosida ota-onaga haftalik xat yoz:\n${JSON.stringify(data, null, 2)}`,
          },
        ],
        { temperature: 0.7 },
      );
    } catch {
      return `Hurmatli ${data.parentName}, bu hafta farzandingiz ${data.studentName} darslarini davom ettirmoqda.`;
    }
  }

  // ── Queries ───────────────────────────────────────────────────────────────

  async getForStudent(studentId: string, tenantId: string) {
    return this.prisma.parentMessage.findMany({
      where: { studentId, tenantId },
      orderBy: { generatedAt: 'desc' },
      take: 20,
    });
  }

  async sendAlert(
    studentId: string,
    tenantId: string,
    content: string,
  ) {
    const student = await this.prisma.user.findFirst({
      where: { id: studentId, tenantId },
      select: { telegramId: true },
    });
    if (!student?.telegramId) return null;

    return this.prisma.parentMessage.create({
      data: {
        id: `${studentId}:alert:${Date.now()}`,
        studentId,
        parentTgId: String(student.telegramId),
        messageType: 'alert',
        content,
        tenantId,
      },
    });
  }
}
