import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { MonitoringService } from './monitoring.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

// ── ScreenCapture endpoints ──────────────────────────────────────────────────

@ApiTags('screenshots')
@ApiBearerAuth()
@Controller('devices/:deviceId/screenshots')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ScreenshotController {
  constructor(private svc: MonitoringService) {}

  @Post()
  @Roles(UserRole.filadmin, UserRole.superadmin)
  create(
    @Param('deviceId') deviceId: string,
    @Body()
    body: {
      studentId: string;
      s3Key: string;
      thumbnailKey: string;
      width: number;
      height: number;
      byteSize: number;
      appPackage?: string;
      url?: string;
      ocrText?: string;
    },
    @Request() req: any,
  ) {
    return this.svc.createScreenCapture({ deviceId, tenantId: req.user.tenantId, ...body });
  }
}

@ApiTags('screenshots')
@ApiBearerAuth()
@Controller('screenshots')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ScreenshotReviewController {
  constructor(private svc: MonitoringService) {}

  @Patch(':id/review')
  @Roles(UserRole.filadmin, UserRole.manager, UserRole.superadmin)
  review(
    @Param('id') id: string,
    @Body() body: { suspicious: boolean; reviewNote?: string },
    @Request() req: any,
  ) {
    return this.svc.reviewScreenshot(
      id,
      req.user.tenantId,
      req.user.userId,
      body.suspicious,
      body.reviewNote,
    );
  }
}

@ApiTags('screenshots')
@ApiBearerAuth()
@Controller('students/:studentId/screenshots')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StudentScreenshotController {
  constructor(private svc: MonitoringService) {}

  @Get()
  @Roles(UserRole.filadmin, UserRole.manager, UserRole.mentor, UserRole.superadmin)
  get(
    @Param('studentId') studentId: string,
    @Query('date') date: string | undefined,
    @Request() req: any,
  ) {
    return this.svc.getStudentScreenshots(studentId, req.user.tenantId, date);
  }
}

@ApiTags('screenshots')
@ApiBearerAuth()
@Controller('branches/:branchId/screenshots/recent')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BranchScreenshotController {
  constructor(private svc: MonitoringService) {}

  @Get()
  @Roles(UserRole.filadmin, UserRole.superadmin)
  get(
    @Param('branchId') _branchId: string,
    @Query('limit') limit: string | undefined,
    @Request() req: any,
  ) {
    return this.svc.getBranchRecentScreenshots(
      _branchId,
      req.user.tenantId,
      limit ? parseInt(limit, 10) : 100,
    );
  }
}

// ── PresenceCheck endpoints ──────────────────────────────────────────────────

@ApiTags('presence')
@ApiBearerAuth()
@Controller('devices/:deviceId/presence')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PresenceController {
  constructor(private svc: MonitoringService) {}

  @Post()
  @Roles(UserRole.filadmin, UserRole.superadmin)
  create(
    @Param('deviceId') deviceId: string,
    @Body()
    body: {
      studentId: string;
      s3Key: string;
      matchScore?: number;
      matched: boolean;
      faceDetected: boolean;
      liveness?: boolean;
      multipleFaces?: boolean;
    },
    @Request() req: any,
  ) {
    return this.svc.createPresenceCheck({ deviceId, tenantId: req.user.tenantId, ...body });
  }
}

@ApiTags('presence')
@ApiBearerAuth()
@Controller('students/:studentId/presence')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StudentPresenceController {
  constructor(private svc: MonitoringService) {}

  @Get()
  @Roles(UserRole.filadmin, UserRole.manager, UserRole.mentor, UserRole.superadmin)
  get(
    @Param('studentId') studentId: string,
    @Query('date') date: string | undefined,
    @Request() req: any,
  ) {
    return this.svc.getStudentPresence(studentId, req.user.tenantId, date);
  }
}

@ApiTags('presence')
@ApiBearerAuth()
@Controller('presence/anomalies')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PresenceAnomaliesController {
  constructor(private svc: MonitoringService) {}

  @Get()
  @Roles(UserRole.filadmin, UserRole.manager, UserRole.superadmin)
  get(@Query('limit') limit: string | undefined, @Request() req: any) {
    return this.svc.getPresenceAnomalies(
      req.user.tenantId,
      limit ? parseInt(limit, 10) : 50,
    );
  }
}

// ── CheatingSignal endpoints ─────────────────────────────────────────────────

@ApiTags('cheating')
@ApiBearerAuth()
@Controller('students/:studentId/cheating')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CheatingController {
  constructor(private svc: MonitoringService) {}

  @Get('signals')
  @Roles(UserRole.filadmin, UserRole.manager, UserRole.superadmin)
  getSignals(@Param('studentId') studentId: string, @Request() req: any) {
    return this.svc.getStudentSignals(studentId, req.user.tenantId);
  }

  @Get('score')
  @Roles(UserRole.filadmin, UserRole.manager, UserRole.superadmin)
  getScore(@Param('studentId') studentId: string, @Request() req: any) {
    return this.svc.getCheatingScore(studentId, req.user.tenantId);
  }
}

@ApiTags('cheating')
@ApiBearerAuth()
@Controller('cheating/signals')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CheatingSignalController {
  constructor(private svc: MonitoringService) {}

  @Patch(':id/resolve')
  @Roles(UserRole.filadmin, UserRole.manager, UserRole.superadmin)
  resolve(
    @Param('id') id: string,
    @Body() body: { resolution: string },
    @Request() req: any,
  ) {
    return this.svc.resolveSignal(id, req.user.tenantId, req.user.userId, body.resolution);
  }
}
