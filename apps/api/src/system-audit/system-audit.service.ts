import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Read-only access layer for the platform-level security audit log.
 *
 * The schema (model SystemAuditLog) records significant admin actions
 * — logins, role changes, user creation, tenant changes — for the
 * superadmin's audit dashboard. Writes happen elsewhere (auth, users,
 * tenants services); this service only surfaces the table.
 */
@Injectable()
export class SystemAuditService {
  constructor(private prisma: PrismaService) {}

  /**
   * Most-recent entries first. Capped at 200 by default to keep the
   * dashboard payload bounded; adjust on the client if pagination is
   * added later.
   */
  async list(limit = 200) {
    return this.prisma.systemAuditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
