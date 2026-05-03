import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { UserRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash } from 'crypto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  async login(dto: LoginDto, tenantSlug?: string) {
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
            'Bir xil login bir nechta markazda topildi. Iltimos, markaz nomini kiriting.',
          );
        }
      }
    }

    if (!user) throw new UnauthorizedException("Login yoki parol noto'g'ri");
    if (user.status === UserStatus.blocked_warning)
      throw new UnauthorizedException(
        "Profilingiz 3 ta ogohlantirish sababli bloklangan. Filadmin bilan bog'laning.",
      );
    if (user.status === UserStatus.blocked_payment)
      throw new UnauthorizedException(
        "To'lov amalga oshirilmagan. Iltimos, to'lovni to'lang.",
      );
    if (user.status !== UserStatus.active)
      throw new UnauthorizedException('Profilingiz bloklangan');

    const match = await bcrypt.compare(dto.password, user.passwordHash);
    if (!match) throw new UnauthorizedException("Login yoki parol noto'g'ri");

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
      throw new UnauthorizedException('Refresh token yaroqsiz');
    }

    // Then look up DB record by hash
    const stored = await this.prisma.refreshToken.findUnique({
      where: { token: this.hashToken(token) },
      include: { user: true },
    });

    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token yaroqsiz');
    }

    // A valid refresh token alone is not enough — the user behind it must
    // still be active. Without this check, accounts that were blocked
    // (warnings, missed payment, manual deactivation) keep minting fresh
    // 1-hour access tokens until their refresh token expires naturally,
    // which neutralises the block entirely.
    if (stored.user.status !== UserStatus.active) {
      // Burn the token alongside the rejection so the client can't keep
      // hammering /auth/refresh with the same valid-but-now-useless row.
      await this.prisma.refreshToken.delete({ where: { id: stored.id } });
      throw new UnauthorizedException('Profilingiz bloklangan');
    }

    await this.prisma.refreshToken.delete({ where: { id: stored.id } });

    const payload = {
      sub: stored.user.id,
      role: stored.user.role,
      tenantId: stored.user.tenantId,
      branchId: stored.user.branchId,
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
        userId: stored.user.id,
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
}
