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

enum ActivityPeriod {
  weekly = 'weekly',
  monthly = 'monthly',
}

@ApiTags('analytics')
@ApiBearerAuth()
@Controller('analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AnalyticsController {
  constructor(private analytics: AnalyticsService) {}

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
}
