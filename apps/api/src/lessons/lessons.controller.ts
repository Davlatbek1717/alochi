import { Controller, Get, Post, Body, Param, Patch, UseGuards, Request } from '@nestjs/common';
import { LessonsService } from './lessons.service';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('lessons')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LessonsController {
  constructor(private lessons: LessonsService) {}

  @Post()
  @Roles(UserRole.superadmin)
  create(@Body() dto: CreateLessonDto) {
    return this.lessons.create(dto);
  }

  @Get()
  findAll(@Request() req: any) {
    return this.lessons.findByTenant(req.user.tenantId);
  }

  @Get('next')
  @Roles(UserRole.student)
  getNext(@Request() req: any) {
    return this.lessons.getNextLesson(req.user.userId, req.user.tenantId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req: any) {
    return this.lessons.findById(id, req.user.tenantId);
  }

  @Patch(':id/publish')
  @Roles(UserRole.superadmin)
  publish(@Param('id') id: string, @Request() req: any) {
    return this.lessons.publish(id, req.user.tenantId);
  }
}
