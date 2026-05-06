import { Injectable, UnauthorizedException } from '@nestjs/common';
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

@Injectable()
export class AuthService {
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

  async login(dto: LoginDto, tenantSlug?: string, locale = 'uz') {
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
          throw new UnauthorizedException(
            this.i18n.t('multiple_tenants', locale),
          );
        }
      }
    }

    if (!user)
      throw new UnauthorizedException(this.i18n.t('login_failed', locale));
    if (user.status === UserStatus.blocked_warning)
      throw new UnauthorizedException(this.i18n.t('blocked_warning', locale));
    if (user.status === UserStatus.blocked_payment)
      throw new UnauthorizedException(this.i18n.t('blocked_payment', locale));
    if (user.status !== UserStatus.active)
      throw new UnauthorizedException(this.i18n.t('profile_blocked', locale));

    const match = await bcrypt.compare(dto.password, user.passwordHash);
    if (!match)
      throw new UnauthorizedException(this.i18n.t('login_failed', locale));

    const payload = {
      sub: user.id,
      role: user.role,
      tenantId: user.tenantId,
      branchId: user.branchId,
    };

    const accessToken = this.jwt.sign(payload, { expiresIn: '1h' });
    const refreshToken = this.jwt.sign(payload, {
      secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: '7d',
    });

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    await this.prisma.refreshToken.create({
      data: { userId: user.id, token: this.hashToken(refreshToken), expiresAt },
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

  async refresh(token: string) {
    // First verify the JWT signature and expiry
    try {
      await this.jwt.verifyAsync(token, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException(this.i18n.t('refresh_invalid'));
    }

    const tokenHash = this.hashToken(token);

    // Atomic rotation: read + delete + create live in one transaction so
    // two parallel refresh calls (e.g. a double-tap on a slow client)
    // can't both pass the read, both proceed, and leave the user with
    // a deleted-then-recreated row whose hash neither client knows.
    // The interactive form returns a typed result we surface up to the
    // jwt-signing step below; signing happens outside the transaction
    // because it is pure CPU and we don't want to hold a row lock for
    // it.
    const result = await this.prisma.$transaction(async (tx) => {
      const stored = await tx.refreshToken.findUnique({
        where: { token: tokenHash },
        include: { user: true },
      });
      if (!stored || stored.expiresAt < new Date()) {
        throw new UnauthorizedException(this.i18n.t('refresh_invalid'));
      }
      // A valid refresh token alone is not enough — the user behind it
      // must still be active. Without this check, accounts blocked for
      // warnings / missed payment / manual deactivation could keep
      // minting fresh 1-hour access tokens until the refresh row
      // expired naturally, which neutralises every form of block.
      if (stored.user.status !== UserStatus.active) {
        // Burn the row inside the same transaction so the client can't
        // keep hammering /auth/refresh with a now-useless row.
        await tx.refreshToken.delete({ where: { id: stored.id } });
        throw new UnauthorizedException(this.i18n.t('profile_blocked'));
      }
      await tx.refreshToken.delete({ where: { id: stored.id } });
      return { user: stored.user };
    });

    const payload = {
      sub: result.user.id,
      role: result.user.role,
      tenantId: result.user.tenantId,
      branchId: result.user.branchId,
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
    const result = await this.tenantsService.onboardTenant(dto, undefined);
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
