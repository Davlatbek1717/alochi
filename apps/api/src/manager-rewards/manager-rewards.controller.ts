import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ManagerRewardsService } from './manager-rewards.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('manager-rewards')
@ApiBearerAuth()
@Controller('manager-rewards')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ManagerRewardsController {
  constructor(private rewards: ManagerRewardsService) {}

  @Post()
  @Roles(UserRole.manager, UserRole.filadmin, UserRole.superadmin)
  create(
    @Body()
    body: {
      studentId: string;
      type: string;
      title: string;
      description?: string;
    },
    @Request() req: any,
  ) {
    return this.rewards.create({
      tenantId: req.user.tenantId,
      branchId: req.user.branchId,
      managerId: req.user.userId,
      studentId: body.studentId,
      type: body.type,
      title: body.title,
      description: body.description,
    });
  }

  @Get()
  @Roles(UserRole.manager, UserRole.filadmin, UserRole.superadmin)
  list(@Query('branchId') branchId: string, @Request() req: any) {
    // Superadmin without a branch should see all rewards; otherwise
    // scope to the caller's branch (or the explicit query param).
    const effectiveBranch =
      branchId ??
      (req.user.role === UserRole.superadmin ? null : req.user.branchId);
    return this.rewards.listForBranch(req.user.tenantId, effectiveBranch);
  }

  @Get('student/:studentId')
  @Roles(
    UserRole.manager,
    UserRole.filadmin,
    UserRole.superadmin,
    UserRole.mentor,
  )
  listForStudent(@Param('studentId') studentId: string) {
    return this.rewards.listForStudent(studentId);
  }

  @Patch(':id')
  @Roles(UserRole.manager)
  update(
    @Param('id') id: string,
    @Body()
    body: { type?: string; title?: string; description?: string | null },
    @Request() req: any,
  ) {
    return this.rewards.update(
      id,
      { userId: req.user.userId, tenantId: req.user.tenantId },
      body,
    );
  }

  @Delete(':id')
  @Roles(UserRole.manager)
  remove(@Param('id') id: string, @Request() req: any) {
    return this.rewards.remove(id, {
      userId: req.user.userId,
      tenantId: req.user.tenantId,
    });
  }
}
