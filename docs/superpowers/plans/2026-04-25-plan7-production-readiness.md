# Plan 7: Production Readiness

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Loyihani production ga tayyor holga keltirish: to'liq seed ma'lumotlar, healthcheck endpoint, tuzilgan logging (Pino), E2E test, va GitHub Actions CI/CD pipeline.

**Architecture:** 5 mustaqil qism: (1) Seed — barcha rollar + namunaviy darslar; (2) Healthcheck — DB + AI Service + Telegram ping; (3) Pino logger — NestJS Logger o'rniga; (4) E2E — Playwright bilan login → dars oqimi; (5) CI — GitHub Actions test+build pipeline.

**Tech Stack:** Prisma seed, NestJS @nestjs/terminus (healthcheck), nestjs-pino + pino-pretty, Playwright (E2E), GitHub Actions (ubuntu-latest, node 20).

**Shart:** Plan 1–6 + TODO.md bajarilgan. `prisma/seed.ts` mavjud (faqat superadmin, filadmin, mentor uchun).

---

## Fayl Tuzilmasi

```
prisma/
  seed.ts                         ← MODIFY: manager, tester, student, sample lessons, groups qo'shish

apps/api/src/
  health/
    health.controller.ts          ← CREATE: GET /health
    health.module.ts              ← CREATE
  common/
    logger.config.ts              ← CREATE: Pino konfiguratsiya

apps/api/src/
  app.module.ts                   ← MODIFY: HealthModule, LoggerModule import
  main.ts                         ← MODIFY: Pino logger o'rnatish

test/
  e2e/
    lesson-flow.spec.ts           ← CREATE: Playwright E2E testi

.github/
  workflows/
    ci.yml                        ← CREATE: test + build pipeline
```

---

## Task 1: Seed — barcha rollar + namunaviy ma'lumotlar

**Files:**
- Modify: `prisma/seed.ts`

Hozirgi `seed.ts`: superadmin, filadmin, mentor mavjud. Manager, tester, student yo'q. Namunaviy darslar, guruhlar yo'q.

- [ ] **Step 1: seed.ts ni o'qing**

```bash
cat prisma/seed.ts
```

- [ ] **Step 2: Qo'shimcha foydalanuvchilarni qo'shing**

`prisma/seed.ts` da `main()` ichiga quyidagilarni qo'shing (mavjud `mentor` upsert dan keyin):

```typescript
  // Manager
  await prisma.user.upsert({
    where: { id: '00000000-0000-0000-0000-000000000013' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000013',
      tenantId: testTenant.id,
      branchId: branch.id,
      role: UserRole.manager,
      name: 'Sherzod Umarov',
      login: 'sherzod.manager',
      passwordHash: hash,
    },
  });

  // Tester
  await prisma.user.upsert({
    where: { id: '00000000-0000-0000-0000-000000000014' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000014',
      tenantId: testTenant.id,
      branchId: branch.id,
      role: UserRole.tester,
      name: 'Malika Yusupova',
      login: 'malika.tester',
      passwordHash: hash,
    },
  });

  // Student 1
  const student1 = await prisma.user.upsert({
    where: { id: '00000000-0000-0000-0000-000000000015' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000015',
      tenantId: testTenant.id,
      branchId: branch.id,
      role: UserRole.student,
      name: 'Jasur Rahimov',
      login: 'jasur.student',
      passwordHash: hash,
    },
  });

  // Student 2
  await prisma.user.upsert({
    where: { id: '00000000-0000-0000-0000-000000000016' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000016',
      tenantId: testTenant.id,
      branchId: branch.id,
      role: UserRole.student,
      name: 'Zulfiya Nazarova',
      login: 'zulfiya.student',
      passwordHash: hash,
    },
  });
```

- [ ] **Step 3: Namunaviy darslar qo'shing**

Yuqoridagi student upsertlardan keyin:

