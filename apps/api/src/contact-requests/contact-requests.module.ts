import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { TelegramModule } from '../telegram/telegram.module';
import { ContactRequestsController } from './contact-requests.controller';
import { ContactRequestsService } from './contact-requests.service';
import { ContactRequestEventHandler } from './contact-request-event.handler';

@Module({
  imports: [PrismaModule, NotificationsModule, TelegramModule],
  controllers: [ContactRequestsController],
  providers: [ContactRequestsService, ContactRequestEventHandler],
  exports: [ContactRequestsService],
})
export class ContactRequestsModule {}
