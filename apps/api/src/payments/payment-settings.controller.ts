import { Controller, Get, Put, Body, UseGuards, Request } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

/**
 * Payment-settings endpoints split out from /payments/* for clearer routing.
 * Mounts at /payment-settings.
 */
@ApiTags('payment-settings')
@ApiBearerAuth()
@Controller('payment-settings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PaymentSettingsController {
  constructor(private payments: PaymentsService) {}

  @Get()
  @Roles(UserRole.superadmin)
  getSettings(@Request() req: any) {
    return this.payments.getSettingForTenant(req.user.tenantId);
  }

  @Put()
  @Roles(UserRole.superadmin)
  updateSettings(
    @Body() body: { startDay: number; endDay: number },
    @Request() req: any,
  ) {
    return this.payments.updateSettings(
      req.user.tenantId,
      body.startDay,
      body.endDay,
      req.user.userId,
    );
  }
}
