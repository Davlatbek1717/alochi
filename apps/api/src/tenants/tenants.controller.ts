import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('tenants')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TenantsController {
  constructor(private tenants: TenantsService) {}

  @Post()
  @Roles(UserRole.superadmin)
  create(@Body() dto: CreateTenantDto) {
    return this.tenants.create(dto);
  }

  @Get()
  @Roles(UserRole.superadmin)
  findAll() {
    return this.tenants.findAll();
  }

  @Get(':id')
  @Roles(UserRole.superadmin)
  findOne(@Param('id') id: string) {
    return this.tenants.findById(id);
  }
}
