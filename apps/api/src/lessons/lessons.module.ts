import { Module } from '@nestjs/common';
import { LessonsService } from './lessons.service';
import { LessonsController } from './lessons.controller';
import { ComponentsService } from './components.service';
import { LessonComponentsController } from './lesson-components.controller';
import { LessonComponentsService } from './lesson-components.service';

@Module({
  providers: [LessonsService, ComponentsService, LessonComponentsService],
  controllers: [LessonsController, LessonComponentsController],
  exports: [LessonsService, ComponentsService, LessonComponentsService],
})
export class LessonsModule {}
