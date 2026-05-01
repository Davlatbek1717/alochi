import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  UseGuards,
  Request,
} from '@nestjs/common';
import { LessonsService } from './lessons.service';
import { ComponentsService } from './components.service';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('lessons')
@ApiBearerAuth()
@Controller('lessons')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LessonsController {
  constructor(
    private lessons: LessonsService,
    private components: ComponentsService,
  ) {}

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
  @Roles(UserRole.student, UserRole.tester)
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

  @Patch(':id')
  @Roles(UserRole.superadmin)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateLessonDto,
    @Request() req: any,
  ) {
    return this.lessons.update(id, req.user.tenantId, dto);
  }

  @Post(':id/mcq')
  @Roles(UserRole.superadmin)
  setMcq(@Param('id') id: string, @Body('questions') questions: any[]) {
    return this.components.setMcq(id, questions);
  }

  @Post(':id/word-order')
  @Roles(UserRole.superadmin)
  setWordOrder(@Param('id') id: string, @Body('sentences') sentences: any[]) {
    return this.components.setWordOrder(id, sentences);
  }

  @Post(':id/vocabulary')
  @Roles(UserRole.superadmin)
  setVocabulary(@Param('id') id: string, @Body('words') words: any[]) {
    return this.components.setVocabulary(id, words);
  }

  @Get(':id/components')
  getComponents(@Param('id') id: string) {
    return this.components.getComponents(id);
  }
}
