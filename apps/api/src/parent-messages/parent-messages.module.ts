import { Module } from '@nestjs/common';
import { ParentMessagesService } from './parent-messages.service';
import { ParentMessagesController } from './parent-messages.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ParentMessagesController],
  providers: [ParentMessagesService],
  exports: [ParentMessagesService],
})
export class ParentMessagesModule {}
