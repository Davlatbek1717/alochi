import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';
import { DevicesService } from './devices.service';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('devices')
@ApiBearerAuth()
@Controller('devices')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DevicesController {
  constructor(private devices: DevicesService) {}

  /**
   * Phase 18.2 — returns `{ device, token }` once at registration. The
   * token is a 90-day signed JWT; the kiosk stores it in localStorage.
   */
  @Post('register')
  @Roles(UserRole.filadmin, UserRole.superadmin)
  register(@Body() body: { branchId: string; deviceName: string }) {
    return this.devices.registerWithToken(body.branchId, body.deviceName);
  }

  @Get(':branchId')
  @Roles(UserRole.filadmin, UserRole.superadmin, UserRole.manager)
  listForBranch(@Param('branchId') branchId: string) {
    return this.devices.listForBranch(branchId);
  }

  /**
   * Phase 18.5 — single-device status snapshot.
   */
  @Get(':id/status')
  @Roles(UserRole.filadmin, UserRole.superadmin)
  status(@Param('id') id: string) {
    return this.devices.getStatus(id);
  }

  @Delete(':id')
  @Roles(UserRole.filadmin, UserRole.superadmin)
  deactivate(@Param('id') id: string) {
    return this.devices.deactivate(id);
  }
}
