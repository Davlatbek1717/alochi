import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_INTERCEPTOR, APP_FILTER } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
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
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
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
  ],
  providers: [
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
