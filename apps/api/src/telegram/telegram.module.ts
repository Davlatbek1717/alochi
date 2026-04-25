import { Module } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { ConfigModule } from '@nestjs/config';
import { ParentHandler } from './handlers/parent.handler';
import { StudentHandler } from './handlers/student.handler';
import { StaffHandler } from './handlers/staff.handler';

@Module({
  imports: [ConfigModule],
  providers: [TelegramService, ParentHandler, StudentHandler, StaffHandler],
  exports: [TelegramService, ParentHandler, StudentHandler, StaffHandler],
})
export class TelegramModule {}
