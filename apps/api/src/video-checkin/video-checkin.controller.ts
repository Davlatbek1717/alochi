import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  Request,
  Res,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';
import { VideoCheckinService } from './video-checkin.service';

interface JwtUser {
  userId: string;
  tenantId: string;
  role: UserRole;
  branchId?: string | null;
  groupId?: string | null;
}

@ApiTags('video-checkins')
@ApiBearerAuth()
@Controller('video-checkins')
@UseGuards(JwtAuthGuard, RolesGuard)
export class VideoCheckinController {
  constructor(private service: VideoCheckinService) {}

  /**
   * GET /video-checkins/today?branchId=
   *
   * Returns today's check-in status for all active students in a branch.
   * Accessible by filadmin (own branch), mentor (own branch), manager, superadmin.
   */
  @Get('today')
  @Roles(
    UserRole.filadmin,
    UserRole.mentor,
    UserRole.manager,
    UserRole.superadmin,
  )
  async getToday(
    @Query('branchId') branchId: string,
    @Request() req: { user: JwtUser },
  ) {
    if (!branchId) {
      throw new BadRequestException('branchId parametri talab etiladi');
    }
    // Filadmin can only see their own branch
    if (req.user.role === UserRole.filadmin) {
      if (req.user.branchId && req.user.branchId !== branchId) {
        throw new ForbiddenException(
          "Siz faqat o'z filialingizni ko'ra olasiz",
        );
      }
    }
    return this.service.getTodayList(branchId);
  }

  /**
   * GET /video-checkins/monitoring?date=YYYY-MM-DD
   *
   * Dedicated daily monitoring — role-scoped inside the service
   * (mentor → own group, filadmin/manager → own branch, superadmin →
   * tenant). Defaults to today; past dates show finalised status.
   */
  @Get('monitoring')
  @Roles(
    UserRole.filadmin,
    UserRole.mentor,
    UserRole.manager,
    UserRole.superadmin,
  )
  async getMonitoring(
    @Query('date') date: string | undefined,
    @Request() req: { user: JwtUser },
  ) {
    return this.service.getMonitoring(
      {
        userId: req.user.userId,
        role: req.user.role,
        tenantId: req.user.tenantId,
        branchId: req.user.branchId ?? null,
        groupId: req.user.groupId ?? null,
      },
      date,
    );
  }

  /**
   * GET /video-checkins/student/:studentId/history?days=30
   *
   * History for a student. Student can only see their own; staff can see any.
   */
  @Get('student/:studentId/history')
  @Roles(
    UserRole.student,
    UserRole.mentor,
    UserRole.filadmin,
    UserRole.manager,
    UserRole.superadmin,
  )
  async getHistory(
    @Param('studentId') studentId: string,
    @Query('days') daysStr: string,
    @Request() req: { user: JwtUser },
  ) {
    if (req.user.role === UserRole.student && req.user.userId !== studentId) {
      throw new ForbiddenException(
        "Faqat o'zingizning tarixingizni ko'ra olasiz",
      );
    }
    const days = daysStr ? parseInt(daysStr, 10) : 30;
    if (isNaN(days) || days < 1 || days > 365) {
      throw new BadRequestException("days 1-365 oraligida bo'lishi kerak");
    }
    return this.service.getStudentHistory(studentId, days);
  }

  /**
   * GET /video-checkins/student/:studentId/missed-count?since=30
   *
   * Simple missed-count counter for badges.
   */
  @Get('student/:studentId/missed-count')
  @Roles(
    UserRole.student,
    UserRole.mentor,
    UserRole.filadmin,
    UserRole.manager,
    UserRole.superadmin,
  )
  async getMissedCount(
    @Param('studentId') studentId: string,
    @Query('since') sinceStr: string,
    @Request() req: { user: JwtUser },
  ) {
    if (req.user.role === UserRole.student && req.user.userId !== studentId) {
      throw new ForbiddenException("Faqat o'zingizni tekshira olasiz");
    }
    const since = sinceStr ? parseInt(sinceStr, 10) : 30;
    if (isNaN(since) || since < 1 || since > 365) {
      throw new BadRequestException("since 1-365 oraligida bo'lishi kerak");
    }
    const count = await this.service.getMissedCount(studentId, since);
    return { count };
  }

  /**
   * GET /video-checkins/:id/video
   *
   * Streams the bot-recorded video back to the dashboard. Auth-checked
   * inside the service: superadmin / filadmin (own branch) / manager
   * (own branch) / mentor (own group) / the student themself.
   * Bypasses the response envelope so a <video> blob fetch sees raw
   * bytes; sets Content-Type so the player picks the right codec.
   */
  @Get(':id/video')
  @Roles(
    UserRole.student,
    UserRole.mentor,
    UserRole.filadmin,
    UserRole.manager,
    UserRole.superadmin,
  )
  async streamVideo(
    @Param('id') id: string,
    @Request() req: { user: JwtUser },
    @Res() res: Response,
  ) {
    const { buffer, mimeType } = await this.service.getVideoBytes(id, {
      role: req.user.role,
      userId: req.user.userId,
      tenantId: req.user.tenantId,
      branchId: req.user.branchId ?? null,
      groupId: req.user.groupId ?? null,
    });
    res.set({
      'Content-Type': mimeType,
      'Content-Length': String(buffer.length),
      'Cache-Control': 'private, no-store',
    });
    res.send(buffer);
  }
}
