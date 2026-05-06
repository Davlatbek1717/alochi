import {
  Controller,
  Post,
  Headers,
  Req,
  Logger,
  HttpCode,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import Stripe = require('stripe');
import { SubscriptionsService } from './subscriptions.service';

@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);
  private stripe: Stripe.Stripe;

  constructor(
    private readonly subs: SubscriptionsService,
    private readonly config: ConfigService,
  ) {
    this.stripe = new Stripe(this.config.get<string>('STRIPE_SECRET_KEY') ?? '', {
      apiVersion: '2026-04-22.dahlia',
    });
  }

  /**
   * POST /webhooks/stripe
   * Real HMAC verification via stripe.webhooks.constructEvent().
   * Requires raw body — express.raw() is registered in main.ts for this route.
   */
  @Post('stripe')
  @HttpCode(200)
  async stripeWebhook(
    @Headers('stripe-signature') sig: string,
    @Req() req: Request,
  ) {
    const webhookSecret = this.config.get<string>('STRIPE_WEBHOOK_SECRET');

    if (!webhookSecret) {
      this.logger.warn('STRIPE_WEBHOOK_SECRET not set');
      if (this.config.get('NODE_ENV') === 'production') {
        throw new BadRequestException('Webhook secret not configured');
      }
    }

    let event: any;
    try {
      event = this.stripe.webhooks.constructEvent(
        req.body as Buffer,
        sig,
        webhookSecret ?? '',
      );
    } catch (err) {
      this.logger.warn(`stripe.webhook.signature_invalid: ${(err as Error).message}`);
      throw new BadRequestException(
        `Webhook signature verification failed: ${(err as Error).message}`,
      );
    }

    this.logger.log(`stripe.webhook type=${event.type}`);

    try {
      await this.handleStripeEvent(event);
    } catch (err) {
      this.logger.error(
        `stripe.webhook.handler_error type=${event.type}: ${(err as Error).message}`,
      );
      // Return 200 to Stripe so it doesn't retry — log and investigate separately.
    }

    return { received: true };
  }

  private async handleStripeEvent(event: any) {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'invoice.payment_succeeded': {
        let sub: any;
        const obj = event.data.object as any;

        if ('subscription' in obj && typeof obj.subscription === 'string') {
          sub = await this.stripe.subscriptions.retrieve(obj.subscription);
        } else {
          sub = obj as any;
        }

        const tenantId = sub.metadata?.tenantId;
        if (!tenantId) {
          this.logger.warn('stripe.webhook: no tenantId in subscription metadata');
          return;
        }

        const priceKey = sub.items.data[0]?.price.lookup_key ?? 'starter';
        const periodEnd = new Date((sub.current_period_end ?? 0) * 1000);
        await this.subs.activate(tenantId, priceKey, 'stripe', periodEnd, sub.id);
        this.logger.log(`stripe.webhook: activated tenant=${tenantId} plan=${priceKey}`);
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as any;
        const tenantId = sub.metadata?.tenantId;
        if (!tenantId) return;

        const statusMap: Record<string, string> = {
          active: 'active',
          past_due: 'past_due',
          trialing: 'trialing',
          canceled: 'canceled',
          unpaid: 'past_due',
          incomplete: 'trialing',
          incomplete_expired: 'canceled',
          paused: 'past_due',
        };

        await this.subs.upsert(tenantId, {
          plan: sub.items.data[0]?.price.lookup_key ?? 'starter',
          status: statusMap[sub.status] ?? sub.status,
          gateway: 'stripe',
          gatewaySubscriptionId: sub.id,
          currentPeriodStart: new Date(sub.current_period_start * 1000),
          currentPeriodEnd: new Date(sub.current_period_end * 1000),
        });
        break;
      }

      case 'invoice.payment_failed': {
        const inv = event.data.object as any;
        const subId = inv.subscription;
        if (!subId || typeof subId !== 'string') return;

        const sub = await this.stripe.subscriptions.retrieve(subId);
        const tenantId = sub.metadata?.tenantId;
        if (!tenantId) return;

        await this.subs.markPastDue(tenantId);
        this.logger.log(`stripe.webhook: past_due tenant=${tenantId}`);
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as any;
        const tenantId = sub.metadata?.tenantId;
        if (!tenantId) return;

        await this.subs.cancel(tenantId, true);
        this.logger.log(`stripe.webhook: canceled tenant=${tenantId}`);
        break;
      }

      default:
        this.logger.debug(`stripe.webhook: unhandled event type=${event.type}`);
    }
  }

  // Payme integration deferred — merchant account not yet configured (Phase 7c).
  @Post('payme')
  @HttpCode(200)
  async paymeWebhook() {
    return { result: null, error: { code: -32300, message: 'Not available yet' } };
  }

  // Click integration deferred — merchant account not yet configured (Phase 7c).
  @Post('click')
  @HttpCode(200)
  async clickWebhook() {
    return { error: -9000, error_note: 'Not available yet' };
  }
}
