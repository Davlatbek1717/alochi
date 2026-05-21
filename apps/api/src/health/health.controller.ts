import { Controller, Get, Inject, Injectable } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  HealthIndicator,
  HealthIndicatorResult,
} from '@nestjs/terminus';
import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';
import { PrismaService } from '../prisma/prisma.service';

const APP_VERSION = process.env.APP_VERSION ?? 'dev';
const startTime = Date.now();

@Injectable()
export class DbHealthIndicator extends HealthIndicator {
  constructor(private prisma: PrismaService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const t0 = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return this.getStatus(key, true, { latencyMs: Date.now() - t0 });
    } catch (err: any) {
      return this.getStatus(key, false, { error: err?.message });
    }
  }
}

@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  constructor(@Inject(CACHE_MANAGER) private cache: Cache) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const t0 = Date.now();
    try {
      const probe = `health:probe:${Date.now()}`;
      await this.cache.set(probe, '1', 5000);
      await this.cache.del(probe);
      return this.getStatus(key, true, { latencyMs: Date.now() - t0 });
    } catch (err: any) {
      return this.getStatus(key, false, { error: err?.message });
    }
  }
}

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: DbHealthIndicator,
    private redis: RedisHealthIndicator,
  ) {}

  /** Liveness — is the process alive? (no dependencies) */
  @Get('liveness')
  liveness() {
    return {
      status: 'ok',
      version: APP_VERSION,
      uptime: Math.floor((Date.now() - startTime) / 1000),
    };
  }

  /** Readiness — is the app ready to serve traffic? (DB + Redis) */
  @Get('readiness')
  @HealthCheck()
  async readiness() {
    return this.health.check([
      () => this.db.isHealthy('database'),
      () => this.redis.isHealthy('redis'),
    ]);
  }

  /** Deep — all dependencies + metadata (internal monitoring) */
  @Get('deep')
  @HealthCheck()
  async deep() {
    const result = await this.health.check([
      () => this.db.isHealthy('database'),
      () => this.redis.isHealthy('redis'),
    ]);

    return {
      ...result,
      version: APP_VERSION,
      uptime: Math.floor((Date.now() - startTime) / 1000),
      timestamp: new Date().toISOString(),
    };
  }

  /** Legacy — kept for backwards compatibility */
  @Get()
  @HealthCheck()
  check() {
    return this.health.check([() => this.db.isHealthy('database')]);
  }
}
