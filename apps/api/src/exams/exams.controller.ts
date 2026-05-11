import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ExamsService } from './exams.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('exams')
@ApiBearerAuth()
@Controller('exams')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ExamsController {
  constructor(private exams: ExamsService) {}

  // Tester grants either a lesson-anchored exam (legacy `hasExam`
  // flow) or a standalone catalogue exam — exactly one of lessonId
  // / examId must be supplied. The service rejects mixed/empty input.
  @Post('grant')
  @Roles(UserRole.tester)
  grant(
    @Body() body: { studentId: string; lessonId?: string; examId?: string },
    @Request() req: any,
  ) {
    return this.exams.grant(req.user.userId, body.studentId, {
      lessonId: body.lessonId,
      examId: body.examId,
    });
  }

  // List published catalogue exams for the current tenant. Tester
  // uses this to pick a catalogue exam in the grant modal; mounted
  // under /exams (not /exams/admin) so the tester role can read
  // without inheriting full superadmin CRUD.
  @Get('available')
  @Roles(UserRole.tester)
  listAvailable(@Request() req: any) {
    return this.exams.listAvailableForTester(req.user.tenantId);
  }

  @Get('my-active')
  @Roles(UserRole.student)
  getMyActive(@Request() req: any) {
    return this.exams.getMyActive(req.user.userId);
  }

  @Post(':id/submit')
  @Roles(UserRole.student)
  submit(
    @Param('id') id: string,
    @Body() body: { answers?: number[]; results?: boolean[] },
    @Request() req: any,
  ) {
    return this.exams.submit(id, req.user.userId, {
      answers: body.answers,
      results: body.results,
    });
  }

  @Patch(':id/cancel')
  @Roles(UserRole.tester, UserRole.filadmin)
  cancelPermission(@Param('id') id: string) {
    return this.exams.cancelPermission(id);
  }

  @Get('student/:studentId')
  @Roles(
    UserRole.tester,
    UserRole.filadmin,
    UserRole.manager,
    UserRole.mentor,
    UserRole.superadmin,
  )
  getStudentExams(@Param('studentId') studentId: string) {
    return this.exams.getStudentExams(studentId);
  }

  @Get('branch/active')
  @Roles(UserRole.tester)
  getBranchActive(@Request() req: any) {
    return this.exams.getPendingForBranch(req.user.branchId);
  }
}
