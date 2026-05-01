import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
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

  /**
   * Query-style alias used by the filadmin UI: `GET /promotion-reports?branchId=...`.
   * Falls back to caller's own reports when no branchId is given.
   */
  @Get()
  @Roles(UserRole.superadmin, UserRole.filadmin)
  listFlexible(@Request() req: any, @Query('branchId') branchId?: string) {
    if (branchId) return this.reports.listByBranch(branchId);
    return this.reports.list(req.user.userId);
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

  @Patch(':id')
  @Roles(UserRole.filadmin)
  update(
    @Param('id') id: string,
    @Request() req: any,
    @Body()
    body: {
      schoolName?: string;
      studentsReached?: number;
      visitDate?: string;
      notes?: string | null;
    },
  ) {
    return this.reports.update(id, req.user.userId, body);
  }

  @Delete(':id')
  @Roles(UserRole.filadmin)
  remove(@Param('id') id: string, @Request() req: any) {
    return this.reports.remove(id, req.user.userId);
  }
}
