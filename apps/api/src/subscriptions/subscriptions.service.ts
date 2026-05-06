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

  async getForTenant(tenantId: string) {
    return this.prisma.tenantSubscription.findUnique({ where: { tenantId } });
  }

  async upsert(tenantId: string, data: UpsertSubscriptionDto) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true },
    });
    if (!tenant) throw new NotFoundException(`Tenant not found: ${tenantId}`);

    return this.prisma.tenantSubscription.upsert({
      where: { tenantId },
      update: { ...data, updatedAt: new Date() },
      create: { tenantId, ...data },
    });
  }

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

  async markPastDue(tenantId: string) {
    return this.prisma.tenantSubscription.update({
      where: { tenantId },
      data: { status: 'past_due', updatedAt: new Date() },
    });
  }

  async cancel(tenantId: string, immediate = false) {
    if (immediate) {
      return this.prisma.tenantSubscription.update({
        where: { tenantId },
        data: {
          status: 'canceled',
          cancelAtPeriodEnd: false,
          updatedAt: new Date(),
        },
      });
    }
    return this.prisma.tenantSubscription.update({
      where: { tenantId },
      data: { cancelAtPeriodEnd: true, updatedAt: new Date() },
    });
  }
}
