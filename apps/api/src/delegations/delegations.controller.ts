import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Res,
  UseGuards,
  Request,
} from '@nestjs/common';
import { Response } from 'express';
import { DelegationsService } from './delegations.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('delegations')
@ApiBearerAuth()
@Controller('delegations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DelegationsController {
  constructor(private delegations: DelegationsService) {}

  @Post()
  @Roles(UserRole.filadmin, UserRole.manager, UserRole.superadmin)
  create(@Body() body: any, @Request() req: any) {
    // tenantId, branchId, fromUserId are always derived from JWT — never from body
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { tenantId: _t, branchId: _b, fromUserId: _f, ...rest } = body;
    return this.delegations.create({
      ...rest,
      tenantId: req.user.tenantId,
      branchId: req.user.branchId ?? undefined,
      fromUserId: req.user.userId,
      startsAt: new Date(body.startsAt),
      endsAt: new Date(body.endsAt),
    });
  }

  @Get()
  findMine(@Request() req: any) {
    return this.delegations.findForUser(req.user.userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.delegations.findOne(id);
  }

  @Get(':id/audit')
  getAudit(@Param('id') id: string) {
    return this.delegations.getAuditLog(id);
  }

  @Get(':id/export')
  async exportPdf(@Param('id') id: string, @Res() res: Response) {
    const buffer = await this.delegations.exportToPdf(id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="delegation-${id}.pdf"`,
    });
    res.send(buffer);
  }

  @Post(':id/respond')
  respond(
    @Param('id') id: string,
    @Body() body: { action: 'accepted' | 'rejected'; reason?: string },
    @Request() req: any,
  ) {
    return this.delegations.respond(
      id,
      req.user.userId,
      body.action,
      body.reason,
    );
  }

  @Delete(':id')
  cancel(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @Request() req: any,
  ) {
    return this.delegations.cancel(id, req.user.userId, reason);
  }
}
