import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
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

  /**
   * Create a lesson. Accessible to superadmin and filadmin.
   * tenantId is always taken from the caller's JWT so a filadmin can
   * only ever create inside their own tenant.
   */
  @Post()
  @Roles(UserRole.superadmin, UserRole.filadmin)
  create(@Body() dto: CreateLessonDto, @Request() req: any) {
    return this.lessons.create(dto, req.user.tenantId);
  }

  @Get()
  findAll(@Request() req: any) {
    return this.lessons.findByTenant(req.user.tenantId);
  }

  /**
   * GET /lessons/templates — list all superadmin-created template lessons.
   * Any authenticated role can browse templates; importing is restricted to
   * superadmin and filadmin via the import endpoint below.
   */
  @Get('templates')
  findTemplates() {
    return this.lessons.findTemplates();
  }

  /**
   * POST /lessons/import/:templateId — deep-copy a template lesson into
   * the caller's tenant. The copy is unpublished so the filadmin can
   * review and adapt it before students see it.
   */
  @Post('import/:templateId')
  @Roles(UserRole.superadmin, UserRole.filadmin)
  importTemplate(@Param('templateId') templateId: string, @Request() req: any) {
    return this.lessons.importFromTemplate(templateId, req.user.tenantId);
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
  @Roles(UserRole.superadmin, UserRole.filadmin)
  publish(@Param('id') id: string, @Request() req: any) {
    return this.lessons.publish(id, req.user.tenantId);
  }

  @Patch(':id')
  @Roles(UserRole.superadmin, UserRole.filadmin)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateLessonDto,
    @Request() req: any,
  ) {
    return this.lessons.update(id, req.user.tenantId, dto);
  }

  @Delete(':id')
  @Roles(UserRole.superadmin, UserRole.filadmin)
  delete(@Param('id') id: string, @Request() req: any) {
    return this.lessons.delete(id, req.user.tenantId);
  }

  @Post(':id/mcq')
  @Roles(UserRole.superadmin, UserRole.filadmin)
  setMcq(@Param('id') id: string, @Body('questions') questions: any[]) {
    return this.components.setMcq(id, questions);
  }

  @Post(':id/word-order')
  @Roles(UserRole.superadmin, UserRole.filadmin)
  setWordOrder(@Param('id') id: string, @Body('sentences') sentences: any[]) {
    return this.components.setWordOrder(id, sentences);
  }

  @Post(':id/vocabulary')
  @Roles(UserRole.superadmin, UserRole.filadmin)
  setVocabulary(@Param('id') id: string, @Body('words') words: any[]) {
    return this.components.setVocabulary(id, words);
  }

  @Get(':id/components')
  getComponents(@Param('id') id: string) {
    return this.components.getComponents(id);
  }
}
