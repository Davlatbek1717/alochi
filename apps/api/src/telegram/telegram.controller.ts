import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
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
 */
@Controller('telegram')
export class TelegramController {
  constructor(private telegram: TelegramService) {}

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(@Body() body: unknown): Promise<void> {
    const bot = this.telegram.getBot();
    if (!bot) return;
    // grammy accepts a plain object for handleUpdate
    await bot.handleUpdate(body as Parameters<typeof bot.handleUpdate>[0]);
  }
}
