import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController, DbHealthIndicator, RedisHealthIndicator } from './health.controller';
import { MetricsSummaryController } from './metrics.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [TerminusModule, PrismaModule],
  controllers: [HealthController, MetricsSummaryController],
  providers: [DbHealthIndicator, RedisHealthIndicator],
})
export class HealthModule {}
