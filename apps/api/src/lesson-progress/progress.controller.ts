import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ProgressService } from './progress.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('progress')
@ApiBearerAuth()
@Controller('progress')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProgressController {
  constructor(private progress: ProgressService) {}

  @Post(':lessonId/complete-session')
  @Roles(UserRole.student, UserRole.tester)
  completeSession(
    @Param('lessonId') lessonId: string,
    @Body() body: { videoWatched?: number; videoDuration?: number },
    @Request() req: any,
  ) {
    // 25.J.1: enforce 90% watch when caller reports the metric.
    if (
      typeof body?.videoWatched === 'number' &&
      typeof body?.videoDuration === 'number'
    ) {
      this.progress.assertVideoWatched(body.videoWatched, body.videoDuration);
    }
    return this.progress.completeSession(
      req.user.userId,
      lessonId,
      req.user.tenantId,
    );
  }

  @Post(':lessonId/complete-academy/:studentId')
  @Roles(UserRole.tester, UserRole.mentor)
  completeAcademy(
    @Param('lessonId') lessonId: string,
    @Param('studentId') studentId: string,
  ) {
    return this.progress.markAcademyCompleted(studentId, lessonId);
  }

  /**
   * POST /progress/:studentId/academy — start academy session for a student.
   * Body: { lessonId }. Returns the (created/upserted) StudentProgress row.
   */
  @Post(':studentId/academy')
  @Roles(UserRole.tester, UserRole.mentor)
  startAcademy(
    @Param('studentId') studentId: string,
    @Body() body: { lessonId: string },
  ) {
    return this.progress.startAcademySession(studentId, body.lessonId);
  }

  @Get('my')
  @Roles(UserRole.student, UserRole.tester)
  myProgress(@Request() req: any) {
    return this.progress.getStudentProgress(req.user.userId);
  }

  /**
   * GET /progress/:studentId/summary — staff-facing roll-up used by the
   * mentor student-detail header (lesson count chip). Returns the count
   * of academy-completed lessons for the student.
   */
  @Get(':studentId/summary')
  @Roles(UserRole.mentor, UserRole.manager, UserRole.filadmin)
  getSummary(@Param('studentId') studentId: string) {
    return this.progress.getSummary(studentId);
  }
}
