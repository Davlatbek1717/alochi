import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AnalyticsEvent } from '@prisma/client';
import { AppModule } from '../../app.module';
import { PrismaService } from '../../prisma/prisma.service';
import { ClickHouseService } from '../../clickhouse/clickhouse.service';

async function main() {
  const logger = new Logger('Backfill');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'error', 'warn'],
  });
  const prisma = app.get(PrismaService);
  const clickhouse = app.get(ClickHouseService);

  if (!clickhouse.isReady()) {
    logger.error('ClickHouse not ready — abort');
    await app.close();
    process.exit(1);
  }

  const BATCH = 1000;
  let cursor: Date | null = null;
  let total = 0;

  while (true) {
    const events: AnalyticsEvent[] = await prisma.analyticsEvent.findMany({
      where: cursor
        ? { createdAt: { gt: cursor }, syncedAt: null }
        : { syncedAt: null },
      orderBy: { createdAt: 'asc' },
      take: BATCH,
    });
    if (events.length === 0) break;

    for (const event of events) {
      const data = (event.data ?? {}) as Record<string, unknown>;
      const lessonId = (data as { lessonId?: string }).lessonId ?? null;
      const sessionCount =
        (data as { sessionCount?: number }).sessionCount ?? 0;
      const isPresent = (data as { isPresent?: boolean }).isPresent;
      const isLate = (data as { isLate?: boolean }).isLate;
      const newStreak = (data as { newStreak?: number }).newStreak;

      try {
        await clickhouse.insertEvent({
          event_id: event.id,
          tenant_id: event.tenantId,
          event_type: event.eventType,
          student_id: event.studentId,
          branch_id: event.branchId,
          lesson_id: lessonId,
          session_count: sessionCount,
          is_present: isPresent === undefined ? null : isPresent ? 1 : 0,
          is_late: isLate === undefined ? null : isLate ? 1 : 0,
          new_streak: newStreak ?? null,
          data: JSON.stringify(data),
          created_at: event.createdAt.toISOString(),
        });
        await prisma.analyticsEvent.update({
          where: { id: event.id },
          data: { syncedAt: new Date() },
        });
        total++;
      } catch (e) {
        logger.warn(
          `Failed to backfill event ${event.id}: ${(e as Error).message}`,
        );
      }
    }
    cursor = events[events.length - 1].createdAt;
    logger.log(`Processed ${total} events (cursor: ${cursor!.toISOString()})`);
  }

  logger.log(`Backfill complete. Total events synced: ${total}`);
  await app.close();
  process.exit(0);
}

main().catch((e) => {
  console.error('Backfill error:', e);
  process.exit(1);
});
