import { Controller, Post, Get, Param, UseGuards, Request } from '@nestjs/common';
import { ProgressService } from './progress.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('progress')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProgressController {
  constructor(private progress: ProgressService) {}

  @Post(':lessonId/complete-session')
  @Roles(UserRole.student)
  completeSession(@Param('lessonId') lessonId: string, @Request() req: any) {
    return this.progress.completeSession(req.user.userId, lessonId, req.user.tenantId);
  }

  @Post(':lessonId/complete-academy/:studentId')
  @Roles(UserRole.tester, UserRole.mentor)
  completeAcademy(
    @Param('lessonId') lessonId: string,
    @Param('studentId') studentId: string,
  ) {
    return this.progress.markAcademyCompleted(studentId, lessonId);
  }

  @Get('my')
  @Roles(UserRole.student)
  myProgress(@Request() req: any) {
    return this.progress.getStudentProgress(req.user.userId);
  }
}
