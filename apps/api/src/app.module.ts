import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-yet';
import { APP_INTERCEPTOR, APP_FILTER, APP_GUARD } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { LoggerModule } from 'nestjs-pino';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { loggerConfig } from './common/logger.config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { TenantsModule } from './tenants/tenants.module';
import { BranchesModule } from './branches/branches.module';
import { UsersModule } from './users/users.module';
import { LessonsModule } from './lessons/lessons.module';
import { ProgressModule } from './lesson-progress/progress.module';
import { StudentConfigModule } from './student-lesson-config/config.module';
import { PaymentsModule } from './payments/payments.module';
import { WarningsModule } from './warnings/warnings.module';
import { CronModule } from './cron/cron.module';
import { DelegationsModule } from './delegations/delegations.module';
import { TelegramModule } from './telegram/telegram.module';
import { AiModule } from './ai/ai.module';
import { FaceModule } from './face/face.module';
import { GamificationModule } from './gamification/gamification.module';
import { SocialModule } from './social/social.module';
import { StudentStatusModule } from './student-status/status.module';
import { KpiModule } from './kpi/kpi.module';
import { AttendanceModule } from './attendance/attendance.module';
import { HealthModule } from './health/health.module';
import { TasksModule } from './tasks/tasks.module';
import { NotificationsModule } from './notifications/notifications.module';
import { NotificationTemplatesModule } from './notification-templates/notification-templates.module';
import { TournamentsModule } from './tournaments/tournaments.module';
import { ExamsModule } from './exams/exams.module';
import { ContentQualityModule } from './content-quality/content-quality.module';
import { ClickHouseModule } from './clickhouse/clickhouse.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { CultureLessonsModule } from './culture-lessons/culture-lessons.module';
import { LetterCollectionModule } from './letter-collection/letter-collection.module';
import { StaffGuidesModule } from './staff-guides/staff-guides.module';
import { PromotionReportModule } from './promotion-report/promotion-report.module';
import { ManagerSessionsModule } from './manager-sessions/manager-sessions.module';
import { ManagerRewardsModule } from './manager-rewards/manager-rewards.module';
import { TechIssuesModule } from './tech-issues/tech-issues.module';
import { ExamQueueModule } from './exams/exam-queue.module';
import { MarketingModule } from './marketing/marketing.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { SystemAuditModule } from './system-audit/system-audit.module';
import { I18nModule } from './i18n/i18n.module';
import { VideoCheckinModule } from './video-checkin/video-checkin.module';
import { StudyTimeModule } from './study-time/study-time.module';
import { GroupsModule } from './groups/groups.module';
import { DevicesModule } from './devices/devices.module';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { DelegationContextInterceptor } from './common/interceptors/delegation-context.interceptor';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Redis caching — in-memory fallback when REDIS_URL not set (dev/CI).
    CacheModule.registerAsync({
      isGlobal: true,
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => {
        const redisUrl = config.get<string>('REDIS_URL');
        if (!redisUrl) {
          // No Redis configured — use the built-in in-memory store.
          return { ttl: 30_000 };
        }
        const store = await redisStore({ url: redisUrl, ttl: 30_000 });
        return { store };
      },
    }),
    // Global rate limiting. Default: 200 req/min and 10 req/sec per client.
    // Critical endpoints (login, refresh, study-time/ping) override these
    // with @Throttle() decorators on their handlers.
    // Storage: in-memory (single node). When scaling to multiple instances,
    // replace with ThrottlerStorageRedisService (nestjs-throttler-storage-redis).
    ThrottlerModule.forRoot([
      { name: 'short',  ttl: 1_000,   limit: 10 },   // 10 req/sec
      { name: 'medium', ttl: 60_000,  limit: 200 },  // 200 req/min
    ]),
    LoggerModule.forRoot(loggerConfig),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    TenantsModule,
    BranchesModule,
    UsersModule,
    LessonsModule,
    ProgressModule,
    StudentConfigModule,
    PaymentsModule,
    WarningsModule,
    CronModule,
    DelegationsModule,
    TelegramModule,
    AiModule,
    FaceModule,
    GamificationModule,
    SocialModule,
    StudentStatusModule,
    KpiModule,
    AttendanceModule,
    HealthModule,
    TasksModule,
    NotificationsModule,
    NotificationTemplatesModule,
    TournamentsModule,
    ExamsModule,
    ContentQualityModule,
    ClickHouseModule,
    AnalyticsModule,
    CultureLessonsModule,
    LetterCollectionModule,
    StaffGuidesModule,
    PromotionReportModule,
    ManagerSessionsModule,
    ManagerRewardsModule,
    TechIssuesModule,
    ExamQueueModule,
    MarketingModule,
    SubscriptionsModule,
    SystemAuditModule,
    I18nModule,
    VideoCheckinModule,
    StudyTimeModule,
    GroupsModule,
    DevicesModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
    { provide: APP_INTERCEPTOR, useClass: DelegationContextInterceptor },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
