import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Request,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
  constructor(
    private readonly svc: SubscriptionsService,
    private readonly config: ConfigService,
  ) {}

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
   * POST /subscriptions/checkout
   * Filadmin initiates a Stripe Checkout session for their tenant.
   * Returns { url } — frontend redirects window.location.href to it.
   */
  @Post('checkout')
  @Roles(UserRole.filadmin, UserRole.superadmin)
  async checkout(@Body('plan') plan: string, @Request() req: any) {
    if (!['starter', 'pro', 'enterprise'].includes(plan)) {
      throw new BadRequestException(
        'Invalid plan. Must be starter, pro, or enterprise.',
      );
    }
    const returnBaseUrl =
      this.config.get<string>('NEXT_PUBLIC_FRONTEND_URL') ??
      'http://localhost:3000';
    const url = await this.svc.createCheckoutSession(
      req.user.tenantId,
      plan as 'starter' | 'pro' | 'enterprise',
      returnBaseUrl,
    );
    return { url };
  }

  /**
   * POST /subscriptions/portal
   * Returns a Stripe Customer Portal URL for plan management.
   */
  @Post('portal')
  @Roles(UserRole.filadmin, UserRole.superadmin)
  async portal(@Request() req: any) {
    const returnBaseUrl =
      this.config.get<string>('NEXT_PUBLIC_FRONTEND_URL') ??
      'http://localhost:3000';
    const url = await this.svc.createPortalSession(
      req.user.tenantId,
      returnBaseUrl,
    );
    return { url };
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
