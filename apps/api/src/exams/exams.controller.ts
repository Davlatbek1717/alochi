import {
  Controller,
  Post,
  Get,
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

  @Post('grant')
  @Roles(UserRole.tester)
  grant(
    @Body() body: { studentId: string; lessonId: string },
    @Request() req: any,
  ) {
    return this.exams.grant(req.user.userId, body.studentId, body.lessonId);
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
    @Body('answers') answers: number[],
    @Request() req: any,
  ) {
    return this.exams.submit(id, req.user.userId, answers ?? []);
  }

  @Get('student/:studentId')
  @Roles(UserRole.tester, UserRole.filadmin, UserRole.manager)
  getStudentExams(@Param('studentId') studentId: string) {
    return this.exams.getStudentExams(studentId);
  }

  @Get('branch/active')
  @Roles(UserRole.tester)
  getBranchActive(@Request() req: any) {
    return this.exams.getPendingForBranch(req.user.branchId);
  }
}
