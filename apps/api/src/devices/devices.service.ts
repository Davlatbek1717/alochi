import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { randomBytes } from 'crypto';
import { DeviceStatus } from '@prisma/client';

const ENROLLMENT_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24h

@Injectable()
export class DevicesService {
  constructor(private prisma: PrismaService) {}

  // ── Registration ─────────────────────────────────────────────────────────

  async create(dto: {
    serialNumber: string;
    imei?: string;
    macAddress?: string;
    manufacturer?: string;
    model?: string;
    osVersion?: string;
    androidId?: string;
    purchasedAt?: Date;
    branchId: string;
    tenantId: string;
  }) {
    const enrollmentToken = randomBytes(24).toString('hex');
    return this.prisma.device.create({
      data: { ...dto, enrollmentToken },
    });
  }

  async findAll(tenantId: string, branchId?: string, status?: DeviceStatus) {
    return this.prisma.device.findMany({
      where: {
        tenantId,
        ...(branchId ? { branchId } : {}),
        ...(status ? { status } : {}),
        deletedAt: null,
      },
      include: {
        enrollments: {
          where: { active: true },
          select: { studentId: true, enrolledAt: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string, tenantId: string) {
    const device = await this.prisma.device.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        enrollments: {
          where: { active: true },
          select: { id: true, studentId: true, enrolledAt: true, enrolledBy: true },
        },
      },
    });
    if (!device) throw new NotFoundException('Qurilma topilmadi');
    return device;
  }

  async update(
    id: string,
    tenantId: string,
    data: {
      model?: string;
      osVersion?: string;
      appVersion?: string;
      fcmToken?: string;
      status?: DeviceStatus;
      batteryLevel?: number;
      storageFreePct?: number;
    },
  ) {
    await this.findById(id, tenantId);
    return this.prisma.device.update({
      where: { id },
      data: { ...data, lastSeenAt: new Date() },
    });
  }

  // ── Enrollment ────────────────────────────────────────────────────────────

  async enroll(id: string, tenantId: string, studentId: string, enrolledBy: string) {
    await this.findById(id, tenantId);

    const existing = await this.prisma.deviceEnrollment.findFirst({
      where: { deviceId: id, active: true },
    });
    if (existing) {
      throw new ConflictException('Qurilma allaqachon boshqa o\'quvchiga biriktirilgan');
    }

    return this.prisma.deviceEnrollment.create({
      data: { deviceId: id, studentId, enrolledBy, active: true },
    });
  }

  async unenroll(id: string, tenantId: string) {
    await this.findById(id, tenantId);
    const enrollment = await this.prisma.deviceEnrollment.findFirst({
      where: { deviceId: id, active: true },
    });
    if (!enrollment) throw new NotFoundException('Faol biriktirish topilmadi');

    return this.prisma.deviceEnrollment.update({
      where: { id: enrollment.id },
      data: { active: false, unenrolledAt: new Date() },
    });
  }

  // ── Soft delete ───────────────────────────────────────────────────────────

  async softDelete(id: string, tenantId: string) {
    await this.findById(id, tenantId);
    return this.prisma.device.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'retired' },
    });
  }

  // ── Health pings ──────────────────────────────────────────────────────────

  async submitHealthPing(
    id: string,
    tenantId: string,
    ping: {
      batteryLevel?: number;
      storageFreePct?: number;
      networkType?: string;
      signalStrength?: number;
      appVersion?: string;
    },
  ) {
    const device = await this.findById(id, tenantId);
    const [healthPing] = await this.prisma.$transaction([
      this.prisma.deviceHealthPing.create({
        data: { deviceId: id, ...ping },
      }),
      this.prisma.device.update({
        where: { id },
        data: {
          lastSeenAt: new Date(),
          batteryLevel: ping.batteryLevel ?? device.batteryLevel,
          storageFreePct: ping.storageFreePct ?? device.storageFreePct,
          appVersion: ping.appVersion ?? device.appVersion,
        },
      }),
    ]);
    return healthPing;
  }

  async getRecentHealth(id: string, tenantId: string) {
    await this.findById(id, tenantId);
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return this.prisma.deviceHealthPing.findMany({
      where: { deviceId: id, pingedAt: { gte: since } },
      orderBy: { pingedAt: 'desc' },
    });
  }

  // ── Events ────────────────────────────────────────────────────────────────

  async submitEvents(
    id: string,
    tenantId: string,
    events: Array<{
      type: string;
      severity?: string;
      payload?: unknown;
      occurredAt: Date;
    }>,
  ) {
    await this.findById(id, tenantId);
    if (events.length === 0) return { count: 0 };

    const result = await this.prisma.deviceEvent.createMany({
      data: events.map((e) => ({
        deviceId: id,
        type: e.type,
        severity: e.severity ?? 'info',
        payload: e.payload as any,
        occurredAt: e.occurredAt,
      })),
    });

    await this.prisma.device.update({
      where: { id },
      data: { lastSeenAt: new Date() },
    });

    return { count: result.count };
  }

  async getEvents(
    id: string,
    tenantId: string,
    query: { from?: Date; to?: Date; type?: string; limit?: number },
  ) {
    await this.findById(id, tenantId);
    return this.prisma.deviceEvent.findMany({
      where: {
        deviceId: id,
        ...(query.type ? { type: query.type } : {}),
        ...(query.from || query.to
          ? {
              occurredAt: {
                ...(query.from ? { gte: query.from } : {}),
                ...(query.to ? { lte: query.to } : {}),
              },
            }
          : {}),
      },
      orderBy: { occurredAt: 'desc' },
      take: Math.min(query.limit ?? 100, 500),
    });
  }

  // ── Commands ──────────────────────────────────────────────────────────────

  async issueCommand(
    id: string,
    tenantId: string,
    type: string,
    payload: unknown,
    createdBy: string,
  ) {
    await this.findById(id, tenantId);
    const WIPE_TYPES = ['WIPE_USER_DATA', 'FACTORY_RESET'];
    if (WIPE_TYPES.includes(type)) {
      throw new ForbiddenException('Destructive commands require 2FA confirmation via /devices/:id/commands/wipe');
    }
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 min TTL
    return this.prisma.deviceCommand.create({
      data: { deviceId: id, type, payload: payload as any, createdBy, expiresAt },
    });
  }

  async issueWipeCommand(
    id: string,
    tenantId: string,
    type: string,
    payload: unknown,
    createdBy: string,
  ) {
    await this.findById(id, tenantId);
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    return this.prisma.deviceCommand.create({
      data: { deviceId: id, type, payload: payload as any, createdBy, expiresAt },
    });
  }

  async getPendingCommands(id: string, tenantId: string) {
    await this.findById(id, tenantId);
    const now = new Date();
    return this.prisma.deviceCommand.findMany({
      where: {
        deviceId: id,
        status: 'pending',
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async updateCommandStatus(
    id: string,
    tenantId: string,
    cmdId: string,
    status: string,
    resultPayload?: unknown,
  ) {
    await this.findById(id, tenantId);
    const cmd = await this.prisma.deviceCommand.findFirst({
      where: { id: cmdId, deviceId: id },
    });
    if (!cmd) throw new NotFoundException('Buyruq topilmadi');

    const timestamps: Record<string, Date> = {};
    if (status === 'sent') timestamps.sentAt = new Date();
    if (status === 'acked') timestamps.ackedAt = new Date();
    if (status === 'completed' || status === 'failed') timestamps.completedAt = new Date();

    return this.prisma.deviceCommand.update({
      where: { id: cmdId },
      data: { status, ...timestamps, resultPayload: resultPayload as any },
    });
  }

  async cancelCommand(id: string, tenantId: string, cmdId: string) {
    await this.findById(id, tenantId);
    const cmd = await this.prisma.deviceCommand.findFirst({
      where: { id: cmdId, deviceId: id },
    });
    if (!cmd) throw new NotFoundException('Buyruq topilmadi');
    if (cmd.status !== 'pending') {
      throw new BadRequestException('Faqat pending buyruqlar bekor qilinadi');
    }
    return this.prisma.deviceCommand.update({
      where: { id: cmdId },
      data: { status: 'cancelled', completedAt: new Date() },
    });
  }

  // ── Policy ────────────────────────────────────────────────────────────────

  async getPolicy(branchId: string) {
    return this.prisma.devicePolicy.findUnique({ where: { branchId } });
  }

  async upsertPolicy(
    branchId: string,
    data: Partial<{
      allowedHoursStart: string;
      allowedHoursEnd: string;
      allowedDomains: string[];
      screenshotIntervalSec: number;
      cameraIntervalSec: number;
      pingIntervalSec: number;
      wifiSsidWhitelist: string[];
      blockCameraOutsideHours: boolean;
      forceUpdateMinVersion: string;
    }>,
  ) {
    const current = await this.prisma.devicePolicy.findUnique({ where: { branchId } });
    const nextVersion = (current?.policyVersion ?? 0) + 1;

    return this.prisma.devicePolicy.upsert({
      where: { branchId },
      create: { branchId, ...data, policyVersion: 1 },
      update: { ...data, policyVersion: nextVersion },
    });
  }

  // ── Device-scoped policy (used by kiosk health-ping response) ─────────────

  async getPolicyForDevice(id: string, tenantId: string) {
    const device = await this.findById(id, tenantId);
    const policy = await this.prisma.devicePolicy.findUnique({
      where: { branchId: device.branchId },
    });
    return { policyVersion: policy?.policyVersion ?? 1, policy };
  }
}
