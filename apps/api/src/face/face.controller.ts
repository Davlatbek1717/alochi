import { Controller, Get, Param, Post, Body, Request } from '@nestjs/common';
import { CacheService } from './cache.service';
import { PrismaService } from '../prisma/prisma.service';

@Controller('face')
export class FaceController {
  constructor(
    private cacheService: CacheService,
    private prisma: PrismaService,
  ) {}

  @Get('cache/:branchId')
  async getCache(@Param('branchId') branchId: string, @Request() req: any) {
    const deviceToken = req.headers['x-device-token'];
    if (!deviceToken) return { error: 'Device token kerak' };

    const device = await this.prisma.branchDevice.findUnique({
      where: { deviceToken },
      include: { branch: true },
    });

    if (!device || device.branchId !== branchId) {
      return { error: 'Device ruxsatsiz' };
    }

    await this.prisma.branchDevice.update({
      where: { id: device.id },
      data: { lastCacheSync: new Date() },
    });

    return this.cacheService.generateBranchCache(branchId, device.branch.tenantId);
  }

  @Post('manual-checkin')
  async manualCheckin(
    @Body() body: { login: string; password: string; deviceToken: string },
  ) {
    return { message: "Qo'lda login accepted (to'liq keyingi planda)" };
  }

  @Post('recognize')
  async recognize(@Body() body: { imageBase64: string; deviceToken: string }) {
    return { message: 'Server fallback (AI Service orqali)' };
  }
}
