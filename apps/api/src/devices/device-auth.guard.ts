import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Authenticates the Android kiosk app (not a human user). The device sends
 * its per-device enrollment token — created when the device was registered
 * by an admin — as `Authorization: Device <token>` or `X-Device-Token`.
 *
 * On success attaches `req.device = { id, tenantId, branchId }` so the
 * device-facing controllers never trust a device id from the body.
 */
@Injectable()
export class DeviceAuthGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const token = this.extractToken(req);
    if (!token) throw new UnauthorizedException('Qurilma tokeni yoʻq');

    const device = await this.prisma.device.findFirst({
      where: { enrollmentToken: token, deletedAt: null },
      select: { id: true, tenantId: true, branchId: true },
    });
    if (!device) throw new UnauthorizedException('Qurilma topilmadi');

    req.device = device;
    return true;
  }

  private extractToken(req: {
    headers: Record<string, string | string[] | undefined>;
  }): string | null {
    const auth = req.headers['authorization'];
    if (typeof auth === 'string' && auth.startsWith('Device ')) {
      return auth.slice('Device '.length).trim();
    }
    const x = req.headers['x-device-token'];
    if (typeof x === 'string' && x.trim()) return x.trim();
    return null;
  }
}