```typescript
  // Namunaviy darslar
  const lesson1 = await prisma.lesson.upsert({
    where: { id: '00000000-0000-0000-0000-000000000101' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000101',
      tenantId: testTenant.id,
      title: 'Present Simple — Asoslar',
      type: 'grammar',
      orderNumber: 1,
      youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      nRepetitions: 3,
      maxNOverride: 10,
      isPublished: true,
    },
  });

  const lesson2 = await prisma.lesson.upsert({
    where: { id: '00000000-0000-0000-0000-000000000102' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000102',
      tenantId: testTenant.id,
      title: 'Past Simple — Amaliyot',
      type: 'grammar',
      orderNumber: 2,
      nRepetitions: 5,
      maxNOverride: 15,
      isPublished: true,
    },
  });

  // MCQ komponent — lesson1 uchun
  await prisma.lessonComponent.upsert({
    where: { id: '00000000-0000-0000-0000-000000000201' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000201',
      lessonId: lesson1.id,
      type: 'mcq',
      orderIndex: 0,
      data: {
        question: 'She ___ to school every day.',
        options: ['go', 'goes', 'going', 'gone'],
        correctIndex: 1,
      },
    },
  });

  // Student1 uchun XP yozuvi
  await prisma.studentXp.upsert({
    where: { studentId: student1.id },
    update: {},
    create: {
      studentId: student1.id,
      totalXp: 150,
      currentStreak: 3,
      shieldCount: 1,
      lastActivityDate: new Date(),
    },
  });

  console.log('✅ Seed bajarildi: 6 rol, 2 dars, 1 MCQ, 1 XP yozuvi');
```

- [ ] **Step 4: Seed ishlatib ko'ring**

```bash
cd apps/api && pnpm run db:seed
```

Kutilgan: `✅ Seed bajarildi: 6 rol, 2 dars, 1 MCQ, 1 XP yozuvi`

Agar `db:seed` skript yo'q bo'lsa, `package.json` da quyidagicha bo'lishi kerak:
```json
"db:seed": "ts-node -r tsconfig-paths/register ../../prisma/seed.ts"
```
Yoki: `cd d:/projects/alochi && pnpm --filter api exec ts-node -r tsconfig-paths/register prisma/seed.ts`

- [ ] **Step 5: Commit**

```bash
git add prisma/seed.ts
git commit -m "feat: expand seed with all 6 roles, sample lessons, MCQ, and XP records"
```

---

## Task 2: Healthcheck Endpoint

**Files:**
- Create: `apps/api/src/health/health.controller.ts`
- Create: `apps/api/src/health/health.module.ts`
- Modify: `apps/api/src/app.module.ts`

**Install:**
```bash
pnpm --filter api add @nestjs/terminus @nestjs/axios
```

- [ ] **Step 1: `health.module.ts` yarating**

```typescript
// apps/api/src/health/health.module.ts
import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HttpModule } from '@nestjs/axios';
import { HealthController } from './health.controller';

@Module({
  imports: [TerminusModule, HttpModule],
  controllers: [HealthController],
})
export class HealthModule {}
```

- [ ] **Step 2: `health.controller.ts` yarating**

```typescript
// apps/api/src/health/health.controller.ts
import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService, PrismaHealthIndicator } from '@nestjs/terminus';
import { PrismaService } from '../prisma/prisma.service';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private prismaIndicator: PrismaHealthIndicator,
    private prisma: PrismaService,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.prismaIndicator.pingCheck('database', this.prisma),
    ]);
  }
}
```

**Muhim:** `@nestjs/terminus` v10 da `PrismaHealthIndicator` mavjud emas. Uning o'rniga manual ping ishlatamiz:

```typescript
// apps/api/src/health/health.controller.ts
import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  HealthIndicatorResult,
  HealthIndicator,
} from '@nestjs/terminus';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ApiTags } from '@nestjs/swagger';

@Injectable()
class DbHealthIndicator extends HealthIndicator {
  constructor(private prisma: PrismaService) {
    super();
  }
  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return this.getStatus(key, true);
    } catch {
      return this.getStatus(key, false);
    }
  }
}

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: DbHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.db.isHealthy('database'),
    ]);
  }
}
```

Va `health.module.ts` ga `DbHealthIndicator` ni providers ga qo'shing:
```typescript
providers: [DbHealthIndicator],
```
`PrismaModule` eksport qilganligini tekshiring — `DbHealthIndicator` ga `PrismaService` inject bo'lishi uchun.

- [ ] **Step 3: `app.module.ts` ga `HealthModule` qo'shing**

```typescript
import { HealthModule } from './health/health.module';
// imports massivida:
HealthModule,
```

- [ ] **Step 4: Tekshiring**

```bash
pnpm --filter api exec tsc --noEmit
```
Kutilgan: 0 xato.

```bash
# API ishga tushirgan bo'lsangiz:
curl http://localhost:3001/health
# Kutilgan: { "status": "ok", "info": { "database": { "status": "up" } } }
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/health/ apps/api/src/app.module.ts
git commit -m "feat: add /health endpoint with database ping via @nestjs/terminus"
```

---

## Task 3: Pino Strukturali Logging

**Files:**
- Create: `apps/api/src/common/logger.config.ts`
- Modify: `apps/api/src/main.ts`
- Modify: `apps/api/src/app.module.ts`

