import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.get<string>('JWT_SECRET') as string,
    });
  }

  async validate(payload: any) {
    // Lightweight existence + status check so revoked or deactivated users
    // cannot continue using a still-valid JWT. We select only the fields
    // we need so the query is a covered index scan on `id`.
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, status: true },
    });
    if (!user || user.status !== 'active') {
      throw new UnauthorizedException('Foydalanuvchi topilmadi yoki faol emas');
    }
    return {
      userId: payload.sub,
      role: payload.role,
      tenantId: payload.tenantId,
      branchId: payload.branchId,
      groupId: payload.groupId ?? null,
    };
  }
}
