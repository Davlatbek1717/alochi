import { Module } from '@nestjs/common';
import { KpiService } from './kpi.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [KpiService],
  exports: [KpiService],
})
export class KpiModule {}
