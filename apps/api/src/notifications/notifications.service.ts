import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    private events: EventEmitter2,
  ) {}

  async send(
    userId: string,
    type: string,
    title: string,
    body: string,
    meta?: object,
  ) {
    const created = await this.prisma.notification.create({
      data: { userId, type, title, body, meta },
    });
    this.events.emit('notification.new', {
      userId,
      type,
      title,
      body,
      createdAt:
        (created.createdAt as Date | undefined)?.toISOString?.() ??
        new Date().toISOString(),
    });
    return created;
  }

  async getMyNotifications(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }

  async markRead(id: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: { id, userId },
      data: { isRead: true },
    });
  }

  async markAllRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: { userId, isRead: false },
    });
  }
}
