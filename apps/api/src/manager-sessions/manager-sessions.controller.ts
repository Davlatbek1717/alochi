import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ManagerSessionsService } from './manager-sessions.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('manager-sessions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ManagerSessionsController {
  constructor(private sessions: ManagerSessionsService) {}

  @Get('mine')
  @Roles(UserRole.manager)
  listMine(@Request() req: any) {
    return this.sessions.listByManager(req.user.userId);
  }

  @Get('student/:studentId')
  @Roles(UserRole.manager, UserRole.filadmin, UserRole.superadmin)
  listForStudent(@Param('studentId') studentId: string) {
    return this.sessions.listByStudent(studentId);
  }

  @Post()
  @Roles(UserRole.manager)
  create(
    @Request() req: any,
    @Body()
    body: { studentId: string; scheduledAt: string; notes?: string },
  ) {
    return this.sessions.create({
      managerId: req.user.userId,
      studentId: body.studentId,
      scheduledAt: body.scheduledAt,
      notes: body.notes,
    });
  }

  @Patch(':id')
  @Roles(UserRole.manager)
  update(
    @Request() req: any,
    @Param('id') id: string,
    @Body()
    body: { scheduledAt?: string; completedAt?: string | null; notes?: string },
  ) {
    return this.sessions.update(id, req.user.userId, body);
  }

  @Patch(':id/complete')
  @Roles(UserRole.manager)
  complete(
    @Request() req: any,
    @Param('id') id: string,
    @Body('notes') notes?: string,
  ) {
    return this.sessions.markComplete(id, req.user.userId, notes);
  }

  @Delete(':id')
  @Roles(UserRole.manager)
  remove(@Request() req: any, @Param('id') id: string) {
    return this.sessions.remove(id, req.user.userId);
  }
}
