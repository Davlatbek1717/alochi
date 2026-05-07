import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';
import { SystemAuditService } from './system-audit.service';

/**
 * GET /audit-log — superadmin-only listing of recent system audit
 * events. Used by the Superadmin dashboard's "Xavfsizlik Audit Logi"
 * page.
 */
@ApiTags('audit-log')
@ApiBearerAuth()
@Controller('audit-log')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.superadmin)
export class SystemAuditController {
  constructor(private readonly svc: SystemAuditService) {}

  @Get()
  list() {
    return this.svc.list();
  }
}
