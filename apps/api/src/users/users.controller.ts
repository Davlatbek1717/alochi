import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private users: UsersService) {}

  @Get('my-profile')
  async myProfile(@Request() req: any) {
    return this.users.getProfile(req.user.userId);
  }

  @Post()
  @Roles(UserRole.superadmin, UserRole.filadmin)
  create(@Body() dto: CreateUserDto) {
    return this.users.create(dto);
  }

  @Get()
  @Roles(UserRole.superadmin, UserRole.filadmin)
  findAll(
    @Query('branchId') branchId: string,
    @Query('role') role: UserRole,
    @Request() req: any,
  ) {
    return this.users.findAll(req.user.tenantId, branchId, role);
  }

  @Get('by-branch/:branchId')
  @Roles(UserRole.superadmin, UserRole.filadmin, UserRole.manager, UserRole.mentor)
  findByBranch(@Param('branchId') branchId: string, @Request() req: any) {
    return this.users.findByBranch(branchId, req.user.tenantId);
  }

  @Get(':id')
  @Roles(UserRole.superadmin, UserRole.filadmin, UserRole.manager)
  findOne(@Param('id') id: string, @Request() req: any) {
    return this.users.findById(id, req.user.tenantId);
  }

  @Patch(':id')
  @Roles(UserRole.superadmin, UserRole.filadmin)
  update(@Param('id') id: string, @Body() data: any, @Request() req: any) {
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
}
