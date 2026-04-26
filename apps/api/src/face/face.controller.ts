import {
  Controller, Get, Param, Post, Body, Request,
  UnauthorizedException, HttpException, HttpStatus,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { firstValueFrom } from 'rxjs';
import { CacheService } from './cache.service';
import { FaceService } from './face.service';
import { PrismaService } from '../prisma/prisma.service';
import { AttendanceStaffService } from '../attendance/attendance-staff.service';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('face')
@ApiBearerAuth()
@Controller('face')
export class FaceController {
  constructor(
    private cacheService: CacheService,
    private faceService: FaceService,
    private prisma: PrismaService,
    private staffAttendance: AttendanceStaffService,
    private httpService: HttpService,
    private config: ConfigService,
  ) {}

  private get aiUrl(): string {
    return this.config.get<string>('AI_SERVICE_URL') ?? 'http://localhost:8000';
  }

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
  async enroll(
    @Body() body: { user_id: string; tenant_id: string; images_base64: string[]; enrolled_via?: string },
  ) {
    try {
      const { data } = await firstValueFrom(
        this.httpService.post(`${this.aiUrl}/face/enroll`, {
          user_id: body.user_id,
          tenant_id: body.tenant_id,
          images_base64: body.images_base64,
          enrolled_via: body.enrolled_via ?? 'web',
        }),
      );
      return data;
    } catch (err: any) {
      const status = err?.response?.status ?? HttpStatus.BAD_GATEWAY;
      const message = err?.response?.data?.detail ?? 'AI servisi bilan aloqa yo\'q';
      throw new HttpException(message, status);
    }
  }

  @Get('enrollments/:userId')
  getEnrollments(@Param('userId') userId: string) {
    return this.faceService.getEnrollments(userId);
  }

  @Post('recognize')
  async recognize(
    @Body() body: { image_base64: string; tenant_id: string; branch_id: string; deviceToken: string },
  ) {
    const device = await this.prisma.branchDevice.findUnique({
      where: { deviceToken: body.deviceToken },
    });
    if (!device) throw new UnauthorizedException('Device ruxsatsiz');

    try {
      const { data } = await firstValueFrom(
        this.httpService.post(`${this.aiUrl}/face/recognize`, {
          image_base64: body.image_base64,
          tenant_id: body.tenant_id,
          branch_id: body.branch_id,
        }),
      );
      return data;
    } catch (err: any) {
      const status = err?.response?.status ?? HttpStatus.BAD_GATEWAY;
      const message = err?.response?.data?.detail ?? 'AI servisi bilan aloqa yo\'q';
      throw new HttpException(message, status);
    }
  }

  @Post('face-checkin')
  async faceCheckin(@Body() body: { userId: string; deviceToken: string }) {
    const device = await this.prisma.branchDevice.findUnique({
      where: { deviceToken: body.deviceToken },
      include: { branch: true },
    });
    if (!device) throw new UnauthorizedException('Device ruxsatsiz');

    const user = await this.prisma.user.findUnique({ where: { id: body.userId } });
    if (!user) throw new UnauthorizedException('Foydalanuvchi topilmadi');

    const record = await this.staffAttendance.checkIn(user.id, user.tenantId, device.branchId, 'face_auto');
    return { name: user.name, isLate: record.isLate };
  }

  @Post('manual-checkin')
  async manualCheckin(@Body() body: { login: string; password: string; deviceToken: string }) {
    const device = await this.prisma.branchDevice.findUnique({
      where: { deviceToken: body.deviceToken },
      include: { branch: true },
    });
    if (!device) throw new UnauthorizedException('Device ruxsatsiz');

    const user = await this.prisma.user.findFirst({
      where: { login: body.login, tenantId: device.branch.tenantId },
    });
    if (!user) throw new UnauthorizedException('Login yoki parol noto\'g\'ri');

    const match = await bcrypt.compare(body.password, user.passwordHash);
    if (!match) throw new UnauthorizedException('Login yoki parol noto\'g\'ri');

    const record = await this.staffAttendance.checkIn(user.id, user.tenantId, device.branchId, 'manual');
    return { name: user.name, isLate: record.isLate };
  }
}
