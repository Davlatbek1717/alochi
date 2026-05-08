import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { TelegramService } from './telegram.service';

/**
 * Receives Telegram Bot API webhook updates in production.
 *
 * In development the bot uses long-polling (bot.start()). In production
 * (NODE_ENV=production) the bot registers a webhook via setWebhook() in
 * onModuleInit and this controller receives the incoming updates.
 *
 * grammy's bot.handleUpdate() processes the update and dispatches it to
 * all registered handlers (commands, message handlers, callback queries).
 *
 * We ALWAYS return 200 — Telegram retries non-2xx responses with
 * exponential backoff, which would cause a transient handler error to
 * snowball into hours of duplicate deliveries. Errors are logged.
 */
@Controller('telegram')
export class TelegramController {
  private readonly logger = new Logger(TelegramController.name);

  constructor(private telegram: TelegramService) {}

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(@Body() body: unknown): Promise<void> {
    const bot = this.telegram.getBot();
    if (!bot) return;
    try {
      await bot.handleUpdate(body as Parameters<typeof bot.handleUpdate>[0]);
    } catch (err) {
      this.logger.error(
        `webhook handler error: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
