import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ExamQueueService } from './exam-queue.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('exam-queue')
@ApiBearerAuth()
@Controller('exam-queue')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ExamQueueController {
  constructor(private queue: ExamQueueService) {}

  @Post('join')
  @Roles(UserRole.student)
  join(@Body('lessonId') lessonId: string, @Request() req: any) {
    return this.queue.join({
      tenantId: req.user.tenantId,
      branchId: req.user.branchId,
      studentId: req.user.userId,
      lessonId,
    });
  }

  @Get()
  @Roles(UserRole.tester, UserRole.filadmin, UserRole.superadmin)
  list(@Query('branchId') branchId: string, @Request() req: any) {
    return this.queue.list(branchId ?? req.user.branchId, req.user.tenantId);
  }

  @Patch(':id/start')
  @Roles(UserRole.tester, UserRole.filadmin)
  start(@Param('id') id: string) {
    return this.queue.start(id);
  }

  @Patch(':id/complete')
  @Roles(UserRole.tester, UserRole.filadmin)
  complete(@Param('id') id: string) {
    return this.queue.complete(id);
  }
}
