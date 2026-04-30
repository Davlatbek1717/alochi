import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { PromotionReportService } from './promotion-report.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('promotion-reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PromotionReportController {
  constructor(private reports: PromotionReportService) {}

  @Get('mine')
  @Roles(UserRole.filadmin)
  listMine(@Request() req: any) {
    return this.reports.list(req.user.userId);
  }

  @Get('branch/:branchId')
  @Roles(UserRole.superadmin, UserRole.filadmin)
  listByBranch(@Param('branchId') branchId: string) {
    return this.reports.listByBranch(branchId);
  }

  @Post()
  @Roles(UserRole.filadmin)
  create(
    @Request() req: any,
    @Body()
    body: {
      schoolName: string;
      studentsReached: number;
      visitDate: string;
      notes?: string;
      branchId?: string;
    },
  ) {
    const branchId = body.branchId ?? req.user.branchId;
    if (!branchId) {
      throw new BadRequestException('branchId majburiy');
    }
    return this.reports.create({
      filadminId: req.user.userId,
      branchId,
      schoolName: body.schoolName,
      studentsReached: body.studentsReached,
      visitDate: body.visitDate,
      notes: body.notes,
    });
  }
}
