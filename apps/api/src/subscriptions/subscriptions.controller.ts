import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  Request,
  UseGuards,
} from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('subscriptions')
@ApiBearerAuth()
@Controller('subscriptions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SubscriptionsController {
  constructor(private readonly svc: SubscriptionsService) {}

  /**
   * GET /subscriptions/me
   * Filadmin (or superadmin) retrieves their own tenant's subscription.
   */
  @Get('me')
  @Roles(UserRole.superadmin, UserRole.filadmin)
  getMe(@Request() req: any) {
    return this.svc.getForTenant(req.user.tenantId);
  }

  /**
   * PATCH /subscriptions/:tenantId
   * Superadmin manual plan override — useful for early customers on
   * the "manual" gateway or for support interventions.
   */
  @Patch(':tenantId')
  @Roles(UserRole.superadmin)
  update(
    @Param('tenantId') tenantId: string,
    @Body()
    body: {
      plan?: string;
      status?: string;
      gateway?: string;
      gatewaySubscriptionId?: string;
      currentPeriodStart?: string;
      currentPeriodEnd?: string;
    },
  ) {
    return this.svc.upsert(tenantId, {
      plan: body.plan ?? 'starter',
      status: body.status ?? 'trialing',
      gateway: body.gateway,
      gatewaySubscriptionId: body.gatewaySubscriptionId,
      currentPeriodStart: body.currentPeriodStart
        ? new Date(body.currentPeriodStart)
        : undefined,
      currentPeriodEnd: body.currentPeriodEnd
        ? new Date(body.currentPeriodEnd)
        : undefined,
    });
  }
}
