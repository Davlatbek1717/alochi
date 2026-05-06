import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe = require('stripe');
import { PrismaService } from '../prisma/prisma.service';

export interface UpsertSubscriptionDto {
  plan: string;
  status: string;
  gateway?: string;
  gatewaySubscriptionId?: string;
  stripeCustomerId?: string;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
}

@Injectable()
export class SubscriptionsService {
  private stripe: Stripe.Stripe;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    this.stripe = new Stripe(
      this.config.get<string>('STRIPE_SECRET_KEY') ?? '',
      {
        apiVersion: '2026-04-22.dahlia',
      },
    );
  }

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

  /** Ensure a Stripe Customer exists for the tenant and cache the ID. */
  async ensureStripeCustomer(tenantId: string): Promise<string> {
    const sub = await this.prisma.tenantSubscription.findUnique({
      where: { tenantId },
      select: { stripeCustomerId: true },
    });

    if (sub?.stripeCustomerId) return sub.stripeCustomerId;

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true },
    });

    const customer = await this.stripe.customers.create({
      name: tenant?.name ?? tenantId,
      metadata: { tenantId },
    });

    await this.prisma.tenantSubscription.upsert({
      where: { tenantId },
      create: {
        tenantId,
        stripeCustomerId: customer.id,
        status: 'trialing',
        plan: 'starter',
      },
      update: { stripeCustomerId: customer.id },
    });

    return customer.id;
  }

  /**
   * Create a Stripe Checkout Session.
   * Returns the hosted URL — caller should redirect window.location.href.
   */
  async createCheckoutSession(
    tenantId: string,
    plan: 'starter' | 'pro' | 'enterprise',
    returnBaseUrl: string,
  ): Promise<string> {
    const priceId = this.config.get<string>(
      `STRIPE_PRICE_ID_${plan.toUpperCase()}`,
    );
    if (!priceId) {
      throw new BadRequestException(
        `Stripe Price ID for plan "${plan}" is not configured.`,
      );
    }

    const customerId = await this.ensureStripeCustomer(tenantId);

    const session = await this.stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: { metadata: { tenantId } },
      success_url: `${returnBaseUrl}/filadmin/billing?checkout=success`,
      cancel_url: `${returnBaseUrl}/filadmin/billing?checkout=cancel`,
      allow_promotion_codes: true,
    });

    if (!session.url)
      throw new BadRequestException('Stripe did not return a checkout URL.');
    return session.url;
  }

  /**
   * Create a Stripe Billing Portal session for plan management.
   * Returns the portal URL — caller should redirect window.location.href.
   */
  async createPortalSession(
    tenantId: string,
    returnBaseUrl: string,
  ): Promise<string> {
    const sub = await this.prisma.tenantSubscription.findUnique({
      where: { tenantId },
      select: { stripeCustomerId: true },
    });

    if (!sub?.stripeCustomerId) {
      throw new BadRequestException(
        'No Stripe customer found for this tenant. Subscribe first.',
      );
    }

    const session = await this.stripe.billingPortal.sessions.create({
      customer: sub.stripeCustomerId,
      return_url: `${returnBaseUrl}/filadmin/billing`,
    });

    return session.url;
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
