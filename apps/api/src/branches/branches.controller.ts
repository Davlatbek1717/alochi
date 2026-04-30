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
  findByTenant(@Param('tenantId') tenantId: string) {
    return this.branches.findByTenant(tenantId);
  }

  @Patch(':id')
  @Roles(UserRole.superadmin)
  update(
    @Param('id') id: string,
    @Body() body: { name: string },
    @Request() req: any,
  ) {
    return this.branches.update(id, req.user.tenantId, { name: body.name });
  }

  @Patch(':id/filadmin')
  @Roles(UserRole.superadmin)
  assignFiladmin(
    @Param('id') id: string,
    @Body('filadminId') filadminId: string,
    @Body('tenantId') bodyTenantId: string,
    @Request() req: any,
  ) {
    // Superadmin passes tenantId in body; other roles use JWT tenantId
    const tenantId =
      req.user.role === UserRole.superadmin ? bodyTenantId : req.user.tenantId;
    return this.branches.assignFiladmin(id, filadminId, tenantId);
  }
}
