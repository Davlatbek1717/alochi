import { Module } from '@nestjs/common';
import { ManagerSessionsService } from './manager-sessions.service';
import { ManagerSessionsController } from './manager-sessions.controller';

@Module({
  providers: [ManagerSessionsService],
  controllers: [ManagerSessionsController],
  exports: [ManagerSessionsService],
})
export class ManagerSessionsModule {}
