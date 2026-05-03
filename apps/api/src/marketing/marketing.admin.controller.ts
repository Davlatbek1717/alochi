import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { MarketingService } from './marketing.service';

/**
 * Superadmin-only CMS for the landing page. Lives under
 * /marketing/admin so it sits beside the public read endpoints
 * without colliding with any of them.
 */
@ApiTags('marketing-admin')
@ApiBearerAuth()
@Controller('marketing/admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.superadmin)
export class MarketingAdminController {
  constructor(private marketing: MarketingService) {}

  // ─── Singleton settings ──────────────────────────────────────────────────
  @Get('settings')
  listSettings() {
    return this.marketing.listSettings();
  }

  /**
   * Bulk-edit the singleton key/value pairs. The admin form sends
   * the full edited map back; empty values are deleted so the
   * default fallback takes over.
   */
  @Put('settings')
  upsertSettings(@Body() body: Record<string, string>) {
    return this.marketing.upsertSettings(body ?? {});
  }

  // ─── List items (prizes + sponsors) ─────────────────────────────────────
  @Get('items')
  listItems(@Query('kind') kind: 'prize' | 'sponsor') {
    return this.marketing.listItems(kind);
  }

  @Post('items')
  createItem(
    @Body()
    body: {
      kind: 'prize' | 'sponsor';
      title: string;
      description?: string;
      meta?: Record<string, unknown>;
      orderIndex?: number;
      isVisible?: boolean;
    },
  ) {
    return this.marketing.createItem(body);
  }

  @Patch('items/:id')
  updateItem(
    @Param('id') id: string,
    @Body()
    body: {
      title?: string;
      description?: string;
      meta?: Record<string, unknown>;
      orderIndex?: number;
      isVisible?: boolean;
    },
  ) {
    return this.marketing.updateItem(id, body);
  }

  @Delete('items/:id')
  deleteItem(@Param('id') id: string) {
    return this.marketing.deleteItem(id);
  }
}
