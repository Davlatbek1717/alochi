import { Controller, Get, Param, Post, Body, Request, UnauthorizedException } from '@nestjs/common';
import { CacheService } from './cache.service';
import { FaceService } from './face.service';
import { PrismaService } from '../prisma/prisma.service';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('face')
@ApiBearerAuth()
@Controller('face')
export class FaceController {
  constructor(
    private cacheService: CacheService,
    private faceService: FaceService,
    private prisma: PrismaService,
  ) {}

  @Get('cache/:branchId')
  async getCache(@Param('branchId') branchId: string, @Request() req: any) {
    const deviceToken = req.headers['x-device-token'];
    if (!deviceToken) throw new UnauthorizedException('Device token kerak');

    const device = await this.prisma.branchDevice.findUnique({
      where: { deviceToken },
      include: { branch: true },
    });

    if (!device || device.branchId !== branchId) {
      throw new UnauthorizedException('Device ruxsatsiz');
    }

    await this.prisma.branchDevice.update({
      where: { id: device.id },
      data: { lastCacheSync: new Date() },
    });

    return this.cacheService.generateBranchCache(branchId, device.branch.tenantId);
  }

  @Post('enroll')
  enroll(@Body() body: { userId: string; tenantId: string; enrolledVia: string }) {
    return this.faceService.enroll(body.userId, body.tenantId, body.enrolledVia);
  }

  @Get('enrollments/:userId')
  getEnrollments(@Param('userId') userId: string) {
    return this.faceService.getEnrollments(userId);
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
