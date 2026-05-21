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
import { BranchesService } from './branches.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('branches')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BranchesController {
  constructor(private branches: BranchesService) {}

  @Post()
  @Roles(UserRole.superadmin)
  create(@Body() body: { name: string }, @Request() req: any) {
    return this.branches.create(req.user.tenantId, { name: body.name });
  }

  @Get()
  @Roles(UserRole.superadmin, UserRole.filadmin)
  findAll(@Request() req: any) {
    return this.branches.findByTenant(req.user.tenantId);
  }

  @Get('by-tenant/:tenantId')
  @Roles(UserRole.superadmin, UserRole.filadmin)
  findByTenant(@Param('tenantId') tenantId: string, @Request() req: any) {
    // Non-superadmin callers are always scoped to their own tenant; ignore
    // the URL param so a filadmin cannot enumerate another tenant's branches.
    const effectiveTenantId =
      req.user.role === UserRole.superadmin ? tenantId : req.user.tenantId;
    return this.branches.findByTenant(effectiveTenantId);
  }

  @Get(':id/stats')
  @Roles(UserRole.superadmin, UserRole.filadmin)
  getStats(@Param('id') id: string, @Request() req: any) {
    return this.branches.getStats(id, req.user.tenantId);
  }

  @Patch(':id')
  @Roles(UserRole.superadmin, UserRole.filadmin)
  update(
    @Param('id') id: string,
    @Body()
    body: {
      name?: string;
      workStartTime?: string;
      lateGraceMinutes?: number;
      chatLocked?: boolean;
      minDailyStudyMinutes?: number;
    },
    @Request() req: any,
  ) {
    return this.branches.update(id, req.user.tenantId, body);
  }

  @Delete(':id')
  @Roles(UserRole.superadmin)
  delete(@Param('id') id: string, @Request() req: any) {
    return this.branches.delete(id, req.user.tenantId);
  }

  @Patch(':id/filadmin')
  @Roles(UserRole.superadmin)
  assignFiladmin(
    @Param('id') id: string,
    @Body('filadminId') filadminId: string,
    @Body('tenantId') bodyTenantId: string | undefined,
    @Request() req: any,
  ) {
    // Always fall back to JWT tenantId — the frontend forms now derive
    // it from the token but legacy clients may still send it in body.
    // For non-superadmin roles the JWT value wins outright.
    const tenantId =
      req.user.role === UserRole.superadmin
        ? (bodyTenantId ?? req.user.tenantId)
        : req.user.tenantId;
    return this.branches.assignFiladmin(id, filadminId, tenantId);
  }
}
