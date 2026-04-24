import { Controller, Get, Post, Patch, Body, Param, UseGuards, Request } from '@nestjs/common';
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
  create(@Body() body: { tenantId: string; name: string }) {
    return this.branches.create(body.tenantId, { name: body.name });
  }

  @Get('by-tenant/:tenantId')
  @Roles(UserRole.superadmin, UserRole.filadmin)
  findByTenant(@Param('tenantId') tenantId: string) {
    return this.branches.findByTenant(tenantId);
  }

  @Patch(':id/filadmin')
  @Roles(UserRole.superadmin)
  assignFiladmin(
    @Param('id') id: string,
    @Body('filadminId') filadminId: string,
    @Request() req: any,
  ) {
    return this.branches.assignFiladmin(id, filadminId, req.user.tenantId);
  }
}
