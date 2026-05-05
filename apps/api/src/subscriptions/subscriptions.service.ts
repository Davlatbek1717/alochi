import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface UpsertSubscriptionDto {
  plan: string;
  status: string;
  gateway?: string;
  gatewaySubscriptionId?: string;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
}

@Injectable()
export class SubscriptionsService {
  constructor(private prisma: PrismaService) {}

  /** Return the subscription record for a tenant, or null if not yet created. */
  async getForTenant(tenantId: string) {
    const sub = await this.prisma.tenantSubscription.findUnique({
      where: { tenantId },
    });
    return sub;
  }

  /** Create-or-update a tenant subscription row. */
  async upsert(tenantId: string, data: UpsertSubscriptionDto) {
    // Verify tenant exists before upserting
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true },
    });
    if (!tenant) {
      throw new NotFoundException(`Tenant not found: ${tenantId}`);
    }

    return this.prisma.tenantSubscription.upsert({
      where: { tenantId },
      update: {
        ...data,
        updatedAt: new Date(),
      },
      create: {
        tenantId,
        ...data,
      },
    });
  }

  /**
   * Mark a subscription as active after successful payment.
   * Called by webhook handlers on Stripe invoice.payment_succeeded,
   * Payme PerformTransaction, or Click action=1.
   */
  async activate(
    tenantId: string,
    plan: string,
    gateway: string,
    periodEnd: Date,
    gatewaySubscriptionId?: string,
  ) {
    return this.upsert(tenantId, {
      plan,
      status: 'active',
      gateway,
      gatewaySubscriptionId,
      currentPeriodStart: new Date(),
      currentPeriodEnd: periodEnd,
    });
  }

  /** Mark subscription as past_due (failed payment). */
  async markPastDue(tenantId: string) {
    return this.prisma.tenantSubscription.update({
      where: { tenantId },
      data: { status: 'past_due', updatedAt: new Date() },
    });
  }

  /** Cancel subscription at period end (or immediately if immediate=true). */
  async cancel(tenantId: string, immediate = false) {
    if (immediate) {
      return this.prisma.tenantSubscription.update({
        where: { tenantId },
        data: { status: 'canceled', cancelAtPeriodEnd: false, updatedAt: new Date() },
      });
    }
    return this.prisma.tenantSubscription.update({
      where: { tenantId },
      data: { cancelAtPeriodEnd: true, updatedAt: new Date() },
    });
  }
}