**Install:**
```bash
pnpm --filter api add nestjs-pino pino-http pino-pretty
pnpm --filter api add -D @types/pino-http
```

- [ ] **Step 1: Logger konfiguratsiyasini yarating**

```typescript
// apps/api/src/common/logger.config.ts
import { Params } from 'nestjs-pino';

export const loggerConfig: Params = {
  pinoHttp: {
    transport:
      process.env.NODE_ENV !== 'production'
        ? { target: 'pino-pretty', options: { colorize: true, singleLine: true } }
        : undefined,
    level: process.env.LOG_LEVEL ?? 'info',
    redact: ['req.headers.authorization'],
    serializers: {
      req(req: { method: string; url: string }) {
        return { method: req.method, url: req.url };
      },
    },
  },
};
```

- [ ] **Step 2: `app.module.ts` ga `LoggerModule` qo'shing**

```typescript
import { LoggerModule } from 'nestjs-pino';
import { loggerConfig } from './common/logger.config';

// imports massivida (ConfigModule dan keyin):
LoggerModule.forRoot(loggerConfig),
```

- [ ] **Step 3: `main.ts` da Pino logger o'rnating**

`main.ts` ni o'qib, `bootstrap()` ichiga `NestFactory.create` dan keyin qo'shing:

```typescript
import { Logger } from 'nestjs-pino';

// NestFactory.create dan keyin:
app.useLogger(app.get(Logger));
```

To'liq `main.ts` ko'rinishi:
```typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.use(helmet());
  app.enableCors({
    origin: process.env.NODE_ENV === 'production'
      ? process.env.ALLOWED_ORIGIN ?? 'https://yourdomain.com'
      : true,
    credentials: true,
  });
  const config = new DocumentBuilder()
    .setTitle("A'lochi API")
    .setDescription("A'lochi ta'lim platformasi API hujjatlari")
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
```

- [ ] **Step 4: TypeScript tekshirish**

```bash
pnpm --filter api exec tsc --noEmit
```
Kutilgan: 0 xato.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/common/logger.config.ts apps/api/src/main.ts apps/api/src/app.module.ts
git commit -m "feat: replace NestJS Logger with Pino structured logging"
```

---

## Task 4: GitHub Actions CI/CD Pipeline

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: `.github/workflows/` papkasini tekshiring**

```bash
ls .github/workflows/ 2>/dev/null || echo "yo'q"
```

- [ ] **Step 2: `ci.yml` yarating**

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [master, feat/**]
  pull_request:
    branches: [master]

jobs:
  test-and-build:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: pgvector/pgvector:pg16
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: password
          POSTGRES_DB: alochi_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd "pg_isready -U postgres"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    env:
      DATABASE_URL: postgresql://postgres:password@localhost:5432/alochi_test?schema=public
      JWT_SECRET: test-jwt-secret-32-characters-long-key
      JWT_REFRESH_SECRET: test-refresh-secret-32-characters-long
      NODE_ENV: test

    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 10

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Generate Prisma client
        run: pnpm --filter api exec prisma generate

      - name: Push schema to test DB
        run: pnpm --filter api exec prisma db push --accept-data-loss

      - name: Run API unit tests
        run: pnpm --filter api test -- --passWithNoTests

      - name: Build API
        run: pnpm --filter api build

      - name: Build Web
        run: pnpm --filter web build
        env:
          NEXT_PUBLIC_API_URL: http://localhost:3001
```

- [ ] **Step 3: `.github` papkasini `.gitignore` da tekshiring**

```bash
grep ".github" .gitignore || echo ".github gitignore da yo'q (to'g'ri)"
```

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add GitHub Actions pipeline — test, build API and web"
```

---

## Task 5: E2E Test — Login → Dars Oqimi

**Files:**
- Create: `apps/api/test/e2e/auth-lesson.e2e-spec.ts`

Bu test haqiqiy DB ga ulanadi (integration test) va to'liq HTTP so'rovlarini tekshiradi.

**Install** (agar supertest yo'q bo'lsa — lekin allaqachon bor):
```bash
grep supertest apps/api/package.json
# supertest: "^7.0.0" — bor
```

- [ ] **Step 1: E2E test fayli yarating**

```typescript
// apps/api/test/e2e/auth-lesson.e2e-spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';

