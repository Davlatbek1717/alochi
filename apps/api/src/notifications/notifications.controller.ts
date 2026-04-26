import { Controller, Get, Patch, Param, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/auth.guard';
import { NotificationsService } from './notifications.service';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private notifications: NotificationsService) {}

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
}
