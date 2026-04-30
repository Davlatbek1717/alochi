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
    const whereClause = tenantSlug
      ? { login: dto.login, tenant: { slug: tenantSlug } }
      : { login: dto.login, role: UserRole.superadmin };

    const user = await this.prisma.user.findFirst({
      where: whereClause,
      include: { tenant: true },
    });

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

    const accessToken = this.jwt.sign(payload, { expiresIn: '15m' });
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

    await this.prisma.refreshToken.delete({ where: { id: stored.id } });

    const payload = {
      sub: stored.user.id,
      role: stored.user.role,
      tenantId: stored.user.tenantId,
      branchId: stored.user.branchId,
    };

    const newAccess = this.jwt.sign(payload, { expiresIn: '15m' });
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
