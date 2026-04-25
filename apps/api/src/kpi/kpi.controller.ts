import { Controller, Post, Get, Body, UseGuards, Request, Query } from '@nestjs/common';
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
  async getMyHistory(@Request() req: any) {
    return this.kpi.getHistory(req.user.userId);
  }

  @Get('today')
  async getTodayTotal(@Request() req: any) {
    return this.kpi.getDailyTotal(req.user.userId, new Date());
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
