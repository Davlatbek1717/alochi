import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MonitoringService {
  constructor(private prisma: PrismaService) {}

  // ── ScreenCapture ─────────────────────────────────────────────────────────

  async createScreenCapture(data: {
    deviceId: string;
    studentId: string;
    s3Key: string;
    thumbnailKey: string;
    width: number;
    height: number;
    byteSize: number;
    appPackage?: string;
    url?: string;
    ocrText?: string;
    tenantId: string;
  }) {
    return this.prisma.screenCapture.create({ data });
  }

  async getStudentScreenshots(
    studentId: string,
    tenantId: string,
    date?: string,
  ) {
    const start = date ? new Date(`${date}T00:00:00+05:00`) : undefined;
    const end = date ? new Date(`${date}T23:59:59+05:00`) : undefined;
    return this.prisma.screenCapture.findMany({
      where: {
        studentId,
        tenantId,
        ...(start && end ? { capturedAt: { gte: start, lte: end } } : {}),
      },
      orderBy: { capturedAt: 'asc' },
      select: {
        id: true,
        thumbnailKey: true,
        capturedAt: true,
        appPackage: true,
        url: true,
        suspicious: true,
        reviewedAt: true,
      },
    });
  }

  async reviewScreenshot(
    id: string,
    tenantId: string,
    reviewedBy: string,
    suspicious: boolean,
    reviewNote?: string,
  ) {
    const cap = await this.prisma.screenCapture.findFirst({ where: { id, tenantId } });
    if (!cap) throw new NotFoundException('Screenshot topilmadi');
    return this.prisma.screenCapture.update({
      where: { id },
      data: {
        suspicious,
        reviewedBy,
        reviewedAt: new Date(),
        reviewNote,
      },
    });
  }

  async getBranchRecentScreenshots(branchId: string, tenantId: string, limit = 100) {
    return this.prisma.screenCapture.findMany({
      where: { tenantId, device: { branchId } },
      orderBy: { capturedAt: 'desc' },
      take: Math.min(limit, 500),
      select: {
        id: true,
        studentId: true,
        thumbnailKey: true,
        capturedAt: true,
        appPackage: true,
        suspicious: true,
      },
    });
  }

  // ── PresenceCheck ─────────────────────────────────────────────────────────

  async createPresenceCheck(data: {
    deviceId: string;
    studentId: string;
    s3Key: string;
    matchScore?: number;
    matched: boolean;
    faceDetected: boolean;
    liveness?: boolean;
    multipleFaces?: boolean;
    tenantId: string;
  }) {
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
    return this.prisma.presenceCheck.create({
      data: { ...data, expiresAt },
    });
  }

  async getStudentPresence(
    studentId: string,
    tenantId: string,
    date?: string,
  ) {
    const start = date ? new Date(`${date}T00:00:00+05:00`) : undefined;
    const end = date ? new Date(`${date}T23:59:59+05:00`) : undefined;
    return this.prisma.presenceCheck.findMany({
      where: {
        studentId,
        tenantId,
        ...(start && end ? { capturedAt: { gte: start, lte: end } } : {}),
      },
      orderBy: { capturedAt: 'desc' },
    });
  }

  async getPresenceAnomalies(tenantId: string, limit = 50) {
    return this.prisma.presenceCheck.findMany({
      where: { tenantId, matched: false },
      orderBy: { capturedAt: 'desc' },
      take: Math.min(limit, 200),
    });
  }

  // ── CheatingSignal ────────────────────────────────────────────────────────

  async recordSignal(data: {
    studentId: string;
    deviceId?: string;
    signalType: string;
    severity: number;
    context: Record<string, unknown>;
    tenantId: string;
  }) {
    return this.prisma.cheatingSignal.create({ data: data as any });
  }

  async getStudentSignals(studentId: string, tenantId: string) {
    return this.prisma.cheatingSignal.findMany({
      where: { studentId, tenantId },
      orderBy: { detectedAt: 'desc' },
    });
  }

  async resolveSignal(
    id: string,
    tenantId: string,
    resolvedBy: string,
    resolution: string,
  ) {
    const sig = await this.prisma.cheatingSignal.findFirst({ where: { id, tenantId } });
    if (!sig) throw new NotFoundException('Signal topilmadi');
    return this.prisma.cheatingSignal.update({
      where: { id },
      data: { resolved: true, resolvedBy, resolvedAt: new Date(), resolution },
    });
  }

  async getCheatingScore(studentId: string, tenantId: string) {
    return this.prisma.cheatingScore.findMany({
      where: { studentId, tenantId },
      orderBy: { date: 'desc' },
      take: 30,
    });
  }
}
