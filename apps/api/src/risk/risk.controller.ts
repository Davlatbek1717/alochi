import {
  Controller,
  Get,
  Param,
  Query,
  Request,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RiskService } from './risk.service';

@UseGuards(JwtAuthGuard)
@Controller('risk')
export class RiskController {
  constructor(private readonly riskService: RiskService) {}

  @Get('student/:studentId')
  getStudentRisk(
    @Request() req: any,
    @Param('studentId') studentId: string,
  ) {
    return this.riskService.getStudentRisk(studentId, req.user.tenantId);
  }

  @Get('branch/:branchId')
  getBranchRisk(
    @Request() req: any,
    @Param('branchId') branchId: string,
    @Query('date') date?: string,
  ) {
    return this.riskService.getBranchRisk(branchId, req.user.tenantId, date);
  }

  @Get('distribution')
  getDistribution(@Request() req: any, @Query('date') date?: string) {
    return this.riskService.getDistribution(req.user.tenantId, date);
  }

  @Post('recompute/student/:studentId')
  recompute(@Request() req: any, @Param('studentId') studentId: string) {
    return this.riskService.computeForStudent(studentId, req.user.tenantId);
  }
}
