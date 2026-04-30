import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Put,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { NotificationTemplatesService } from './notification-templates.service';

@ApiTags('notification-templates')
@ApiBearerAuth()
@Controller('notification-templates')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('superadmin')
export class NotificationTemplatesController {
  constructor(private templates: NotificationTemplatesService) {}

  @Get()
  list(@Request() req: any) {
    return this.templates.listForTenant(req.user.tenantId);
  }

  @Put(':key')
  update(
    @Param('key') key: string,
    @Body() body: { body: string },
    @Request() req: any,
  ) {
    return this.templates.upsert(req.user.tenantId, key, body.body);
  }

  @Delete(':key')
  async reset(@Param('key') key: string, @Request() req: any) {
    await this.templates.resetToDefault(req.user.tenantId, key);
    return { reset: true };
  }
}
