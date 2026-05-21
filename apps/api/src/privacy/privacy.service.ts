import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Cron } from '@nestjs/schedule';

@Injectable()
export class PrivacyService {
  constructor(private prisma: PrismaService) {}

  // ── Consent ───────────────────────────────────────────────────────────────

  async grantConsent(
    userId: string,
    tenantId: string,
    consentType: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const id = `${userId}:${consentType}:${Date.now()}`;
    return this.prisma.consentRecord.create({
      data: {
        id,
        userId,
        tenantId,
        consentType,
        granted: true,
        grantedAt: new Date(),
        ipAddress,
        userAgent,
      },
    });
  }

  async revokeConsent(userId: string, tenantId: string, consentType: string) {
    const latest = await this.prisma.consentRecord.findFirst({
      where: { userId, tenantId, consentType, granted: true, revokedAt: null },
      orderBy: { grantedAt: 'desc' },
    });
    if (!latest) {
      throw new NotFoundException(`Rozilik topilmadi: ${consentType}`);
    }
    return this.prisma.consentRecord.update({
      where: { id: latest.id },
      data: { granted: false, revokedAt: new Date() },
    });
  }

  async getMyConsents(userId: string, tenantId: string) {
    return this.prisma.consentRecord.findMany({
      where: { userId, tenantId },
      orderBy: { grantedAt: 'desc' },
    });
  }

  async getStudentConsents(studentId: string, tenantId: string) {
    return this.prisma.consentRecord.findMany({
      where: { userId: studentId, tenantId },
      orderBy: { grantedAt: 'desc' },
    });
  }

  async hasActiveConsent(
    userId: string,
    tenantId: string,
    consentType: string,
  ): Promise<boolean> {
    const record = await this.prisma.consentRecord.findFirst({
      where: {
        userId,
        tenantId,
        consentType,
        granted: true,
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    });
    return !!record;
  }

  // ── Deletion requests ─────────────────────────────────────────────────────

  async requestDeletion(userId: string) {
    const existing = await this.prisma.dataDeletionRequest.findFirst({
      where: { userId, status: { in: ['pending', 'scheduled'] } },
    });
    if (existing) {
      throw new BadRequestException('O\'chirish so\'rovi allaqachon mavjud');
    }

    const scheduledFor = new Date(Date.now() + 14 * 86_400_000); // 14 days
    return this.prisma.dataDeletionRequest.create({
      data: {
        id: `del:${userId}:${Date.now()}`,
        userId,
        scheduledFor,
        status: 'pending',
      },
    });
  }

  async cancelDeletion(userId: string, reason?: string) {
    const request = await this.prisma.dataDeletionRequest.findFirst({
      where: { userId, status: { in: ['pending', 'scheduled'] } },
    });
    if (!request) throw new NotFoundException('Faol o\'chirish so\'rovi topilmadi');

    return this.prisma.dataDeletionRequest.update({
      where: { id: request.id },
      data: {
        status: 'cancelled',
        cancelledAt: new Date(),
        cancelledReason: reason ?? null,
      },
    });
  }

  async getDeletionStatus(userId: string) {
    return this.prisma.dataDeletionRequest.findFirst({
      where: { userId },
      orderBy: { requestedAt: 'desc' },
    });
  }

  async approveDeletion(requestId: string, approvedBy: string) {
    const request = await this.prisma.dataDeletionRequest.findUnique({
      where: { id: requestId },
    });
    if (!request) throw new NotFoundException('So\'rov topilmadi');
    if (request.status !== 'pending') {
      throw new BadRequestException('Faqat pending so\'rovlarni tasdiqlash mumkin');
    }
    return this.prisma.dataDeletionRequest.update({
      where: { id: requestId },
      data: { status: 'scheduled', approvedBy },
    });
  }

  // ── Data export ───────────────────────────────────────────────────────────

  async exportUserData(userId: string, tenantId: string) {
    const [user, progress, payments, consents, certificates] = await Promise.all([
      this.prisma.user.findFirst({
        where: { id: userId, tenantId },
        select: {
          id: true,
          name: true,
          login: true,
          role: true,
          status: true,
          createdAt: true,
          branchId: true,
          groupId: true,
        },
      }),
      this.prisma.studentProgress.findMany({
        where: { studentId: userId, lesson: { tenantId } },
        select: {
          lessonId: true,
          homeCompleted: true,
          academyCompleted: true,
          completedAt: true,
          sessionCount: true,
        },
        take: 500,
      }),
      this.prisma.payment.findMany({
        where: { studentId: userId, tenantId },
        select: { month: true, amount: true, paidAt: true },
      }),
      this.prisma.consentRecord.findMany({
        where: { userId, tenantId },
        select: { consentType: true, granted: true, grantedAt: true, revokedAt: true },
      }),
      this.prisma.certificate.findMany({
        where: { studentId: userId, tenantId },
        select: { level: true, lessonsCompleted: true, issuedAt: true },
      }),
    ]);

    return {
      exportedAt: new Date().toISOString(),
      profile: user,
      progress,
      payments,
      consents,
      certificates,
    };
  }

  // ── Crons ─────────────────────────────────────────────────────────────────

  // Execute scheduled deletions
  @Cron('0 2 * * *', { timeZone: 'Asia/Tashkent' })
  async executeScheduledDeletions() {
    const due = await this.prisma.dataDeletionRequest.findMany({
      where: { status: 'scheduled', scheduledFor: { lte: new Date() } },
    });

    for (const req of due) {
      await this.executeUserDeletion(req.id, req.userId).catch(() => {});
    }
  }

  private async executeUserDeletion(
    requestId: string,
    userId: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // Anonymize analytics instead of deleting
      await tx.analyticsEvent.updateMany({
        where: { studentId: userId },
        data: { studentId: null },
      });

      // Delete PII-bearing records
      await tx.refreshToken.deleteMany({ where: { userId } });
      await tx.notification.deleteMany({ where: { userId } });
      await tx.consentRecord.deleteMany({ where: { userId } });

      // Anonymize user record (keep for referential integrity)
      await tx.user.update({
        where: { id: userId },
        data: {
          name: '[O\'chirilgan]',
          login: `deleted_${userId.slice(0, 8)}`,
          telegramId: null,
          status: 'inactive',
        },
      });

      // Mark request complete
      await tx.dataDeletionRequest.update({
        where: { id: requestId },
        data: { status: 'completed', completedAt: new Date() },
      });
    });
  }

  // Anonymize old IP addresses (90-day retention)
  @Cron('0 3 * * *', { timeZone: 'Asia/Tashkent' })
  async anonymizeOldIps() {
    const cutoff = new Date(Date.now() - 90 * 86_400_000);
    await this.prisma.consentRecord.updateMany({
      where: { grantedAt: { lt: cutoff }, ipAddress: { not: null } },
      data: { ipAddress: '[anonymized]' },
    });
    await this.prisma.systemAuditLog.updateMany({
      where: { createdAt: { lt: cutoff }, ipAddress: { not: null } },
      data: { ipAddress: '[anonymized]' },
    });
  }
}