describe('Auth + Lesson flow (e2e)', () => {
  let app: INestApplication;
  let accessToken: string;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /auth/login — superadmin login', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .set('x-tenant-slug', 'demo-markaz')
      .send({ login: 'superadmin', password: 'Test1234!' })
      .expect(201);

    expect(res.body.data).toHaveProperty('accessToken');
    accessToken = res.body.data.accessToken;
  });

  it('GET /lessons — authenticated request returns list', async () => {
    const res = await request(app.getHttpServer())
      .get('/lessons')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('POST /auth/login — wrong password returns 401', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .set('x-tenant-slug', 'demo-markaz')
      .send({ login: 'superadmin', password: 'wrongpassword' })
      .expect(401);
  });

  it('GET /lessons — unauthenticated returns 401', async () => {
    await request(app.getHttpServer())
      .get('/lessons')
      .expect(401);
  });

  it('GET /gamification/xp — student can get own XP', async () => {
    // Student login
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .set('x-tenant-slug', 'demo-markaz')
      .send({ login: 'jasur.student', password: 'Test1234!' })
      .expect(201);

    const studentToken = loginRes.body.data.accessToken;

    const xpRes = await request(app.getHttpServer())
      .get('/gamification/xp')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);

    expect(xpRes.body.data).toHaveProperty('totalXp');
  });
});
```

- [ ] **Step 2: E2E jest config ni tekshiring**

```bash
cat apps/api/test/jest-e2e.json
```

Kutilgan tarkib:
```json
{
  "moduleFileExtensions": ["js", "json", "ts"],
  "rootDir": ".",
  "testEnvironment": "node",
  "testRegex": ".e2e-spec.ts$",
  "transform": { "^.+\\.(t|j)s$": "ts-jest" }
}
```

Agar `moduleNameMapper` kerak bo'lsa (Prisma imports uchun):
```json
{
  "moduleNameMapper": {
    "^src/(.*)$": "<rootDir>/../src/$1"
  }
}
```

- [ ] **Step 3: E2E testni ishga tushiring (DB ulangan bo'lishi kerak)**

```bash
cd apps/api && DATABASE_URL="postgresql://postgres:password@localhost:5432/alochi?schema=public" pnpm test:e2e
```

Kutilgan: 5/5 tests passed.

Agar DB yo'q bo'lsa, test `SKIP` bo'ladi — bu normal.

- [ ] **Step 4: Commit**

```bash
git add apps/api/test/e2e/auth-lesson.e2e-spec.ts
git commit -m "test: add E2E tests for auth login and lesson access flow"
```

---

## Task 6: Nginx Konfiguratsiya

**Files:**
- Create: `nginx/nginx.conf`
- Modify: `docker-compose.yml`

- [ ] **Step 1: `nginx/` papkasini yarating va `nginx.conf` yozing**

```nginx
# nginx/nginx.conf
events {
  worker_connections 1024;
}

http {
  upstream api {
    server api:3001;
  }

  upstream web {
    server web:3000;
  }

  upstream ai {
    server ai-service:8000;
  }

  server {
    listen 80;
    server_name _;

    # API
    location /api/ {
      proxy_pass http://api/;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket (Socket.io)
    location /socket.io/ {
      proxy_pass http://api/socket.io/;
      proxy_http_version 1.1;
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection "upgrade";
      proxy_set_header Host $host;
    }

    # AI Service
    location /ai/ {
      proxy_pass http://ai/;
      proxy_set_header Host $host;
    }

    # Web (catch-all)
    location / {
      proxy_pass http://web/;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
    }
  }
}
```

- [ ] **Step 2: `docker-compose.yml` ga nginx servisi qo'shing**

`docker-compose.yml` ni o'qib, `services:` ga qo'shing:

```yaml
  nginx:
    image: nginx:alpine
    container_name: alochi_nginx
    ports:
      - '80:80'
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      - api
      - web
      - ai-service
```

- [ ] **Step 3: Commit**

```bash
git add nginx/nginx.conf docker-compose.yml
git commit -m "feat: add Nginx reverse proxy config for API, WebSocket, AI, and Web"
```

---

## Yakuniy tekshiruv

- [ ] **Barcha unit testlar o'tishini tekshiring**

```bash
pnpm --filter api test -- --passWithNoTests 2>&1 | tail -5
```
Kutilgan: `Tests: X passed`

- [ ] **Web build tekshiring**

```bash
pnpm --filter web build 2>&1 | tail -5
```
Kutilgan: `✓ Compiled successfully`

- [ ] **TypeScript tekshiring**

```bash
pnpm --filter api exec tsc --noEmit
```
Kutilgan: 0 xato.

- [ ] **Yakuniy commit (agar kerak bo'lsa)**

```bash
git log --oneline -10
```
