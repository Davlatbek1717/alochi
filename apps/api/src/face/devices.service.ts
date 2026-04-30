import {
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { BranchDevice } from '@prisma/client';

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

@Injectable()
export class DevicesService {
  private readonly logger = new Logger(DevicesService.name);

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  private deviceTokenSecret(): string {
    return (
      process.env.DEVICE_TOKEN_SECRET ??
      process.env.JWT_SECRET ??
      'dev-device-secret-change-me'
    );
  }

  /**
   * Phase 18.2 — register a new branch device. The persisted `deviceToken`
   * is a signed JWT (90 day TTL) containing { deviceId, branchId,
   * type: 'kiosk' }, signed with DEVICE_TOKEN_SECRET. We also store
   * `tokenExpiresAt` so we can warn on near-expiry without verifying every
   * device on cron tick.
   *
   * The {device, token} pair returned from `register` is the same: the
   * caller (filadmin UI) shows `token` once for the kiosk to copy. Legacy
   * callers expecting just the device row keep working because we still
   * return a BranchDevice — token is exposed via `registerWithToken`.
   */
  async register(branchId: string, deviceName: string): Promise<BranchDevice> {
    const { device } = await this.registerWithToken(branchId, deviceName);
    return device;
  }

  async registerWithToken(
    branchId: string,
    deviceName: string,
  ): Promise<{ device: BranchDevice; token: string }> {
    // Reserve a row first so we can sign with a stable deviceId.
    const placeholder = randomBytes(32).toString('hex');
    const tokenExpiresAt = new Date(Date.now() + NINETY_DAYS_MS);
    const device = await this.prisma.branchDevice.create({
      data: {
        branchId,
        deviceName,
        deviceToken: placeholder,
        tokenExpiresAt,
        isActive: true,
      },
    });

    const token = await this.jwt.signAsync(
      { deviceId: device.id, branchId, type: 'kiosk' },
      { secret: this.deviceTokenSecret(), expiresIn: '90d' },
    );

    const updated = await this.prisma.branchDevice.update({
      where: { id: device.id },
      data: { deviceToken: token },
    });
    return { device: updated, token };
  }

  async listForBranch(branchId: string): Promise<BranchDevice[]> {
    return this.prisma.branchDevice.findMany({
      where: { branchId, isActive: true },
    });
  }

  async deactivate(deviceId: string): Promise<void> {
    await this.prisma.branchDevice.update({
      where: { id: deviceId },
      data: { isActive: false },
    });
  }

  /**
   * Phase 18.5 — status snapshot for the filadmin UI.
   */
  async getStatus(deviceId: string) {
    const device = await this.prisma.branchDevice.findUnique({
      where: { id: deviceId },
    });
    if (!device) throw new NotFoundException('Qurilma topilmadi');
    return {
      id: device.id,
      name: device.deviceName,
      branchId: device.branchId,
      isActive: device.isActive,
      lastSeen: device.lastCacheSync,
      tokenExpiresAt: device.tokenExpiresAt,
    };
  }

  /**
   * Validate an incoming kiosk JWT. Returns the device row or throws.
   */
  async validateToken(token: string): Promise<BranchDevice> {
    // Try JWT verification first (Phase 18.2). If signature parse fails,
    // fall back to legacy random-token lookup so devices issued before the
    // migration keep working until rotated.
    try {
      const payload = await this.jwt.verifyAsync<{
        deviceId: string;
        branchId: string;
        type: string;
      }>(token, { secret: this.deviceTokenSecret() });
      if (payload.type !== 'kiosk') {
        throw new UnauthorizedException('Yaroqsiz qurilma tokeni');
      }
      const device = await this.prisma.branchDevice.findUnique({
        where: { id: payload.deviceId },
      });
      if (!device || !device.isActive) {
        throw new UnauthorizedException('Qurilma faol emas');
      }
      return device;
    } catch (err) {
      // Fallback: legacy random-hex token lookup.
      const legacy = await this.prisma.branchDevice.findUnique({
        where: { deviceToken: token },
      });
      if (legacy && legacy.isActive) return legacy;
      this.logger.warn(`Device token reject: ${(err as Error).message}`);
      throw new UnauthorizedException('Qurilma ruxsatsiz');
    }
  }
}
