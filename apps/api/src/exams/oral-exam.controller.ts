import {
  Body,
  Controller,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { OralExamService } from './oral-exam.service';

/**
 * Student-facing endpoints for AI oral exams. Mounted under
 * /exams/oral so the legacy and catalogue MCQ flows on `/exams/...`
 * stay untouched. Three turns:
 *
 *   POST /exams/oral/:permissionId/start    — start or resume session
 *   POST /exams/oral/:permissionId/respond  — student transcript turn
 *   POST /exams/oral/:permissionId/finalize — wrap up, get score
 */
@ApiTags('exams-oral')
@ApiBearerAuth()
@Controller('exams/oral')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.student)
export class OralExamController {
  constructor(private oral: OralExamService) {}

  @Post(':permissionId/start')
  start(@Param('permissionId') permissionId: string, @Request() req: any) {
    return this.oral.start(permissionId, req.user.userId);
  }

  @Post(':permissionId/respond')
  respond(
    @Param('permissionId') permissionId: string,
    @Body() body: { text: string },
    @Request() req: any,
  ) {
    return this.oral.respond(permissionId, req.user.userId, body.text ?? '');
  }

  @Post(':permissionId/finalize')
  finalize(@Param('permissionId') permissionId: string, @Request() req: any) {
    return this.oral.finalize(permissionId, req.user.userId);
  }
}
