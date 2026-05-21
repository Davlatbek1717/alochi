import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Validates the X-Telegram-Bot-Api-Secret-Token header on every incoming
 * webhook POST. Without this, anyone who knows the webhook URL can inject
 * arbitrary fake Telegram updates (fake check-ins, fake commands, etc).
 *
 * The secret is set when calling bot.api.setWebhook(url, { secret_token })
 * and must match TELEGRAM_WEBHOOK_SECRET in the env.
 *
 * If TELEGRAM_WEBHOOK_SECRET is not configured (e.g. dev), guard passes
 * in non-production environments so long-polling dev mode still works.
 */
@Injectable()
export class TelegramWebhookGuard implements CanActivate {
  private readonly logger = new Logger(TelegramWebhookGuard.name);
  private readonly secret: string | undefined;
  private readonly isProd: boolean;

  constructor(private readonly config: ConfigService) {
    this.secret = config.get<string>('TELEGRAM_WEBHOOK_SECRET');
    this.isProd = config.get<string>('NODE_ENV') === 'production';
  }

  canActivate(ctx: ExecutionContext): boolean {
    if (!this.isProd) {
      // In development the bot uses long-polling, so the webhook endpoint
      // is never called. Skip guard so health-check POSTs don't fail.
      return true;
    }

    if (!this.secret) {
      this.logger.warn(
        'TELEGRAM_WEBHOOK_SECRET not set — webhook endpoint is unprotected! ' +
          'Set it in .env and re-register the webhook with secret_token.',
      );
      return true;
    }

    const req = ctx.switchToHttp().getRequest<{ headers: Record<string, string> }>();
    const incoming = req.headers['x-telegram-bot-api-secret-token'];

    if (!incoming || incoming !== this.secret) {
      this.logger.warn('Telegram webhook: invalid or missing secret token');
      throw new ForbiddenException('Invalid webhook secret');
    }

    return true;
  }
}
