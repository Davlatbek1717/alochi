import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AttendanceStudentsService } from './attendance-students.service';
import { AttendanceStaffService } from './attendance-staff.service';
import { AttendanceController } from './attendance.controller';
import { AnalyticsModule } from '../analytics/analytics.module';

@Module({
  imports: [PrismaModule, AnalyticsModule],
  controllers: [AttendanceController],
  providers: [AttendanceStudentsService, AttendanceStaffService],
  exports: [AttendanceStudentsService, AttendanceStaffService],
})
export class AttendanceModule {}
