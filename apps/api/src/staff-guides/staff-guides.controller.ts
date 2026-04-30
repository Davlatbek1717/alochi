import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { StaffGuidesService } from './staff-guides.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('staff-guides')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StaffGuidesController {
  constructor(private guides: StaffGuidesService) {}

  @Get()
  @Roles(
    UserRole.superadmin,
    UserRole.filadmin,
    UserRole.manager,
    UserRole.mentor,
    UserRole.tester,
  )
  list(@Request() req: any, @Query('role') role?: string) {
    return this.guides.list(req.user.tenantId, role);
  }

  @Post()
  @Roles(UserRole.superadmin)
  create(
    @Request() req: any,
    @Body()
    body: { title: string; role: string; videoUrl: string; order?: number },
  ) {
    return this.guides.create({
      tenantId: req.user.tenantId,
      createdBy: req.user.userId,
      title: body.title,
      role: body.role,
      videoUrl: body.videoUrl,
      order: body.order,
    });
  }

  @Patch(':id')
  @Roles(UserRole.superadmin)
  update(
    @Request() req: any,
    @Param('id') id: string,
    @Body()
    body: { title?: string; role?: string; videoUrl?: string; order?: number },
  ) {
    return this.guides.update(id, req.user.tenantId, body);
  }

  @Delete(':id')
  @Roles(UserRole.superadmin)
  remove(@Request() req: any, @Param('id') id: string) {
    return this.guides.remove(id, req.user.tenantId);
  }
}
