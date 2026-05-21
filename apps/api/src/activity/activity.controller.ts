import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ActivityService } from './activity.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('activity')
@ApiBearerAuth()
@Controller('activity')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ActivityController {
  constructor(private svc: ActivityService) {}

  /**
   * Called by the web client via sendBeacon on page exit.
   * Body: single entry or array of entries (batch).
   */
  @Post()
  @Roles(UserRole.student)
  record(
    @Body()
    body: {
      sessionId: string;
      url: string;
      pageType: string;
      resourceId?: string;
      deviceId?: string;
      enteredAt: number;
      leftAt?: number;
      durationSec?: number;
      scrollDepthPct?: number;
      interactionCount?: number;
      blurEventsCount?: number;
      exitReason?: string;
    }[],
    @Request() req: any,
  ) {
    const entries = (Array.isArray(body) ? body : [body]).map((e) => ({
      ...e,
      enteredAt: new Date(e.enteredAt),
      leftAt: e.leftAt !== undefined ? new Date(e.leftAt) : undefined,
    }));
    return this.svc.recordBatch(req.user.userId, req.user.tenantId, entries);
  }
}

@ApiTags('activity')
@ApiBearerAuth()
@Controller('students/:studentId')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StudentActivityController {
  constructor(private svc: ActivityService) {}

  @Get('activity')
  @Roles(UserRole.filadmin, UserRole.manager, UserRole.mentor, UserRole.superadmin)
  getTimeline(
    @Param('studentId') studentId: string,
    @Query('date') date: string | undefined,
    @Request() req: any,
  ) {
    return this.svc.getStudentTimeline(studentId, req.user.tenantId, date);
  }

  @Get('heatmap')
  @Roles(UserRole.filadmin, UserRole.manager, UserRole.mentor, UserRole.superadmin)
  getHeatmap(
    @Param('studentId') studentId: string,
    @Query('days') days: string | undefined,
    @Request() req: any,
  ) {
    return this.svc.getHeatmap(
      studentId,
      req.user.tenantId,
      days ? parseInt(days, 10) : 7,
    );
  }
}
