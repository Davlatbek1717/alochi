import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole, TaskStatus } from '@prisma/client';
import { TasksService } from './tasks.service';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('tasks')
@ApiBearerAuth()
@Controller('tasks')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TasksController {
  constructor(private tasks: TasksService) {}

  @Post()
  @Roles(UserRole.superadmin, UserRole.filadmin, UserRole.manager)
  create(
    @Body()
    body: {
      assignedTo: string;
      title: string;
      description?: string;
      checklist?: { text: string; done: boolean }[];
      deadline?: string;
      kpiBall?: number;
    },
    @Request() req: any,
  ) {
    return this.tasks.create({
      tenantId: req.user.tenantId,
      branchId: req.user.branchId,
      createdBy: req.user.userId,
      ...body,
    });
  }

  @Get('my')
  getMyTasks(@Request() req: any) {
    return this.tasks.getMyTasks(req.user.userId);
  }

  @Get('sent')
  @Roles(UserRole.superadmin, UserRole.filadmin, UserRole.manager)
  getSentTasks(@Request() req: any) {
    return this.tasks.getSentTasks(req.user.userId);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: TaskStatus,
    @Request() req: any,
  ) {
    return this.tasks.updateStatus(id, req.user.userId, status);
  }

  @Patch(':id/confirm')
  @Roles(UserRole.superadmin, UserRole.filadmin, UserRole.manager)
  confirm(@Param('id') id: string, @Request() req: any) {
    return this.tasks.confirm(id, req.user.userId);
  }
}
