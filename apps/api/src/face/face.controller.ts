import {
  Controller,
  Get,
  Param,
  Post,
  Delete,
  Body,
  Request,
  UnauthorizedException,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { CacheService } from './cache.service';
import { FaceService } from './face.service';
import { DevicesService } from './devices.service';
import { PrismaService } from '../prisma/prisma.service';
import { AttendanceStaffService } from '../attendance/attendance-staff.service';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { EnrollFaceDto, RecognizeFaceDto } from './dto/enroll.dto';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('face')
@ApiBearerAuth()
@Controller('face')
export class FaceController {
  constructor(
    private cacheService: CacheService,
    private faceService: FaceService,
    private devicesService: DevicesService,
    private prisma: PrismaService,
    private staffAttendance: AttendanceStaffService,
  ) {}

  @Get('cache/:branchId')
  async getCache(@Param('branchId') branchId: string, @Request() req: any) {
    const deviceToken = req.headers['x-device-token'];
    if (!deviceToken) throw new UnauthorizedException('Device token kerak');

    const device = await this.devicesService.validateToken(deviceToken);
    if (device.branchId !== branchId) {
      throw new UnauthorizedException('Device ruxsatsiz');
    }

    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
    });
    if (!branch) throw new UnauthorizedException('Branch topilmadi');

    await this.prisma.branchDevice.update({
      where: { id: device.id },
      data: { lastCacheSync: new Date() },
    });

    // Phase 18.9: encrypted variant when FACE_VECTOR_KEY is set, plaintext
    // fallback in dev. Kiosks holding the key decrypt client-side.
    return this.cacheService.generateEncryptedBranchCache(
      branchId,
      branch.tenantId,
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

  // ---- Phase 18.3 — DELETE enrollment ----

  @Delete('enroll')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    UserRole.student,
    UserRole.mentor,
    UserRole.filadmin,
    UserRole.manager,
    UserRole.tester,
  )
  async deleteOwnEnrollment(@Request() req: any) {
    return this.faceService.deactivateEnrollment(req.user.userId);
  }

  @Delete('enroll/:userId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.filadmin, UserRole.superadmin)
  async deleteEnrollment(@Param('userId') userId: string) {
    return this.faceService.deactivateEnrollment(userId);
  }

  // ---- Phase 18.4 — enrollment status ----

  @Get('enroll/status')
  @UseGuards(JwtAuthGuard)
  async myEnrollmentStatus(@Request() req: any) {
    return this.faceService.getEnrollmentStatus(req.user.userId);
  }

  @Get('enroll/:userId/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.filadmin, UserRole.superadmin)
  async enrollmentStatus(@Param('userId') userId: string) {
    return this.faceService.getEnrollmentStatus(userId);
  }

  /**
   * PDPL §533: recognition takes the precomputed vector from the kiosk.
   * Server-side cosine search uses the pgvector index.
   */
  @Post('recognize')
  async recognize(@Body() body: RecognizeFaceDto) {
    const device = await this.devicesService.validateToken(body.deviceToken);
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
      // Phase 18.6: track consecutive fails per device.
      this.faceService.registerRecognitionFailure(device.id, device.branchId);
      throw new BadRequestException('Yuz aniqlanmadi');
    }

    this.faceService.registerRecognitionSuccess(device.id);
    return {
      user_id: matches[0].user_id,
      name: matches[0].name,
      confidence: matches[0].similarity,
    };
  }

  @Post('face-checkin')
  async faceCheckin(
    @Body()
    body: {
      userId: string;
      deviceToken: string;
      livenessPassed?: boolean;
      confidence?: number;
    },
  ) {
    const device = await this.devicesService.validateToken(body.deviceToken);
    const branch = await this.prisma.branch.findUnique({
      where: { id: device.branchId },
    });
    if (!branch) throw new UnauthorizedException('Branch topilmadi');

    const user = await this.prisma.user.findUnique({
      where: { id: body.userId },
    });
    if (!user) throw new UnauthorizedException('Foydalanuvchi topilmadi');

    const record = await this.staffAttendance.checkIn(
      user.id,
      user.tenantId,
      device.branchId,
      'face_auto',
      { confidence: body.confidence, deviceId: device.id },
    );
    return {
      name: user.name,
      isLate: record.isLate,
      lateMinutes: record.lateMinutes,
      livenessPassed: body.livenessPassed ?? false,
    };
  }

  @Post('manual-checkin')
  async manualCheckin(
    @Body() body: { login: string; password: string; deviceToken: string },
  ) {
    const device = await this.devicesService.validateToken(body.deviceToken);
    const branch = await this.prisma.branch.findUnique({
      where: { id: device.branchId },
    });
    if (!branch) throw new UnauthorizedException('Branch topilmadi');

    const user = await this.prisma.user.findFirst({
      where: { login: body.login, tenantId: branch.tenantId },
    });
    if (!user) throw new UnauthorizedException("Login yoki parol noto'g'ri");

    const match = await bcrypt.compare(body.password, user.passwordHash);
    if (!match) throw new UnauthorizedException("Login yoki parol noto'g'ri");

    const record = await this.staffAttendance.checkIn(
      user.id,
      user.tenantId,
      device.branchId,
      'manual',
      { deviceId: device.id },
    );
    return {
      name: user.name,
      isLate: record.isLate,
      lateMinutes: record.lateMinutes,
    };
  }
}
