import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AttendanceStudentsService } from './attendance-students.service';
import { AttendanceStaffService } from './attendance-staff.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('attendance')
@ApiBearerAuth()
@Controller('attendance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AttendanceController {
  constructor(
    private studentsService: AttendanceStudentsService,
    private staffService: AttendanceStaffService,
  ) {}

  // ── Student attendance ───────────────────────────────────────────────────────

  @Post('students/bulk')
  @Roles(UserRole.mentor, UserRole.tester)
  markBulk(
    @Body() body: { records: Array<{ studentId: string; status: string }> },
    @Request() req: any,
  ) {
    const { tenantId, branchId, userId } = req.user as {
      tenantId: string;
      branchId: string;
      userId: string;
    };
    const date: string =
      (body as any).date ?? new Date().toISOString().split('T')[0];

    const records = body.records.map((r) => ({
      ...r,
      markedBy: userId,
      tenantId,
      branchId,
      date,
    }));

    return this.studentsService.markBulk(records);
  }

  @Get('students/:branchId/:date')
  @Roles(UserRole.mentor, UserRole.manager, UserRole.filadmin, UserRole.tester)
  getDailyList(
    @Param('branchId') branchId: string,
    @Param('date') date: string,
  ) {
    return this.studentsService.getDailyList(branchId, date);
  }

  // ── Staff attendance ─────────────────────────────────────────────────────────

  @Post('staff/checkin')
  @Roles(UserRole.mentor, UserRole.manager, UserRole.tester)
  checkIn(@Body('method') method: string, @Request() req: any) {
    const { userId, tenantId, branchId } = req.user as {
      userId: string;
      tenantId: string;
      branchId: string;
    };
    return this.staffService.checkIn(
      userId,
      tenantId,
      branchId,
      method ?? 'manual',
    );
  }

  @Post('staff/confirm/:userId')
  @Roles(UserRole.filadmin)
  confirm(
    @Param('userId') userId: string,
    @Body('date') date: string,
    @Request() req: any,
  ) {
    const confirmedBy: string = (req.user as { userId: string }).userId;
    const targetDate = date ?? new Date().toISOString().split('T')[0];
    return this.staffService.confirm(userId, confirmedBy, targetDate);
  }

  @Get('staff/:branchId/:date')
  @Roles(UserRole.filadmin, UserRole.manager)
  getDailyStaff(
    @Param('branchId') branchId: string,
    @Param('date') date: string,
  ) {
    return this.staffService.getDailyStaff(branchId, date);
  }
}
