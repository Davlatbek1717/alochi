import {
  Controller,
  Get,
  Param,
  Post,
  Body,
  Request,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { CacheService } from './cache.service';
import { FaceService } from './face.service';
import { PrismaService } from '../prisma/prisma.service';
import { AttendanceStaffService } from '../attendance/attendance-staff.service';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { EnrollFaceDto, RecognizeFaceDto } from './dto/enroll.dto';

@ApiTags('face')
@ApiBearerAuth()
@Controller('face')
export class FaceController {
  constructor(
    private cacheService: CacheService,
    private faceService: FaceService,
    private prisma: PrismaService,
    private staffAttendance: AttendanceStaffService,
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

    return this.cacheService.generateBranchCache(
      branchId,
      device.branch.tenantId,
    );
  }

  /**
   * PDPL §533: enrollment payload contains math vectors only.
   * The legacy `images_base64` field is rejected by the global
   * ValidationPipe (forbidNonWhitelisted: true) → HTTP 400.
   */
  @Post('enroll')
  async enroll(@Body() body: EnrollFaceDto) {
    const enrolled = await this.faceService.enrollFromVectors(
      body.user_id,
      body.tenant_id,
      body.embeddings,
      body.enrolled_via ?? 'web',
    );
    return { id: enrolled.id, status: 'ok' };
  }

  @Get('enrollments/:userId')
  getEnrollments(@Param('userId') userId: string) {
    return this.faceService.getEnrollments(userId);
  }

  /**
   * PDPL §533: recognition takes the precomputed vector from the kiosk.
   * Server-side cosine search uses the pgvector index.
   */
  @Post('recognize')
  async recognize(@Body() body: RecognizeFaceDto) {
    const device = await this.prisma.branchDevice.findUnique({
      where: { deviceToken: body.deviceToken },
    });
    if (!device) throw new UnauthorizedException('Device ruxsatsiz');
    if (device.branchId !== body.branch_id) {
      throw new UnauthorizedException('Device branch mismatch');
    }

    const pgVecLiteral = `[${body.embedding.join(',')}]`;
    const matches = await this.prisma.$queryRaw<
      {
        user_id: string;
        name: string;
        similarity: number;
      }[]
    >`
      SELECT
        fe.user_id,
        u.name,
        1 - (fe.embedding <=> ${pgVecLiteral}::vector) AS similarity
      FROM face_embeddings fe
      JOIN users u ON u.id = fe.user_id
      WHERE fe.tenant_id = ${body.tenant_id}::uuid
        AND fe.is_active = true
        AND u.branch_id = ${body.branch_id}::uuid
      ORDER BY fe.embedding <=> ${pgVecLiteral}::vector
      LIMIT 1
    `;

    if (!matches.length || matches[0].similarity < 0.8) {
      throw new BadRequestException('Yuz aniqlanmadi');
    }

    return {
      user_id: matches[0].user_id,
      name: matches[0].name,
      confidence: matches[0].similarity,
    };
  }

  @Post('face-checkin')
  async faceCheckin(@Body() body: { userId: string; deviceToken: string }) {
    const device = await this.prisma.branchDevice.findUnique({
      where: { deviceToken: body.deviceToken },
      include: { branch: true },
    });
    if (!device) throw new UnauthorizedException('Device ruxsatsiz');

    const user = await this.prisma.user.findUnique({
      where: { id: body.userId },
    });
    if (!user) throw new UnauthorizedException('Foydalanuvchi topilmadi');

    const record = await this.staffAttendance.checkIn(
      user.id,
      user.tenantId,
      device.branchId,
      'face_auto',
    );
    return { name: user.name, isLate: record.isLate };
  }

  @Post('manual-checkin')
  async manualCheckin(
    @Body() body: { login: string; password: string; deviceToken: string },
  ) {
    const device = await this.prisma.branchDevice.findUnique({
      where: { deviceToken: body.deviceToken },
      include: { branch: true },
    });
    if (!device) throw new UnauthorizedException('Device ruxsatsiz');

    const user = await this.prisma.user.findFirst({
      where: { login: body.login, tenantId: device.branch.tenantId },
    });
    if (!user) throw new UnauthorizedException("Login yoki parol noto'g'ri");

    const match = await bcrypt.compare(body.password, user.passwordHash);
    if (!match) throw new UnauthorizedException("Login yoki parol noto'g'ri");

    const record = await this.staffAttendance.checkIn(
      user.id,
      user.tenantId,
      device.branchId,
      'manual',
    );
    return { name: user.name, isLate: record.isLate };
  }
}
