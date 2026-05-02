import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ExamService } from './exam.service';
import { CreateExamDto, UpdateExamDto } from './exam.dto';

/**
 * Superadmin-only endpoints for managing the central exam catalogue.
 * Mounted at /exams/admin so it sits beside the legacy
 * lesson-permission flow without colliding on the bare /exams paths
 * the student exam runner already owns.
 */
@ApiTags('exams-admin')
@ApiBearerAuth()
@Controller('exams/admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.superadmin)
export class ExamAdminController {
  constructor(private exams: ExamService) {}

  @Get()
  list(@Request() req: any) {
    return this.exams.list(req.user.tenantId);
  }

  @Get(':id')
  getOne(@Param('id') id: string, @Request() req: any) {
    return this.exams.getOne(id, req.user.tenantId);
  }

  @Post()
  create(@Body() dto: CreateExamDto, @Request() req: any) {
    return this.exams.create(dto, req.user.tenantId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateExamDto,
    @Request() req: any,
  ) {
    return this.exams.update(id, dto, req.user.tenantId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req: any) {
    return this.exams.remove(id, req.user.tenantId);
  }
}
