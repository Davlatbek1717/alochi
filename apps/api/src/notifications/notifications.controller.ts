import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Patch,
  Param,
  Post,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramService } from '../telegram/telegram.service';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

interface SendTelegramDto {
  studentId: string;
  message: string;
}

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(
    private notifications: NotificationsService,
    private prisma: PrismaService,
    private telegram: TelegramService,
  ) {}

  @Get('my')
  getMy(@Request() req: any) {
    return this.notifications.getMyNotifications(req.user.userId);
  }

  @Get('my/unread-count')
  getUnreadCount(@Request() req: any) {
    return this.notifications.getUnreadCount(req.user.userId);
  }

  @Patch(':id/read')
  markRead(@Param('id') id: string, @Request() req: any) {
    return this.notifications.markRead(id, req.user.userId);
  }

  @Patch('read-all')
  markAllRead(@Request() req: any) {
    return this.notifications.markAllRead(req.user.userId);
  }

  /**
   * Send an ad-hoc Telegram message from staff to a student's parent.
   * Used by the mentor student-detail page ("Ota-onaga xabar yuborish").
   * Returns 400 PARENT_TELEGRAM_NOT_LINKED when the parent has not yet
   * linked their Telegram via the bot.
   */
  @Post('telegram')
  @UseGuards(RolesGuard)
  @Roles(UserRole.mentor, UserRole.manager, UserRole.filadmin)
  async sendTelegram(@Body() dto: SendTelegramDto, @Request() req: any) {
    if (!dto?.studentId || !dto?.message?.trim()) {
      throw new BadRequestException({
        code: 'INVALID_PAYLOAD',
        message: 'studentId va message majburiy',
      });
    }

    const student = await this.prisma.user.findFirst({
      where: { id: dto.studentId, tenantId: req.user.tenantId },
      select: { id: true, parentTelegramId: true },
    });
    if (!student) {
      throw new BadRequestException({
        code: 'STUDENT_NOT_FOUND',
        message: "O'quvchi topilmadi",
      });
    }
    if (!student.parentTelegramId) {
      throw new BadRequestException({
        code: 'PARENT_TELEGRAM_NOT_LINKED',
        message: 'Ota-ona Telegram hisobi ulanmagan',
      });
    }

    await this.telegram.sendMessage(student.parentTelegramId, dto.message);
    return { sent: true };
  }
}
