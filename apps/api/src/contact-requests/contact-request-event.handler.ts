import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ContactRequest, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { TelegramService } from '../telegram/telegram.service';

/**
 * Fans `contact_request.created` events out to all active superadmins:
 *   - in-app notification (always)
 *   - Telegram via `contact_request.new` template (if linked)
 */
@Injectable()
export class ContactRequestEventHandler {
  private readonly logger = new Logger(ContactRequestEventHandler.name);

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private telegram: TelegramService,
  ) {}

  @OnEvent('contact_request.created')
  async onCreated(req: ContactRequest) {
    try {
      const superadmins = await this.prisma.user.findMany({
        where: { role: UserRole.superadmin, status: 'active' },
        select: { id: true, telegramId: true, tenantId: true },
      });
      if (superadmins.length === 0) {
        this.logger.warn(
          'contact_request.created: hech qanday superadmin topilmadi',
        );
        return;
      }

      const previewMessage = req.message ? req.message.slice(0, 100) : '';
      const title = `Yangi demo so'rov: ${req.centerName}`;
      const body = `${req.contactName} (${req.phone})${previewMessage ? ` — ${previewMessage}` : ''}`;

      await Promise.all(
        superadmins.map(async (sa) => {
          try {
            await this.notifications.send(
              sa.id,
              'contact_request',
              title,
              body,
              { contactRequestId: req.id },
            );
          } catch (err) {
            this.logger.error(
              `contact_request in-app send failed for ${sa.id}: ${err}`,
            );
          }

          if (sa.telegramId) {
            try {
              await this.telegram.sendTemplate(
                sa.telegramId,
                'contact_request.new',
                {
                  centerName: req.centerName,
                  contactName: req.contactName,
                  phone: req.phone,
                  size: req.centerSize ?? '—',
                  message: req.message?.slice(0, 200) ?? '—',
                },
                sa.tenantId,
              );
            } catch (err) {
              this.logger.warn(
                `contact_request telegram send failed for ${sa.id}: ${err}`,
              );
            }
          }
        }),
      );
    } catch (err) {
      this.logger.error(`contact_request.created handler error: ${err}`);
    }
  }
}
