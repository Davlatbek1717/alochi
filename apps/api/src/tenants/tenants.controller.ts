import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';
import { OnboardTenantDto } from './dto/onboard-tenant.dto';
import { UpdateTenantSettingsDto } from './dto/update-tenant-settings.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';

@Controller('tenants')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TenantsController {
  constructor(private tenants: TenantsService) {}

  @Post()
  @Roles(UserRole.superadmin)
  create(@Body() dto: CreateTenantDto) {
    return this.tenants.create(dto);
  }

  @Post('onboard')
  @Roles(UserRole.superadmin)
  onboard(@Body() dto: OnboardTenantDto) {
    return this.tenants.onboardTenant(dto);
  }

  @Get()
  @Roles(UserRole.superadmin)
  findAll() {
    return this.tenants.listAllWithCounts();
  }

  @Get(':id')
  @Roles(UserRole.superadmin)
  findOne(@Param('id') id: string) {
    return this.tenants.findById(id);
  }

  /**
   * Update tenant-level settings (currently: warningBlockLimit).
   * Only superadmin can change.
   */
  @Patch(':id/settings')
  @Roles(UserRole.superadmin)
  updateSettings(
    @Param('id') id: string,
    @Body() dto: UpdateTenantSettingsDto,
  ) {
    return this.tenants.updateSettings(id, dto);
  }

  /**
   * Phase 17 — rename a tenant.
   */
  @Patch(':id')
  @Roles(UserRole.superadmin)
  updateTenant(@Param('id') id: string, @Body() dto: UpdateTenantDto) {
    return this.tenants.updateName(id, dto.name);
  }

  /**
   * Phase 17 — disable a tenant (cascade-deactivates its users).
   */
  @Post(':id/disable')
  @Roles(UserRole.superadmin)
  disableTenant(@Param('id') id: string) {
    return this.tenants.disable(id);
  }
}
