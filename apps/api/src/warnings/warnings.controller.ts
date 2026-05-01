import {
  Controller,
  Post,
  Patch,
  Get,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { WarningsService } from './warnings.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { CurrentDelegation } from '../common/decorators/current-delegation.decorator';
import {
  DelegationPermissionGuard,
  RequiresDelegationPermission,
} from '../delegations/guards/delegation-permission.guard';

@ApiTags('warnings')
@ApiBearerAuth()
@Controller('warnings')
@UseGuards(JwtAuthGuard, RolesGuard, DelegationPermissionGuard)
export class WarningsController {
  constructor(private warnings: WarningsService) {}

  @Get('my')
  @Roles(UserRole.student, UserRole.tester)
  getMyWarnings(@Request() req: any) {
    return this.warnings.findByStudent(req.user.userId);
  }

  /**
   * Issue a warning to :studentId.
   * Path-based per spec (POST /warnings/:studentId).
   * Per spec §3.1.4 + §3.2.4: only filadmin and superadmin can give warnings.
   */
  @Post(':studentId')
  @Roles(UserRole.filadmin, UserRole.superadmin)
  @RequiresDelegationPermission('warnings')
  give(
    @Param('studentId') studentId: string,
    @Body() body: any,
    @Request() req: any,
    @CurrentDelegation() delegationId: string | null,
  ) {
    return this.warnings.give({
      ...body,
      studentId,
      tenantId: req.user.tenantId,
      givenBy: req.user.userId,
      delegationId: delegationId ?? undefined,
    });
  }

  /**
   * Cancel (soft) a warning. Replaces legacy DELETE /warnings/:id.
   */
  @Patch(':warningId/cancel')
  @Roles(UserRole.filadmin, UserRole.superadmin)
  cancelWarning(
    @Param('warningId') warningId: string,
    @Body('reason') reason: string,
    @Request() req: any,
  ) {
    return this.warnings.cancel(warningId, req.user.userId, reason);
  }

  /**
   * List warnings of :studentId. Replaces legacy GET /warnings/student/:studentId.
   */
  @Get(':studentId')
  @Roles(UserRole.filadmin, UserRole.manager, UserRole.mentor)
  getByStudent(@Param('studentId') studentId: string) {
    return this.warnings.findByStudent(studentId);
  }
}
