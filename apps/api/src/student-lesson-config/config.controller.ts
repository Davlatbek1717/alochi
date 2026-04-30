import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { StudentConfigService } from './config.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('student-config')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StudentConfigController {
  constructor(private config: StudentConfigService) {}

  @Post(':studentId/:lessonId/n-override')
  @Roles(UserRole.manager)
  setNOverride(
    @Param('studentId') studentId: string,
    @Param('lessonId') lessonId: string,
    @Body('nRepetitions') nRepetitions: number,
    @Body('reason') reason: string | undefined,
    @Request() req: any,
  ) {
    return this.config.setNOverride({
      studentId,
      lessonId,
      tenantId: req.user.tenantId,
      managerId: req.user.userId,
      nRepetitions,
      reason,
    });
  }

  @Get(':studentId')
  @Roles(UserRole.manager, UserRole.filadmin)
  getConfigs(@Param('studentId') studentId: string) {
    return this.config.getStudentConfigs(studentId);
  }
}
