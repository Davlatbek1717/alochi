import { Module } from '@nestjs/common';
import { LessonsService } from './lessons.service';
import { LessonsController } from './lessons.controller';
import { ComponentsService } from './components.service';

@Module({
  providers: [LessonsService, ComponentsService],
  controllers: [LessonsController],
  exports: [LessonsService, ComponentsService],
})
export class LessonsModule {}
