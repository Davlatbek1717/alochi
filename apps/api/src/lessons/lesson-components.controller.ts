import {
  Body,
  Controller,
  Delete,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/roles.decorator';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import {
  CreateLessonComponentDto,
  UpdateLessonComponentDto,
} from './dto/create-component.dto';
import { LessonComponentsService } from './lesson-components.service';

/**
 * Pass 1: generic CRUD for any of the 12 component types
 * (`COMPONENT_TYPES`). Mounted under `/lessons/:lessonId/components` so
 * the URL is consistent with the existing GET listing
 * (`/lessons/:id/components`) defined in {@link LessonsController}.
 */
@ApiTags('lessons')
@ApiBearerAuth()
@Controller('lessons/:lessonId/components')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LessonComponentsController {
  constructor(private components: LessonComponentsService) {}

  @Post()
  @Roles(UserRole.superadmin)
  create(
    @Param('lessonId') lessonId: string,
    @Body() dto: CreateLessonComponentDto,
    @Request() req: any,
  ) {
    return this.components.create(lessonId, req.user.tenantId, dto);
  }

  @Patch(':id')
  @Roles(UserRole.superadmin)
  update(
    @Param('lessonId') lessonId: string,
    @Param('id') id: string,
    @Body() dto: UpdateLessonComponentDto,
    @Request() req: any,
  ) {
    return this.components.update(lessonId, id, req.user.tenantId, dto);
  }

  @Delete(':id')
  @Roles(UserRole.superadmin)
  remove(
    @Param('lessonId') lessonId: string,
    @Param('id') id: string,
    @Request() req: any,
  ) {
    return this.components.remove(lessonId, id, req.user.tenantId);
  }
}
