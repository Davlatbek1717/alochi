import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
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
  constructor(
    private churn: ChurnService,
    private http: HttpService,
    private config: ConfigService,
  ) {}

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

  @Get('model-metrics')
  @Roles(UserRole.superadmin)
  async getModelMetrics() {
    const mlUrl = this.config.get<string>('ML_SERVICE_URL');
    if (!mlUrl) return { error: 'ML service not configured' };
    try {
      const response = await firstValueFrom(this.http.get(`${mlUrl}/metrics`));
      return response.data;
    } catch (e) {
      return { error: `Failed to fetch metrics: ${(e as Error).message}` };
    }
  }
}
