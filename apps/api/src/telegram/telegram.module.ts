import { Module } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { ConfigModule } from '@nestjs/config';
import { ParentHandler } from './handlers/parent.handler';
import { StudentHandler } from './handlers/student.handler';
import { StaffHandler } from './handlers/staff.handler';
import { NotificationHandler } from './handlers/notification.handler';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [ConfigModule, PrismaModule],
  providers: [TelegramService, ParentHandler, StudentHandler, StaffHandler, NotificationHandler],
  exports: [TelegramService, ParentHandler, StudentHandler, StaffHandler, NotificationHandler],
})
export class TelegramModule {}
