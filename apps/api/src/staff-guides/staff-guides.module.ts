import { Module } from '@nestjs/common';
import { StaffGuidesService } from './staff-guides.service';
import { StaffGuidesController } from './staff-guides.controller';

@Module({
  providers: [StaffGuidesService],
  controllers: [StaffGuidesController],
  exports: [StaffGuidesService],
})
export class StaffGuidesModule {}
