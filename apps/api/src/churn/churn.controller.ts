import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';
import { ChurnService } from './churn.service';

@ApiTags('churn')
@ApiBearerAuth()
@Controller('churn')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ChurnController {
  constructor(private churn: ChurnService) {}

  @Get('high-risk')
  @Roles(UserRole.superadmin, UserRole.filadmin, UserRole.manager)
  getHighRisk(@Request() req: any, @Query('branchId') branchId?: string) {
    return this.churn.getHighRiskStudents(req.user.tenantId, branchId);
  }

  @Get('medium-risk')
  @Roles(UserRole.superadmin, UserRole.filadmin, UserRole.manager)
  getMediumRisk(@Request() req: any, @Query('branchId') branchId?: string) {
    return this.churn.getMediumRiskStudents(req.user.tenantId, branchId);
  }
}
