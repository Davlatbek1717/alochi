import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, ClickHouseClient } from '@clickhouse/client';

export interface ClickHouseEvent {
  event_id: string;
  tenant_id: string;
  event_type: string;
  student_id: string | null;
  branch_id: string | null;
  lesson_id: string | null;
  session_count: number;
  is_present: number | null;
  is_late: number | null;
  new_streak: number | null;
  data: string;
  created_at: string;
}

@Injectable()
export class ClickHouseService implements OnModuleInit, OnModuleDestroy {
  private client!: ClickHouseClient;
  private ready = false;
  private readonly logger = new Logger(ClickHouseService.name);

  constructor(private config: ConfigService) {}

  async onModuleInit() {
    const url = this.config.get<string>('CLICKHOUSE_URL');
    if (!url) {
      this.logger.warn('CLICKHOUSE_URL not set — ClickHouse client disabled');
      return;
    }
    this.client = createClient({
      url,
      username: this.config.get<string>('CLICKHOUSE_USER') ?? 'alochi',
      password: this.config.get<string>('CLICKHOUSE_PASSWORD') ?? '',
      database: this.config.get<string>('CLICKHOUSE_DB') ?? 'alochi_analytics',
    });

    try {
      await this.client.ping();
      this.ready = true;
      this.logger.log('ClickHouse connected');
    } catch (e) {
      this.logger.warn(`ClickHouse ping failed: ${(e as Error).message}`);
    }
  }

  async onModuleDestroy() {
    await this.client?.close();
  }

  isReady(): boolean {
    return this.ready;
  }

  async query<T>(sql: string, params?: Record<string, unknown>): Promise<T[]> {
    if (!this.client) throw new Error('ClickHouse client not initialized');
    const rs = await this.client.query({
      query: sql,
      query_params: params,
      format: 'JSONEachRow',
    });
    return rs.json<T>();
  }
}
