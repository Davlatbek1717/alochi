import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  BadRequestException,
  ForbiddenException,
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

  // Academic attendance is mentor-owned: only a mentor may record who
  // came to class, and only for students in their OWN group. Testers
  // (exam queue) no longer write attendance — they read the mentor's
  // marking. Group ownership is enforced in the service.
  private static readonly VALID_STATUSES = new Set(['present', 'absent', 'late']);

  @Post('students')
  @Roles(UserRole.mentor)
  markBulk(
    @Body() body: { records: Array<{ studentId: string; status: string }> },
    @Request() req: any,
  ) {
    const { tenantId, branchId, userId } = req.user as {
      tenantId: string;
      branchId: string;
      userId: string;
    };

    const invalid = body.records?.find(
      (r) => !AttendanceController.VALID_STATUSES.has(r.status),
    );
    if (invalid) {
      throw new BadRequestException(
        `Noto'g'ri status: "${invalid.status}". Faqat present, absent, late qabul qilinadi`,
      );
    }

    const date: string =
      (body as any).date ?? new Date().toISOString().split('T')[0];

    const records = body.records.map((r) => ({
      ...r,
      markedBy: userId,
      tenantId,
      branchId,
      date,
    }));

    return this.studentsService.markBulk(records, userId);
  }

  @Get('students/my-history')
  @Roles(UserRole.student)
  getMyHistory(@Query('days') daysStr: string, @Request() req: any) {
    const days = Math.min(Math.max(parseInt(daysStr, 10) || 30, 1), 180);
    return this.studentsService.getStudentHistory(
      (req.user as { userId: string }).userId,
      days,
    );
  }

  @Get('students/:branchId/:date')
  @Roles(UserRole.mentor, UserRole.manager, UserRole.filadmin, UserRole.tester)
  getDailyList(
    @Param('branchId') branchId: string,
    @Param('date') date: string,
    @Request() req: any,
  ) {
    const user = req.user as { role: string; branchId?: string | null };
    if (
      user.role === UserRole.mentor &&
      user.branchId &&
      user.branchId !== branchId
    ) {
      throw new ForbiddenException("Faqat o'z filialingizni ko'rishingiz mumkin");
    }
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

  @Get('staff/today/:branchId')
  @Roles(UserRole.filadmin, UserRole.manager, UserRole.superadmin)
  getStaffTodayCount(@Param('branchId') branchId: string) {
    return this.staffService.getTodayCount(branchId);
  }

  @Get('staff/:branchId/:date')
  @Roles(UserRole.filadmin, UserRole.manager)
  getDailyStaff(
    @Param('branchId') branchId: string,
    @Param('date') date: string,
  ) {
    return this.staffService.getDailyStaff(branchId, date);
  }

  /**
   * 25.D.2: Staff attendance history range query.
   *   GET /attendance/staff?branchId=&from=YYYY-MM-DD&to=YYYY-MM-DD
   */
  @Get('staff')
  @Roles(UserRole.filadmin, UserRole.superadmin)
  getStaffHistory(
    @Query('branchId') branchId: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.staffService.getHistory(branchId, from, to);
  }
}
