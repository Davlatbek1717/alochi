import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
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

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard, DelegationPermissionGuard)
export class UsersController {
  constructor(private users: UsersService) {}

  @Get('my-profile')
  async myProfile(@Request() req: any) {
    return this.users.getProfile(req.user.userId);
  }

  @Post()
  @Roles(UserRole.superadmin, UserRole.filadmin)
  @RequiresDelegationPermission('staff_manage')
  create(
    @Body() dto: CreateUserDto,
    @Request() req: any,
    @CurrentDelegation() delegationId: string | null,
  ) {
    const callerRole: UserRole = req.user.role;

    // tenantId is always JWT-derived (single-tenant; no API consumer should
    // ever pick a tenant). Drop any client-supplied value, then set ours.
    delete (dto as any).tenantId;
    dto.tenantId = req.user.tenantId;

    // Non-superadmin callers cannot pick branchId either — force from JWT.
    if (callerRole !== UserRole.superadmin) {
      const callerBranchId: string | null = req.user.branchId ?? null;

      // filadmin/manager without a branch cannot create staff
      if (!callerBranchId) {
        throw new BadRequestException(
          'Sizning hisobingiz biror filialga biriktirilmagan. Avval superadmin orqali filial tayinlash kerak.',
        );
      }

      delete (dto as any).branchId;
      dto.branchId = callerBranchId;
    }

    // Roles that require a branch: reject if branchId is still null
    const branchRequiredRoles: UserRole[] = [
      UserRole.mentor,
      UserRole.manager,
      UserRole.tester,
      UserRole.student,
    ];
    if (branchRequiredRoles.includes(dto.role) && !dto.branchId) {
      throw new BadRequestException(
        "Mentor, menejer, tester va o'quvchi rollari uchun filial majburiy.",
      );
    }

    return this.users.create(dto, {
      userId: req.user.userId,
      delegationId,
    });
  }

  @Get('blocked')
  @Roles(UserRole.superadmin, UserRole.filadmin)
  findBlocked(
    @Query('reason') reason: 'warning' | 'payment' | undefined,
    @Query('branchId') branchId: string | undefined,
    @Request() req: any,
  ) {
    const effectiveBranch =
      req.user.role === UserRole.filadmin
        ? (req.user.branchId ?? branchId)
        : branchId;
    return this.users.findBlocked(req.user.tenantId, {
      reason,
      branchId: effectiveBranch,
    });
  }

  @Get('group/:groupId/avg-pass-rate')
  @Roles(
    UserRole.superadmin,
    UserRole.filadmin,
    UserRole.manager,
    UserRole.mentor,
  )
  getGroupAvgPassRate(@Param('groupId') groupId: string, @Request() req: any) {
    return this.users.getGroupAvgPassRate(groupId, req.user.tenantId);
  }

  @Get()
  @Roles(
    UserRole.superadmin,
    UserRole.filadmin,
    UserRole.manager,
    UserRole.tester,
  )
  findAll(
    @Query('branchId') branchId: string,
    @Query('role') role: UserRole,
    @Request() req: any,
  ) {
    // Manager is automatically scoped to its own branch in the service.
    return this.users.findAll(req.user.tenantId, branchId, role, {
      role: req.user.role,
      branchId: req.user.branchId ?? null,
    });
  }

  @Get('by-branch/:branchId')
  @Roles(
    UserRole.superadmin,
    UserRole.filadmin,
    UserRole.manager,
    UserRole.mentor,
  )
  findByBranch(@Param('branchId') branchId: string, @Request() req: any) {
    return this.users.findByBranch(branchId, req.user.tenantId);
  }

  @Get('group/:groupId')
  @Roles(
    UserRole.superadmin,
    UserRole.filadmin,
    UserRole.manager,
    UserRole.mentor,
  )
  findByGroup(@Param('groupId') groupId: string, @Request() req: any) {
    return this.users.findByGroup(groupId, req.user.tenantId);
  }

  @Get(':id')
  @Roles(
    UserRole.superadmin,
    UserRole.filadmin,
    UserRole.manager,
    UserRole.mentor,
  )
  findOne(@Param('id') id: string, @Request() req: any) {
    return this.users.findById(id, req.user.tenantId);
  }

  @Patch(':id')
  @Roles(UserRole.superadmin, UserRole.filadmin)
  update(
    @Param('id') id: string,
    @Body() data: UpdateUserDto,
    @Request() req: any,
  ) {
    return this.users.update(id, req.user.tenantId, data);
  }

  @Patch(':id/status')
  @Roles(UserRole.superadmin, UserRole.filadmin)
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: 'active' | 'inactive',
    @Request() req: any,
  ) {
    return this.users.updateStatus(id, req.user.tenantId, status);
  }

  /**
   * POST /users/:id/reset-password — admin-driven password reset.
   * The new password is provided in the body so the caller can communicate
   * it offline (no email infrastructure assumed).
   */
  @Post(':id/reset-password')
  @Roles(UserRole.superadmin, UserRole.filadmin)
  resetPassword(
    @Param('id') id: string,
    @Body('newPassword') newPassword: string,
    @Request() req: any,
  ) {
    return this.users.resetPassword(id, req.user.tenantId, newPassword);
  }

  /**
   * DELETE /users/:id — hard-delete a user and cascade-clean child rows.
   * Restricted to superadmin. Self-deletion is rejected so an admin
   * cannot accidentally lock themselves out.
   */
  @Delete(':id')
  @Roles(UserRole.superadmin)
  remove(@Param('id') id: string, @Request() req: any) {
    if (id === req.user.userId) {
      throw new ForbiddenException(
        "O'z hisobingizni o'chira olmaysiz. Boshqa superadmindan so'rang.",
      );
    }
    return this.users.remove(id, req.user.tenantId);
  }

  /**
   * GET /users/:id/block-status — derived block info from user.status
   * + warnings + payment.unblockAt.
   */
  @Get(':id/block-status')
  @Roles(
    UserRole.superadmin,
    UserRole.filadmin,
    UserRole.manager,
    UserRole.mentor,
  )
  getBlockStatus(@Param('id') id: string, @Request() req: any) {
    return this.users.getBlockStatus(id, req.user.tenantId);
  }

  /**
   * POST /users/:id/unblock — manually unblock a student.
   * Audit-logged via the users service.
   */
  @Post(':id/unblock')
  @Roles(UserRole.superadmin, UserRole.filadmin)
  unblock(
    @Param('id') id: string,
    @Body('reason') reason: string | undefined,
    @Request() req: any,
  ) {
    return this.users.unblock(id, req.user.tenantId, req.user.userId, reason);
  }
}
