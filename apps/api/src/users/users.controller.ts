import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private users: UsersService) {}

  @Post()
  @Roles(UserRole.superadmin, UserRole.filadmin)
  create(@Body() dto: CreateUserDto) {
    return this.users.create(dto);
  }

  @Get('by-branch/:branchId')
  @Roles(UserRole.superadmin, UserRole.filadmin, UserRole.manager)
  findByBranch(@Param('branchId') branchId: string, @Request() req: any) {
    return this.users.findByBranch(branchId, req.user.tenantId);
  }

  @Get(':id')
  @Roles(UserRole.superadmin, UserRole.filadmin, UserRole.manager)
  findOne(@Param('id') id: string, @Request() req: any) {
    return this.users.findById(id, req.user.tenantId);
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
