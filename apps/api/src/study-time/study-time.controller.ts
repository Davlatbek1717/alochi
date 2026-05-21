import {
  Controller,
  Post,
  Put,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { StudyTimeService } from './study-time.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';
import { Throttle } from '@nestjs/throttler';

@ApiTags('study-time')
@ApiBearerAuth()
@Controller('study-time')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StudyTimeController {
  constructor(private studyTime: StudyTimeService) {}

  /**
   * Heartbeat from the student web app. Body: `{ deltaSeconds }`.
   * Counts all active (visible + not idle) time toward the daily cap.
   * Heavily clamped server-side — see StudyTimeService.
   */
  // Ping is expected every 60s — allow up to 2/min with some burst headroom
  @Throttle({ short: { limit: 5, ttl: 60_000 }, medium: { limit: 5, ttl: 60_000 } })
  @Post('ping')
  @Roles(UserRole.student)
  ping(
    @Body() body: { deltaSeconds?: number; clientTimestamp?: number },
    @Request() req: any,
  ) {
    if (body?.clientTimestamp !== undefined) {
      const driftMs = Math.abs(Date.now() - body.clientTimestamp);
      if (driftMs > 5 * 60 * 1000) {
        throw new BadRequestException({
          code: 'CLOCK_SKEW',
          message: 'Qurilma vaqti server vaqtidan 5 daqiqadan ko\'proq farq qiladi',
          driftSeconds: Math.round(driftMs / 1000),
        });
      }
    }
    return this.studyTime.recordPing(
      {
        userId: req.user.userId,
        tenantId: req.user.tenantId,
        branchId: req.user.branchId,
      },
      body ?? {},
    );
  }

  /** The student's own minutes today + their branch's daily requirement. */
  @Get('me/today')
  @Roles(UserRole.student)
  myToday(@Request() req: any) {
    return this.studyTime.myToday({
      userId: req.user.userId,
      branchId: req.user.branchId,
    });
  }

  /**
   * Read-only session gate for the SessionGuard: may the student study
   * now, or are they on a forced break / daily cap reached?
   */
  @Get('gate')
  @Roles(UserRole.student)
  gate(@Request() req: any) {
    return this.studyTime.getGate(req.user.userId);
  }

  /** Current session policy (daily cap / work block / break minutes). */
  @Get('policy')
  @Roles(UserRole.superadmin, UserRole.filadmin)
  getPolicy() {
    return this.studyTime.getPolicy();
  }

  /** Superadmin sets the session policy. */
  @Put('policy')
  @Roles(UserRole.superadmin)
  setPolicy(
    @Body()
    body: {
      dailyCapMinutes?: number;
      workBlockMinutes?: number;
      breakMinutes?: number;
    },
  ) {
    return this.studyTime.setPolicy(body ?? {});
  }

  /**
   * Filadmin: all students in the branch with today's study minutes and a
   * `below` flag for those under the branch minimum.
   */
  @Get('branch/today')
  @Roles(UserRole.filadmin, UserRole.superadmin)
  branchToday(@Request() req: any) {
    return this.studyTime.branchToday({
      tenantId: req.user.tenantId,
      branchId: req.user.branchId,
    });
  }

  /**
   * Per-student daily study-minutes trend (last `days`, default 7, max 30).
   * Role-scoped inside the service (branch for filadmin/manager, group for
   * mentor, anywhere for superadmin).
   */
  @Get('student/:id/history')
  @Roles(
    UserRole.filadmin,
    UserRole.manager,
    UserRole.mentor,
    UserRole.superadmin,
  )
  studentHistory(
    @Param('id') id: string,
    @Query('days') days: string | undefined,
    @Request() req: any,
  ) {
    return this.studyTime.studentHistory(
      {
        userId: req.user.userId,
        role: req.user.role,
        tenantId: req.user.tenantId,
        branchId: req.user.branchId,
      },
      id,
      days ? Number(days) : undefined,
    );
  }

  /**
   * One student's activity timeline for a Tashkent day
   * (?date=YYYY-MM-DD, defaults to today). Role-scoped inside the
   * service (tenant-wide for superadmin, branch for filadmin/manager,
   * group for mentor).
   */
  @Get('student/:id/activity')
  @Roles(
    UserRole.filadmin,
    UserRole.manager,
    UserRole.mentor,
    UserRole.superadmin,
  )
  studentActivity(
    @Param('id') id: string,
    @Query('date') date: string | undefined,
    @Request() req: any,
  ) {
    return this.studyTime.studentActivity(
      {
        userId: req.user.userId,
        role: req.user.role,
        tenantId: req.user.tenantId,
        branchId: req.user.branchId,
      },
      id,
      date,
    );
  }

  /**
   * Role-aware "today" list — mentor sees their group, filadmin/manager
   * their branch. Same payload as /branch/today.
   */
  @Get('scope/today')
  @Roles(UserRole.filadmin, UserRole.manager, UserRole.mentor)
  scopeToday(@Request() req: any) {
    return this.studyTime.scopeToday({
      userId: req.user.userId,
      role: req.user.role,
      tenantId: req.user.tenantId,
      branchId: req.user.branchId,
    });
  }

  /**
   * Live presence snapshot — who is actively studying right now (last ping
   * ≤ 2 min) and which lesson they last touched. Mentor → own group,
   * filadmin/manager → branch. Polled every 30s by the frontend.
   */
  @Get('scope/snapshot')
  @Roles(UserRole.filadmin, UserRole.manager, UserRole.mentor)
  liveSnapshot(@Request() req: any) {
    return this.studyTime.liveSnapshot({
      userId: req.user.userId,
      role: req.user.role,
      tenantId: req.user.tenantId,
      branchId: req.user.branchId,
    });
  }

  /**
   * Role-aware total study time over a date range
   * (?from=YYYY-MM-DD&to=YYYY-MM-DD, max 92 days).
   */
  @Get('scope/range')
  @Roles(UserRole.filadmin, UserRole.manager, UserRole.mentor)
  scopeRange(
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Request() req: any,
  ) {
    return this.studyTime.scopeRange(
      {
        userId: req.user.userId,
        role: req.user.role,
        tenantId: req.user.tenantId,
        branchId: req.user.branchId,
      },
      from,
      to,
    );
  }
}
