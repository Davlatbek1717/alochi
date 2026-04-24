import { Controller, Post, Get, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { DelegationsService } from './delegations.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('delegations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DelegationsController {
  constructor(private delegations: DelegationsService) {}

  @Post()
  @Roles(UserRole.filadmin, UserRole.manager)
  create(@Body() body: any, @Request() req: any) {
    return this.delegations.create({
      ...body,
      tenantId: req.user.tenantId,
      fromUserId: req.user.userId,
      startsAt: new Date(body.startsAt),
      endsAt: new Date(body.endsAt),
    });
  }

  @Get()
  findMine(@Request() req: any) {
    return this.delegations.findForUser(req.user.userId);
  }

  @Get(':id/audit')
  getAudit(@Param('id') id: string) {
    return this.delegations.getAuditLog(id);
  }

  @Post(':id/respond')
  respond(@Param('id') id: string, @Body() body: { action: 'accepted' | 'rejected'; reason?: string }, @Request() req: any) {
    return this.delegations.respond(id, req.user.userId, body.action, body.reason);
  }

  @Delete(':id')
  cancel(@Param('id') id: string, @Body('reason') reason: string, @Request() req: any) {
    return this.delegations.cancel(id, req.user.userId, reason);
  }
}
