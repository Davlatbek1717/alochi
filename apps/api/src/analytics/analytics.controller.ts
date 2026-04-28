import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';
import { AnalyticsService } from './analytics.service';

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
    @Query('period') period: 'weekly' | 'monthly' = 'monthly',
  ) {
    return this.analytics.getStudentActivity(req.user.tenantId, period);
  }
}
