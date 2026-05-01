import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_INTERCEPTOR, APP_FILTER, APP_GUARD } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
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
import { ChurnModule } from './churn/churn.module';
import { AdaptiveModule } from './adaptive/adaptive.module';
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
import { ContactRequestsModule } from './contact-requests/contact-requests.module';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { DelegationContextInterceptor } from './common/interceptors/delegation-context.interceptor';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LoggerModule.forRoot(loggerConfig),
    ThrottlerModule.forRoot([
      { name: 'auth', ttl: 60000, limit: 5 },
      {
        name: 'default',
        ttl: 60000,
        // Production: 300 req/min protects the server from abuse.
        // Development: huge ceiling so React StrictMode double-mounts +
        // hot-reload + many widget fetches per page never trigger 429.
        limit: process.env.NODE_ENV === 'production' ? 300 : 100000,
      },
    ]),
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
    ChurnModule,
    AdaptiveModule,
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
    ContactRequestsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
    { provide: APP_INTERCEPTOR, useClass: DelegationContextInterceptor },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
