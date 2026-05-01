import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
  Query,
  Param,
} from '@nestjs/common';
import { KpiService } from './kpi.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

interface AwardKpiBodyDto {
  userId: string;
  score: number;
  reason: string;
  taskId?: string;
  delegationId?: string;
}

@ApiTags('kpi')
@ApiBearerAuth()
@Controller('kpi')
@UseGuards(JwtAuthGuard)
export class KpiController {
  constructor(private kpi: KpiService) {}

  @Post('award')
  @UseGuards(RolesGuard)
  @Roles(UserRole.filadmin, UserRole.manager)
  async award(@Body() body: AwardKpiBodyDto, @Request() req: any) {
    return this.kpi.award({
      tenantId: req.user.tenantId,
      userId: body.userId,
      score: body.score,
      reason: body.reason,
      taskId: body.taskId,
      delegationId: body.delegationId,
    });
  }

  @Get('my')
  async getMyHistory(@Request() req: any, @Query('limit') limit?: string) {
    const parsed = limit ? parseInt(limit, 10) : NaN;
    const safeLimit =
      Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 100) : 30;
    return this.kpi.getHistory(req.user.userId, safeLimit);
  }

  @Get('today')
  async getTodayTotal(@Request() req: any) {
    return this.kpi.getDailyTotal(req.user.userId, new Date());
  }

  /**
   * Spec-aligned alias for `/kpi/today`. Same handler, different path so
   * frontends can call `/kpi/daily` per design docs without breaking
   * legacy callers.
   */
  @Get('daily')
  async getDailyTotal(@Request() req: any) {
    return this.kpi.getDailyTotal(req.user.userId, new Date());
  }

  /**
   * Branch KPI award history — paginated list of awards for any user in
   * the given branch within the (optional) ?from=&to= window.
   * Filadmins use this to review awards they have given this month.
   */
  @Get('by-branch/:branchId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.superadmin, UserRole.filadmin, UserRole.manager)
  async getByBranch(
    @Param('branchId') branchId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
  ) {
    const parsed = limit ? parseInt(limit, 10) : NaN;
    const safeLimit =
      Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 200) : 100;
    return this.kpi.getBranchHistory(branchId, {
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      limit: safeLimit,
    });
  }

  @Get('monthly')
  async getMonthlyTotal(
    @Request() req: any,
    @Query('year') year: string,
    @Query('month') month: string,
  ) {
    const parsedYear = parseInt(year, 10);
    const parsedMonth = parseInt(month, 10);

    if (isNaN(parsedYear) || isNaN(parsedMonth)) {
      throw new Error('Invalid year or month');
    }

    return this.kpi.getMonthlyTotal(req.user.userId, parsedYear, parsedMonth);
  }
}
