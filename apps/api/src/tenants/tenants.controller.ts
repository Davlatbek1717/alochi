import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Body,
  Param,
  Request,
  UseGuards,
  ForbiddenException,
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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  create(@Body() _dto: CreateTenantDto): never {
    throw new ForbiddenException(
      "Yangi markaz qo'shish endi qo'llab-quvvatlanmaydi. Loyiha bitta markaz uchun mo'ljallangan.",
    );
  }

  @Post('onboard')
  @Roles(UserRole.superadmin)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onboard(@Body() _dto: OnboardTenantDto): never {
    throw new ForbiddenException(
      "Yangi markaz qo'shish endi qo'llab-quvvatlanmaydi. Loyiha bitta markaz uchun mo'ljallangan.",
    );
  }

  @Get()
  @Roles(UserRole.superadmin)
  findAll() {
    return this.tenants.listAllWithCounts();
  }

  /**
   * Branding for the caller's own tenant.
   *
   * Any authenticated user inside the tenant can read their own
   * tenant's branding (logo, accent colour, brand name) so the
   * dashboard chrome can render correctly. The /tenants/:id endpoint
   * stays superadmin-only — this is the public-shape variant scoped
   * to req.user.tenantId, so RBAC stays clean and we don't leak
   * billing or operational fields.
   */
  @Get('me/branding')
  getMyBranding(@Request() req: any) {
    return this.tenants.getBrandingById(req.user.tenantId);
  }

  /** 25.C.3: Read certificate template for the calling tenant. */
  @Get('me/cert-template')
  @Roles(UserRole.superadmin)
  getCertTemplate(@Request() req: any) {
    return this.tenants.getCertTemplate(req.user.tenantId);
  }

  /** 25.C.3: Update certificate template for the calling tenant. */
  @Put('me/cert-template')
  @Roles(UserRole.superadmin)
  setCertTemplate(
    @Request() req: any,
    @Body('certTemplate') certTemplate: unknown,
  ) {
    return this.tenants.setCertTemplate(req.user.tenantId, certTemplate);
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
