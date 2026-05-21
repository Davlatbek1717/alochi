import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { UserRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash } from 'crypto';
import { LoginDto } from './dto/login.dto';
import { TenantsService } from '../tenants/tenants.service';
import { OnboardTenantDto } from '../tenants/dto/onboard-tenant.dto';
import { I18nService } from '../i18n/i18n.service';

interface DeviceCtx {
  ip: string;
  userAgent: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    private tenantsService: TenantsService,
    private i18n: I18nService,
  ) {}

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private deviceFingerprint(ctx: DeviceCtx): string {
    return createHash('sha256')
      .update(`${ctx.userAgent}|${ctx.ip}`)
      .digest('hex');
  }

  async login(dto: LoginDto, tenantSlug?: string, ctx?: DeviceCtx) {
    // Resolution rules:
    //   - If the caller passed an x-tenant-slug header, scope the lookup
    //     to that tenant and accept any role (mentor / manager / student
    //     / etc). This is the multi-tenant disambiguation path.
    //   - If no slug, search across every tenant. Prefer superadmin so
    //     the platform owner always wins their login race. For non-
    //     superadmins, only succeed when exactly one row matches —
    //     otherwise we can't tell which tenant they meant. This makes
    //     freshly-created students / mentors able to log in WITHOUT
    //     having to know their markaz slug, as long as their login is
    //     unique on the deployment (the typical case for single-tenant
    //     installs).
    let user;
    if (tenantSlug) {
      user = await this.prisma.user.findFirst({
        where: { login: dto.login, tenant: { slug: tenantSlug } },
        include: { tenant: true },
      });
    } else {
      // Try superadmin first — they are the canonical "global" login.
      user = await this.prisma.user.findFirst({
        where: { login: dto.login, role: UserRole.superadmin },
        include: { tenant: true },
      });
      if (!user) {
        const matches = await this.prisma.user.findMany({
          where: { login: dto.login },
          include: { tenant: true },
          take: 2,
        });
        if (matches.length === 1) {
          user = matches[0];
        } else if (matches.length > 1) {
          throw new UnauthorizedException(this.i18n.t('multiple_tenants'));
        }
      }
    }

    if (!user) throw new UnauthorizedException(this.i18n.t('login_failed'));

    // Account lockout check (brute-force protection)
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException(this.i18n.t('account_locked'));
    }

    if (user.status === UserStatus.blocked_warning)
      throw new UnauthorizedException(this.i18n.t('blocked_warning'));
    if (user.status === UserStatus.blocked_payment)
      throw new UnauthorizedException(this.i18n.t('blocked_payment'));
    if (user.status !== UserStatus.active)
      throw new UnauthorizedException(this.i18n.t('profile_blocked'));

    const match = await bcrypt.compare(dto.password, user.passwordHash);
    if (!match) {
      // Track failed attempts; lock for 15 minutes after 10 consecutive failures
      const newCount = (user.failedLoginCount ?? 0) + 1;
      const lockedUntil = newCount >= 10
        ? new Date(Date.now() + 15 * 60_000)
        : null;
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginCount: newCount, ...(lockedUntil ? { lockedUntil } : {}) },
      });
      throw new UnauthorizedException(this.i18n.t('login_failed'));
    }

    const payload = {
      sub: user.id,
      role: user.role,
      tenantId: user.tenantId,
      branchId: user.branchId,
      groupId: user.groupId,
    };

    const accessToken = this.jwt.sign(payload, { expiresIn: '1h' });
    const refreshToken = this.jwt.sign(payload, {
      secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: '7d',
    });

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    const fingerprint = ctx ? this.deviceFingerprint(ctx) : undefined;
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: this.hashToken(refreshToken),
        expiresAt,
        deviceFingerprint: fingerprint,
        ipAddress: ctx?.ip,
        userAgent: ctx?.userAgent,
        lastUsedAt: new Date(),
      },
    });

    // Reset failed login counter and record last login on success
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
        lastLoginIp: ctx?.ip,
      },
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        tenantId: user.tenantId,
        // branchId / groupId are read from `localStorage.user` by
        // several role pages (filadmin students, manager dashboard,
        // mentor group). Omitting them forced those pages to fall
        // through to an empty state — they had no branch to scope
        // queries against. The JWT already carries both fields.
        branchId: user.branchId,
        groupId: user.groupId,
      },
    };
  }

  async refresh(token: string, ctx?: DeviceCtx) {
    // First verify the JWT signature and expiry
    try {
      await this.jwt.verifyAsync(token, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException(this.i18n.t('refresh_invalid'));
    }

    const tokenHash = this.hashToken(token);
    const fingerprint = ctx ? this.deviceFingerprint(ctx) : undefined;

    // Atomic rotation: read + revoke + create live in one transaction.
    // Stolen-chain detection: if the token is already revoked ("rotated"),
    // an attacker reused a previously rotated token — we revoke ALL tokens
    // for this user (nuclear option) to force re-login on both parties.
    const result = await this.prisma.$transaction(async (tx) => {
      const stored = await tx.refreshToken.findUnique({
        where: { token: tokenHash },
        include: { user: true },
      });

      if (!stored) {
        throw new UnauthorizedException(this.i18n.t('refresh_invalid'));
      }

      // Stolen chain detection: token was already rotated/revoked
      if (stored.revokedAt !== null) {
        this.logger.warn(
          `Stolen token chain detected for user ${stored.userId} — revoking all tokens`,
        );
        await tx.refreshToken.updateMany({
          where: { userId: stored.userId, revokedAt: null },
          data: { revokedAt: new Date(), revokedReason: 'stolen_chain' },
        });
        throw new UnauthorizedException(this.i18n.t('refresh_invalid'));
      }

      if (stored.expiresAt < new Date()) {
        await tx.refreshToken.update({
          where: { id: stored.id },
          data: { revokedAt: new Date(), revokedReason: 'expired' },
        });
        throw new UnauthorizedException(this.i18n.t('refresh_invalid'));
      }

      if (stored.user.status !== UserStatus.active) {
        await tx.refreshToken.update({
          where: { id: stored.id },
          data: { revokedAt: new Date(), revokedReason: 'user_blocked' },
        });
        throw new UnauthorizedException(this.i18n.t('profile_blocked'));
      }

      // Mark old token as rotated (keeps audit trail, enables stolen-chain detection)
      await tx.refreshToken.update({
        where: { id: stored.id },
        data: { revokedAt: new Date(), revokedReason: 'rotated' },
      });

      return { user: stored.user, oldTokenId: stored.id };
    });

    const payload = {
      sub: result.user.id,
      role: result.user.role,
      tenantId: result.user.tenantId,
      branchId: result.user.branchId,
      groupId: result.user.groupId,
    };

    const newAccess = this.jwt.sign(payload, { expiresIn: '1h' });
    const newRefresh = this.jwt.sign(payload, {
      secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: '7d',
    });

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    await this.prisma.refreshToken.create({
      data: {
        userId: result.user.id,
        token: this.hashToken(newRefresh),
        expiresAt,
        parentTokenId: result.oldTokenId,
        deviceFingerprint: fingerprint,
        ipAddress: ctx?.ip,
        userAgent: ctx?.userAgent,
        lastUsedAt: new Date(),
      },
    });

    return { accessToken: newAccess, refreshToken: newRefresh };
  }

  async logout(userId: string) {
    await this.prisma.refreshToken.deleteMany({ where: { userId } });
    return { message: 'Chiqildi' };
  }

  async registerTenant(dto: OnboardTenantDto) {
    // Delegate to TenantsService.onboardTenant (same logic as superadmin flow)
    // but set trialEndsAt = 14 days from now on the created tenant.
    const result = await this.tenantsService.onboardTenant(dto);
    // Set trial period
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 14);
    await this.prisma.tenant.update({
      where: { id: result.tenant.id },
      data: { trialEndsAt },
    });
    return { ...result, trialEndsAt };
  }
}
