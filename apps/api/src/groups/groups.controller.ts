import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { GroupsService } from './groups.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('groups')
@UseGuards(JwtAuthGuard, RolesGuard)
export class GroupsController {
  constructor(private groups: GroupsService) {}

  /**
   * GET /groups?branchId=
   * Superadmin can pass branchId; filadmin/manager uses their own branchId from JWT.
   */
  @Get()
  @Roles(UserRole.superadmin, UserRole.filadmin, UserRole.manager)
  async list(
    @Query('branchId') branchId: string | undefined,
    @Request() req: any,
  ) {
    const tenantId: string = req.user.tenantId;
    const role: UserRole = req.user.role;

    let resolvedBranchId: string;
    if (role === UserRole.superadmin) {
      if (!branchId) throw new BadRequestException('branchId majburiy');
      resolvedBranchId = branchId;
    } else {
      resolvedBranchId = req.user.branchId;
      if (!resolvedBranchId)
        throw new BadRequestException('Filial biriktirilmagan');
    }

    return this.groups.listForBranch(resolvedBranchId, tenantId);
  }

  /**
   * GET /groups/all — superadmin only, tenant-wide list with branch names
   */
  @Get('all')
  @Roles(UserRole.superadmin)
  listAll(@Request() req: any) {
    return this.groups.listForTenant(req.user.tenantId);
  }

  /**
   * POST /groups
   * Body: { branchId?, name, mentorId? }
   * Filadmin: branchId forced from JWT.
   * Superadmin: branchId from body required.
   */
  @Post()
  @Roles(UserRole.superadmin, UserRole.filadmin)
  async create(
    @Body() body: { branchId?: string; name: string; mentorId?: string },
    @Request() req: any,
  ) {
    const tenantId: string = req.user.tenantId;
    const role: UserRole = req.user.role;

    let branchId: string;
    if (role === UserRole.superadmin) {
      if (!body.branchId) throw new BadRequestException('branchId majburiy');
      branchId = body.branchId;
    } else {
      branchId = req.user.branchId;
      if (!branchId) throw new BadRequestException('Filial biriktirilmagan');
    }

    return this.groups.create(
      tenantId,
      branchId,
      body.name,
      body.mentorId ?? null,
    );
  }

  /**
   * PATCH /groups/:id
   * Body: { name?, mentorId? }  (mentorId: null to unassign)
   */
  @Patch(':id')
  @Roles(UserRole.superadmin, UserRole.filadmin)
  update(
    @Param('id') id: string,
    @Body() body: { name?: string; mentorId?: string | null },
    @Request() req: any,
  ) {
    return this.groups.update(id, req.user.tenantId, body);
  }

  /**
   * DELETE /groups/:id
   */
  @Delete(':id')
  @Roles(UserRole.superadmin, UserRole.filadmin)
  remove(@Param('id') id: string, @Request() req: any) {
    return this.groups.delete(id, req.user.tenantId);
  }

  /**
   * POST /groups/:id/students
   * Body: { studentIds: string[] }
   */
  @Post(':id/students')
  @Roles(UserRole.superadmin, UserRole.filadmin)
  addStudents(
    @Param('id') id: string,
    @Body('studentIds') studentIds: string[],
    @Request() req: any,
  ) {
    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      throw new BadRequestException('studentIds kerak');
    }
    return this.groups.addStudents(id, req.user.tenantId, studentIds);
  }

  /**
   * DELETE /groups/:id/students/:studentId
   */
  @Delete(':id/students/:studentId')
  @Roles(UserRole.superadmin, UserRole.filadmin)
  removeStudent(
    @Param('id') id: string,
    @Param('studentId') studentId: string,
    @Request() req: any,
  ) {
    return this.groups.removeStudent(id, req.user.tenantId, studentId);
  }
}
