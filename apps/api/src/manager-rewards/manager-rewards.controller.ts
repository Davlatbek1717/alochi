import {
  Body,
  Controller,
  Get,
  Param,
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
    return this.rewards.listForBranch(
      req.user.tenantId,
      branchId ?? req.user.branchId,
    );
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
}
