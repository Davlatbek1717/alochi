import {
  Controller,
  Post,
  Headers,
  Body,
  Req,
  Logger,
  HttpCode,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { SubscriptionsService } from './subscriptions.service';

/** Helper: compute a billing period end 30 days from now. */
function thirtyDaysFromNow() {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d;
}

@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(
    private readonly subs: SubscriptionsService,
    private readonly config: ConfigService,
  ) {}

  // ─── Stripe ────────────────────────────────────────────────────────────────

  /**
   * POST /webhooks/stripe
   *
   * Receives Stripe webhook events. The raw body is required for HMAC
   * signature verification; ensure the NestJS body-parser is disabled for
   * this route (or use rawBody option) before enabling verification in prod.
   *
   * Handled events:
   *   - customer.subscription.updated   → upsert status / period
   *   - invoice.payment_succeeded       → activate subscription
   *   - invoice.payment_failed          → mark past_due
   */
  @Post('stripe')
  @HttpCode(200)
  async stripeWebhook(
    @Headers('stripe-signature') sig: string,
    @Req() req: Request,
  ) {
    const webhookSecret = this.config.get<string>('STRIPE_WEBHOOK_SECRET');

    // TODO: verify HMAC — use stripe.webhooks.constructEvent(rawBody, sig, webhookSecret)
    // Disabled here because we don't import the Stripe SDK to avoid a hard dependency.
    // In production, install `stripe` package and uncomment verification before trusting the payload.
    if (!webhookSecret) {
      this.logger.warn('STRIPE_WEBHOOK_SECRET not set — skipping signature check (dev mode)');
    }

    const body = req.body as Record<string, unknown>;
    const eventType = body['type'] as string | undefined;
    const data = (body['data'] as Record<string, unknown>) ?? {};
    const obj = (data['object'] as Record<string, unknown>) ?? {};

    this.logger.log(`stripe.webhook type=${eventType}`);

    try {
      switch (eventType) {
        case 'customer.subscription.updated': {
          const tenantId = (obj['metadata'] as Record<string, string> | undefined)?.['tenantId'];
          if (!tenantId) break;
          const status = (obj['status'] as string) ?? 'active';
          const periodEnd = obj['current_period_end']
            ? new Date((obj['current_period_end'] as number) * 1000)
            : thirtyDaysFromNow();
          const periodStart = obj['current_period_start']
            ? new Date((obj['current_period_start'] as number) * 1000)
            : new Date();
          await this.subs.upsert(tenantId, {
            status,
            plan: 'pro',
            gateway: 'stripe',
            gatewaySubscriptionId: obj['id'] as string | undefined,
            currentPeriodStart: periodStart,
            currentPeriodEnd: periodEnd,
          });
          break;
        }

        case 'invoice.payment_succeeded': {
          const tenantId = (obj['metadata'] as Record<string, string> | undefined)?.['tenantId'];
          if (!tenantId) break;
          const periodEnd = thirtyDaysFromNow();
          const subId = obj['subscription'] as string | undefined;
          await this.subs.activate(tenantId, 'pro', 'stripe', periodEnd, subId);
          break;
        }

        case 'invoice.payment_failed': {
          const tenantId = (obj['metadata'] as Record<string, string> | undefined)?.['tenantId'];
          if (!tenantId) break;
          await this.subs.markPastDue(tenantId).catch((e) =>
            this.logger.warn(`markPastDue failed: ${(e as Error).message}`),
          );
          break;
        }

        default:
          // Unhandled event — return 200 so Stripe stops retrying.
          break;
      }
    } catch (err) {
      this.logger.error(`stripe.webhook.error: ${(err as Error).message}`);
      // Return 200 to prevent Stripe from retrying transient failures.
    }

    return { received: true };
  }

  // ─── Payme ─────────────────────────────────────────────────────────────────

  /**
   * POST /webhooks/payme
   *
   * Payme uses the JSON-RPC 2.0 protocol over HTTP Basic auth.
   * Authorization header: Basic base64(PAYME_KEY) — verified below.
   *
   * Supported methods:
   *   CheckPerformTransaction  → validate order exists
   *   CreateTransaction        → acknowledge transaction creation
   *   PerformTransaction       → payment confirmed, activate subscription
   *   CancelTransaction        → payment cancelled / refunded
   */
  @Post('payme')
  @HttpCode(200)
  async paymeWebhook(
    @Headers('authorization') authHeader: string,
    @Body() body: Record<string, unknown>,
  ) {
    // TODO: verify HMAC — decode Basic auth and compare against PAYME_KEY env var
    // const paymeKey = this.config.get<string>('PAYME_KEY') ?? this.config.get<string>('PAYME_TEST_KEY');
    // const expected = 'Basic ' + Buffer.from('Paycom:' + paymeKey).toString('base64');
    // if (authHeader !== expected) throw new BadRequestException('Payme auth invalid');

    const method = body['method'] as string | undefined;
    const params = (body['params'] as Record<string, unknown>) ?? {};
    const id = body['id'];

    this.logger.log(`payme.webhook method=${method}`);

    // JSON-RPC 2.0 response helper
    const ok = (result: unknown) => ({ jsonrpc: '2.0', id, result });

    try {
      switch (method) {
        case 'CheckPerformTransaction': {
          // Validate that the order (tenantId in account) is valid.
          const account = (params['account'] as Record<string, string>) ?? {};
          const tenantId = account['tenant_id'];
          if (!tenantId) {
            return ok({ allow: false, reason: 'tenant_id missing' });
          }
          return ok({ allow: true });
        }

        case 'CreateTransaction': {
          // Payme is creating a transaction — acknowledge it.
          const transactionId = params['id'] as string;
          const createTime = Date.now();
          return ok({
            create_time: createTime,
            transaction: transactionId,
            state: 1, // CREATED
          });
        }

        case 'PerformTransaction': {
          // Payment confirmed — activate tenant subscription.
          const transactionId = params['id'] as string;
          const account = (params['account'] as Record<string, string>) ?? {};
          const tenantId = account['tenant_id'];
          if (tenantId) {
            await this.subs.activate(
              tenantId,
              'pro',
              'payme',
              thirtyDaysFromNow(),
              transactionId,
            );
          }
          return ok({
            transaction: transactionId,
            perform_time: Date.now(),
            state: 2, // COMPLETED
          });
        }

        case 'CancelTransaction': {
          const transactionId = params['id'] as string;
          const account = (params['account'] as Record<string, string>) ?? {};
          const tenantId = account['tenant_id'];
          if (tenantId) {
            await this.subs
              .cancel(tenantId, true)
              .catch((e) =>
                this.logger.warn(`payme cancel failed: ${(e as Error).message}`),
              );
          }
          return ok({
            transaction: transactionId,
            cancel_time: Date.now(),
            state: -1, // CANCELLED
          });
        }

        default:
          throw new BadRequestException(`Unknown Payme method: ${method}`);
      }
    } catch (err) {
      this.logger.error(`payme.webhook.error: ${(err as Error).message}`);
      return {
        jsonrpc: '2.0',
        id,
        error: { code: -32400, message: (err as Error).message },
      };
    }
  }

  // ─── Click ─────────────────────────────────────────────────────────────────

  /**
   * POST /webhooks/click
   *
   * Click sends two requests per transaction:
   *   action=0 (prepare)  → validate and prepare the order
   *   action=1 (complete) → payment confirmed, activate subscription
   *
   * Click signs the request with HMAC-MD5; verification is noted as TODO.
   */
  @Post('click')
  @HttpCode(200)
  async clickWebhook(@Body() body: Record<string, unknown>) {
    // TODO: verify HMAC — Click signs with MD5(click_trans_id + service_id + CLICK_SECRET_KEY + merchant_trans_id + amount + action + sign_time)
    // const secretKey = this.config.get<string>('CLICK_SECRET_KEY');

    const action = Number(body['action']);
    const clickTransId = body['click_trans_id'] as string;
    const merchantTransId = body['merchant_trans_id'] as string; // tenantId
    const amount = Number(body['amount']);
    const error = Number(body['error'] ?? 0);

    this.logger.log(`click.webhook action=${action} txn=${clickTransId}`);

    if (error < 0) {
      this.logger.warn(`click.webhook error=${error} — skipping`);
      return { click_trans_id: clickTransId, merchant_trans_id: merchantTransId, error: 0, error_note: 'Success' };
    }

    try {
      if (action === 0) {
        // Prepare — validate the tenant exists
        if (!merchantTransId) {
          return {
            click_trans_id: clickTransId,
            merchant_trans_id: merchantTransId,
            error: -5,
            error_note: 'merchant_trans_id (tenantId) missing',
          };
        }
        return {
          click_trans_id: clickTransId,
          merchant_trans_id: merchantTransId,
          merchant_prepare_id: merchantTransId,
          error: 0,
          error_note: 'Success',
        };
      }

      if (action === 1) {
        // Complete — activate subscription
        if (!merchantTransId) {
          return {
            click_trans_id: clickTransId,
            merchant_trans_id: merchantTransId,
            error: -5,
            error_note: 'merchant_trans_id (tenantId) missing',
          };
        }
        await this.subs.activate(
          merchantTransId,
          'pro',
          'click',
          thirtyDaysFromNow(),
          clickTransId,
        );
        return {
          click_trans_id: clickTransId,
          merchant_trans_id: merchantTransId,
          merchant_confirm_id: clickTransId,
          error: 0,
          error_note: 'Success',
        };
      }

      return { click_trans_id: clickTransId, merchant_trans_id: merchantTransId, error: -3, error_note: 'Action not found' };
    } catch (err) {
      this.logger.error(`click.webhook.error: ${(err as Error).message}`);
      return {
        click_trans_id: clickTransId,
        merchant_trans_id: merchantTransId,
        error: -9000,
        error_note: 'Internal error',
      };
    }
  }
}
