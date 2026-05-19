import {
  Controller,
  Get,
  Query,
  UseGuards,
  Request,
  ParseEnumPipe,
  Req,
  Param,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';
import { AnalyticsService } from './analytics.service';
import { ChurnService } from './churn.service';

enum ActivityPeriod {
  weekly = 'weekly',
  monthly = 'monthly',
}

@ApiTags('analytics')
@ApiBearerAuth()
@Controller('analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AnalyticsController {
  constructor(
    private analytics: AnalyticsService,
    private churn: ChurnService,
  ) {}

  @Get('lessons')
  @Roles(UserRole.superadmin)
  getLessons(@Request() req: any) {
    return this.analytics.getLessonStats(req.user.tenantId);
  }

  @Get('branches')
  @Roles(UserRole.superadmin, UserRole.filadmin)
  getBranches(@Request() req: any) {
    return this.analytics.getBranchStats(req.user.tenantId);
  }

  @Get('activity')
  @Roles(UserRole.superadmin)
  getActivity(
    @Request() req: any,
    @Query('period', new ParseEnumPipe(ActivityPeriod, { optional: true }))
    period: ActivityPeriod = ActivityPeriod.monthly,
  ) {
    return this.analytics.getStudentActivity(req.user.tenantId, period);
  }

  @Get('cohort')
  @Roles(UserRole.superadmin, UserRole.filadmin)
  getCohort(@Req() req: any, @Query('weeks') weeks?: string) {
    const w = weeks ? Math.min(Math.max(parseInt(weeks, 10) || 8, 1), 26) : 8;
    return this.analytics.getCohortRetention(req.user.tenantId, w);
  }

  @Get('funnel/:lessonId')
  @Roles(UserRole.superadmin, UserRole.filadmin)
  getFunnel(@Req() req: any, @Param('lessonId') lessonId: string) {
    return this.analytics.getFunnel(req.user.tenantId, lessonId);
  }

  @Get('lifecycle')
  @Roles(UserRole.superadmin, UserRole.filadmin)
  getLifecycle(@Req() req: any) {
    return this.analytics.getLifecycle(req.user.tenantId);
  }

  @Get('failures')
  @Roles(UserRole.superadmin, UserRole.filadmin)
  getFailures(@Req() req: any, @Query('limit') limit?: string) {
    const lim = limit
      ? Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100)
      : 10;
    return this.analytics.getTopFailures(req.user.tenantId, lim);
  }

  @Get('comparison')
  @Roles(UserRole.superadmin)
  getComparison() {
    return this.analytics.getTenantComparison();
  }

  @Get('study-time')
  @Roles(UserRole.superadmin, UserRole.filadmin)
  getStudyTime(@Req() req: any, @Query('days') days?: string) {
    const d = days
      ? Math.min(Math.max(parseInt(days, 10) || 14, 1), 90)
      : 14;
    return this.analytics.getStudyTime(req.user.tenantId, d);
  }

  // ── AI sections (churn / growth / loyalty) ──────────────────────────

  @Get('churn')
  @Roles(UserRole.superadmin, UserRole.filadmin)
  getChurn(@Req() req: any, @Query('limit') limit?: string) {
    const lim = limit
      ? Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200)
      : 50;
    return this.churn.getChurnList(req.user.tenantId, lim);
  }

  @Get('churn/metrics')
  @Roles(UserRole.superadmin)
  getChurnMetrics() {
    return this.churn.getModelMetrics();
  }

  @Get('growth')
  @Roles(UserRole.superadmin, UserRole.filadmin)
  getGrowth(@Req() req: any, @Query('days') days?: string) {
    const d = days
      ? Math.min(Math.max(parseInt(days, 10) || 30, 1), 90)
      : 30;
    return this.analytics.getGrowth(req.user.tenantId, d);
  }

  @Get('loyalty')
  @Roles(UserRole.superadmin, UserRole.filadmin)
  getLoyalty(@Req() req: any) {
    return this.analytics.getLoyalty(req.user.tenantId);
  }
}
