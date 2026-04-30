import { Module } from '@nestjs/common';
import { StatusService } from './status.service';
import { StatusController } from './status.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { KpiModule } from '../kpi/kpi.module';

@Module({
  imports: [PrismaModule, KpiModule],
  controllers: [StatusController],
  providers: [StatusService],
  exports: [StatusService],
})
export class StudentStatusModule {}
