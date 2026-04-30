import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';
import { AdaptiveService } from './adaptive.service';

@ApiTags('adaptive')
@ApiBearerAuth()
@Controller('adaptive')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdaptiveController {
  constructor(private adaptive: AdaptiveService) {}

  @Get('config')
  @Roles(UserRole.superadmin)
  getConfig(@Request() req: any) {
    return this.adaptive.getAdaptiveConfig(req.user.tenantId);
  }

  @Patch('config')
  @Roles(UserRole.superadmin)
  updateConfig(@Request() req: any, @Body() body: any) {
    return this.adaptive.updateAdaptiveConfig(req.user.tenantId, body);
  }

  @Get('logs/:studentId')
  @Roles(UserRole.superadmin, UserRole.manager, UserRole.mentor)
  getLogs(@Param('studentId') studentId: string) {
    return this.adaptive.getStudentAdaptiveLogs(studentId);
  }

  @Get('last-run')
  @Roles(UserRole.superadmin)
  getLastRun() {
    return this.adaptive.getLastRun();
  }
}
