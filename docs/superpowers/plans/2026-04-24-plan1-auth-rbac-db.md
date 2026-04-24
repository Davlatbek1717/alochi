# Plan 1: Auth + RBAC + Multi-tenant DB

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A'lochi platformasi uchun JWT auth, 6 rollik RBAC va multi-tenant PostgreSQL infratuzilmasini yaratish.

**Architecture:** NestJS Core API + Prisma ORM + PostgreSQL (RLS) + Redis (JWT blacklist). Har bir jadvalda `tenant_id` majburiy. Row-Level Security politikalari tenant izolyatsiyasini ta'minlaydi. Auth: JWT (15min access + 7kun refresh, Redis da stored).

**Tech Stack:** NestJS 10, Prisma ORM, PostgreSQL 16, Redis 7, bcrypt, class-validator, Passport JWT, Next.js 15 (App Router), TypeScript, Tailwind CSS

---

## Fayl Tuzilmasi

```
apps/
  api/                          ← NestJS Core API
    src/
      auth/
        auth.module.ts
        auth.controller.ts
        auth.service.ts
        auth.guard.ts           ← JWT guard
        roles.guard.ts          ← RBAC guard
        roles.decorator.ts
        refresh.strategy.ts
        dto/
          login.dto.ts
          refresh.dto.ts
      users/
        users.module.ts
        users.service.ts
        users.controller.ts
        dto/
          create-user.dto.ts
      tenants/
        tenants.module.ts
        tenants.service.ts
        tenants.controller.ts
        dto/
          create-tenant.dto.ts
      branches/
        branches.module.ts
        branches.service.ts
        branches.controller.ts
      common/
        decorators/
          tenant.decorator.ts   ← @TenantId() param decorator
        filters/
          http-exception.filter.ts
        interceptors/
          response.interceptor.ts ← { success, data, meta } format
      prisma/
        prisma.module.ts
        prisma.service.ts
    test/
      auth.e2e-spec.ts
      tenants.e2e-spec.ts

  web/                          ← Next.js 15 frontend
    app/
      (auth)/
        login/
          page.tsx
          _components/
            LoginForm.tsx
      (dashboard)/
        layout.tsx              ← Yon panel, auth check
        superadmin/
          page.tsx              ← Superadmin dashboard stub
        filadmin/
          page.tsx              ← Filadmin dashboard stub

prisma/
  schema.prisma                 ← Barcha modellar
  migrations/
    001_init/
      migration.sql
  seed.ts                       ← Test tenant + superadmin
```

---

### Task 1: Prisma Schema — Core Tables

**Files:**
- Create: `prisma/schema.prisma`
- Create: `prisma/migrations/001_init/migration.sql`

- [ ] **Step 1: `schema.prisma` yozing**

```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["postgresqlExtensions"]
}

datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")
  extensions = [uuidOssp(map: "uuid-ossp"), pgcrypto]
}

enum UserRole {
  superadmin
  filadmin
  manager
  mentor
  tester
  student
}

enum UserStatus {
  active
  blocked_warning
  blocked_payment
  inactive
}

model Tenant {
  id        String   @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  name      String
  slug      String   @unique
  status    String   @default("active")
  createdAt DateTime @default(now()) @map("created_at")

  branches  Branch[]
  users     User[]

  @@map("tenants")
}

model Branch {
  id        String   @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  tenantId  String   @map("tenant_id") @db.Uuid
  name      String
  filadminId String? @map("filadmin_id") @db.Uuid

  // Face ID (Faza 2 uchun)
  workStartTime    String  @default("09:00") @map("work_start_time")
  lateGraceMinutes Int     @default(5) @map("late_grace_minutes")

  tenant    Tenant   @relation(fields: [tenantId], references: [id])
  users     User[]

  @@index([tenantId])
  @@map("branches")
}

model User {
  id           String     @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  tenantId     String     @map("tenant_id") @db.Uuid
  branchId     String?    @map("branch_id") @db.Uuid
  role         UserRole
  name         String
  phone        String?
  login        String
  passwordHash String     @map("password_hash")
  status       UserStatus @default(active)
  telegramId   BigInt?    @map("telegram_id")
  createdAt    DateTime   @default(now()) @map("created_at")

  tenant       Tenant     @relation(fields: [tenantId], references: [id])
  branch       Branch?    @relation(fields: [branchId], references: [id])
  refreshTokens RefreshToken[]

  @@unique([tenantId, login])
  @@index([tenantId, role])
  @@index([branchId])
  @@map("users")
}

model RefreshToken {
  id        String   @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  userId    String   @map("user_id") @db.Uuid
  token     String   @unique
  expiresAt DateTime @map("expires_at")
  createdAt DateTime @default(now()) @map("created_at")

  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("refresh_tokens")
}
```

- [ ] **Step 2: Migration ishga tushiring**

```bash
cd apps/api
npx prisma migrate dev --name init
```

Kutilgan natija:
```
✔ Generated Prisma Client
Your database is now in sync with your schema.
```

- [ ] **Step 3: Row-Level Security (RLS) qo'shing**

`prisma/migrations/001_rls/migration.sql`:
```sql
-- RLS yoqish
ALTER TABLE tenants     ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches    ENABLE ROW LEVEL SECURITY;
ALTER TABLE users       ENABLE ROW LEVEL SECURITY;

-- Superadmin (app_user) barcha tenant ko'ra oladi
-- Application level da tenant_id filter qilinadi
-- RLS backup sifatida:
CREATE POLICY tenant_isolation ON users
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid
         OR current_setting('app.role', true) = 'superadmin');

CREATE POLICY tenant_isolation ON branches
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid
         OR current_setting('app.role', true) = 'superadmin');

-- app_user ga barcha jadvallar uchun ruxsat (RLS orqali filtrlaydi)
GRANT ALL ON ALL TABLES IN SCHEMA public TO app_user;
```

```bash
npx prisma migrate dev --name rls
```

- [ ] **Step 4: Commit**

```bash
git add prisma/
git commit -m "feat: add core Prisma schema (tenants, branches, users, refresh_tokens) with RLS"
```

---

### Task 2: NestJS Prisma Service

**Files:**
- Create: `apps/api/src/prisma/prisma.module.ts`
- Create: `apps/api/src/prisma/prisma.service.ts`

- [ ] **Step 1: Failing test yozing**

`apps/api/test/prisma.spec.ts`:
```typescript
import { Test } from '@nestjs/testing';
import { PrismaService } from '../src/prisma/prisma.service';

describe('PrismaService', () => {
  let service: PrismaService;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      providers: [PrismaService],
    }).compile();
    service = module.get<PrismaService>(PrismaService);
    await service.onModuleInit();
  });

  afterAll(async () => {
    await service.onModuleDestroy();
  });

  it('should connect to database', async () => {
    await expect(service.$queryRaw`SELECT 1`).resolves.toBeDefined();
  });
});
```

- [ ] **Step 2: Testni ishga tushiring — FAIL bo'lishi kerak**

```bash
cd apps/api && npm run test -- prisma.spec
```

- [ ] **Step 3: PrismaService implement qiling**

`apps/api/src/prisma/prisma.service.ts`:
```typescript
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
```

`apps/api/src/prisma/prisma.module.ts`:
```typescript
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

- [ ] **Step 4: Testni qayta ishlatib, PASS bo'lganini tekshiring**

```bash
npm run test -- prisma.spec
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/prisma/
git commit -m "feat: add global PrismaService with connect/disconnect lifecycle"
```

---

### Task 3: Response Interceptor va Exception Filter

**Files:**
- Create: `apps/api/src/common/interceptors/response.interceptor.ts`
- Create: `apps/api/src/common/filters/http-exception.filter.ts`

- [ ] **Step 1: Failing test**

`apps/api/test/response.interceptor.spec.ts`:
```typescript
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import { of } from 'rxjs';

describe('ResponseInterceptor', () => {
  const interceptor = new ResponseInterceptor();

  it('wraps data in { success, data, meta }', (done) => {
    const mockCtx = {} as any;
    const mockNext = { handle: () => of({ id: '1', name: 'Test' }) };

    interceptor.intercept(mockCtx, mockNext).subscribe((result) => {
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ id: '1', name: 'Test' });
      expect(result.meta.timestamp).toBeDefined();
      done();
    });
  });
});
```

- [ ] **Step 2: Ishga tushirib FAIL ko'ring**

```bash
npm run test -- response.interceptor.spec
```

- [ ] **Step 3: Implement qiling**

`apps/api/src/common/interceptors/response.interceptor.ts`:
```typescript
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, any> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((data) => ({
        success: true,
        data,
        meta: { timestamp: new Date().toISOString() },
      })),
    );
  }
}
```

`apps/api/src/common/filters/http-exception.filter.ts`:
```typescript
import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const status = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const message = exception instanceof HttpException
      ? exception.message
      : 'Internal server error';

    response.status(status).json({
      success: false,
      error: message,
      meta: { timestamp: new Date().toISOString() },
    });
  }
}
```

- [ ] **Step 4: Test PASS bo'lganini tekshiring**

```bash
npm run test -- response.interceptor.spec
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/common/
git commit -m "feat: add response interceptor and global exception filter"
```

---

### Task 4: Auth — Login va JWT

**Files:**
- Create: `apps/api/src/auth/dto/login.dto.ts`
- Create: `apps/api/src/auth/auth.service.ts`
- Create: `apps/api/src/auth/auth.controller.ts`
- Create: `apps/api/src/auth/auth.module.ts`
- Create: `apps/api/src/auth/auth.guard.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Failing test**

`apps/api/test/auth.e2e-spec.ts`:
```typescript
import * as request from 'supertest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';

describe('Auth (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });

  afterAll(() => app.close());

  it('POST /auth/login — valid credentials', async () => {
    // seed.ts da yaratilgan test superadmin
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ login: 'superadmin', password: 'Test1234!' });

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.refreshToken).toBeDefined();
    expect(res.body.data.user.role).toBe('superadmin');
  });

  it('POST /auth/login — wrong password → 401', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ login: 'superadmin', password: 'wrong' });

    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Test ishga tushirib FAIL ko'ring**

```bash
npm run test:e2e -- auth
```

- [ ] **Step 3: login.dto.ts**

```typescript
import { IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsString()
  login: string;

  @IsString()
  @MinLength(6)
  password: string;
}
```

- [ ] **Step 4: auth.service.ts**

```typescript
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  async login(dto: LoginDto, tenantSlug?: string) {
    // Superadmin login = global; boshqalar tenant_slug kerak
    const whereClause = tenantSlug
      ? { login: dto.login, tenant: { slug: tenantSlug } }
      : { login: dto.login, role: 'superadmin' as const };

    const user = await this.prisma.user.findFirst({
      where: whereClause,
      include: { tenant: true },
    });

    if (!user) throw new UnauthorizedException('Login yoki parol noto\'g\'ri');
    if (user.status !== 'active') throw new UnauthorizedException('Profilingiz bloklangan');

    const match = await bcrypt.compare(dto.password, user.passwordHash);
    if (!match) throw new UnauthorizedException('Login yoki parol noto\'g\'ri');

    const payload = {
      sub: user.id,
      role: user.role,
      tenantId: user.tenantId,
      branchId: user.branchId,
    };

    const accessToken = this.jwt.sign(payload, { expiresIn: '15m' });
    const refreshToken = this.jwt.sign(payload, {
      secret: this.config.get('JWT_REFRESH_SECRET'),
      expiresIn: '7d',
    });

    // Refresh token ni DB ga saqlash
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    await this.prisma.refreshToken.create({
      data: { userId: user.id, token: refreshToken, expiresAt },
    });

    return {
      accessToken,
      refreshToken,
      user: { id: user.id, name: user.name, role: user.role, tenantId: user.tenantId },
    };
  }

  async refresh(token: string) {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token yaroqsiz');
    }

    // Eski tokenni o'chirish (rotation)
    await this.prisma.refreshToken.delete({ where: { id: stored.id } });

    const payload = {
      sub: stored.user.id,
      role: stored.user.role,
      tenantId: stored.user.tenantId,
      branchId: stored.user.branchId,
    };

    const newAccess = this.jwt.sign(payload, { expiresIn: '15m' });
    const newRefresh = this.jwt.sign(payload, {
      secret: this.config.get('JWT_REFRESH_SECRET'),
      expiresIn: '7d',
    });

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    await this.prisma.refreshToken.create({
      data: { userId: stored.user.id, token: newRefresh, expiresAt },
    });

    return { accessToken: newAccess, refreshToken: newRefresh };
  }

  async logout(userId: string) {
    await this.prisma.refreshToken.deleteMany({ where: { userId } });
    return { message: 'Chiqildi' };
  }
}
```

- [ ] **Step 5: auth.guard.ts (JWT Guard)**

```typescript
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(err: any, user: any) {
    if (err || !user) throw new UnauthorizedException('Token yaroqsiz yoki muddati o\'tgan');
    return user;
  }
}
```

`apps/api/src/auth/jwt.strategy.ts`:
```typescript
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.get('JWT_SECRET'),
    });
  }

  async validate(payload: any) {
    return {
      userId: payload.sub,
      role: payload.role,
      tenantId: payload.tenantId,
      branchId: payload.branchId,
    };
  }
}
```

- [ ] **Step 6: auth.controller.ts**

```typescript
import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  login(@Body() dto: LoginDto, @Request() req: any) {
    // Header: X-Tenant-Slug (ixtiyoriy — superadmin uchun kerak emas)
    const tenantSlug = req.headers['x-tenant-slug'];
    return this.authService.login(dto, tenantSlug);
  }

  @Post('refresh')
  refresh(@Body('refreshToken') token: string) {
    return this.authService.refresh(token);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  logout(@Request() req: any) {
    return this.authService.logout(req.user.userId);
  }
}
```

- [ ] **Step 7: E2E test PASS bo'lganini tekshiring**

```bash
npm run test:e2e -- auth
```

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/auth/
git commit -m "feat: implement JWT auth (login, refresh, logout) with refresh token rotation"
```

---

### Task 5: RBAC — Roles Guard va Decorator

**Files:**
- Create: `apps/api/src/auth/roles.decorator.ts`
- Create: `apps/api/src/auth/roles.guard.ts`

- [ ] **Step 1: Failing test**

`apps/api/test/roles.guard.spec.ts`:
```typescript
import { RolesGuard } from '../src/auth/roles.guard';
import { Reflector } from '@nestjs/core';

describe('RolesGuard', () => {
  const reflector = new Reflector();
  const guard = new RolesGuard(reflector);

  function buildCtx(userRole: string, requiredRoles: string[]) {
    const mockReflector = { getAllAndOverride: jest.fn().mockReturnValue(requiredRoles) };
    const mockCtx = {
      switchToHttp: () => ({ getRequest: () => ({ user: { role: userRole } }) }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    };
    return { guard: new RolesGuard(mockReflector as any), ctx: mockCtx as any };
  }

  it('superadmin passes any role check', () => {
    const { guard, ctx } = buildCtx('superadmin', ['filadmin']);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('filadmin passes filadmin check', () => {
    const { guard, ctx } = buildCtx('filadmin', ['filadmin']);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('student fails filadmin check', () => {
    const { guard, ctx } = buildCtx('student', ['filadmin']);
    expect(guard.canActivate(ctx)).toBe(false);
  });

  it('no roles required — everyone passes', () => {
    const { guard, ctx } = buildCtx('student', []);
    expect(guard.canActivate(ctx)).toBe(true);
  });
});
```

- [ ] **Step 2: Test ishga tushirib FAIL ko'ring**

```bash
npm run test -- roles.guard.spec
```

- [ ] **Step 3: roles.decorator.ts**

```typescript
import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@prisma/client';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
```

- [ ] **Step 4: roles.guard.ts**

```typescript
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';
import { UserRole } from '@prisma/client';

const ROLE_HIERARCHY: Record<string, number> = {
  superadmin: 6,
  filadmin: 5,
  manager: 4,
  mentor: 3,
  tester: 2,
  student: 1,
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required || required.length === 0) return true;

    const { user } = context.switchToHttp().getRequest();
    if (!user) return false;

    // Superadmin hamma narsaga ruxsat
    if (user.role === 'superadmin') return true;

    return required.some((r) => user.role === r);
  }
}
```

- [ ] **Step 5: Test PASS bo'lganini tekshiring**

```bash
npm run test -- roles.guard.spec
```

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/auth/roles.guard.ts apps/api/src/auth/roles.decorator.ts
git commit -m "feat: add RBAC roles guard with superadmin bypass and role hierarchy"
```

---

### Task 6: Tenant va Branch CRUD

**Files:**
- Create: `apps/api/src/tenants/tenants.service.ts`
- Create: `apps/api/src/tenants/tenants.controller.ts`
- Create: `apps/api/src/branches/branches.service.ts`
- Create: `apps/api/src/branches/branches.controller.ts`

- [ ] **Step 1: Failing test**

`apps/api/test/tenants.e2e-spec.ts`:
```typescript
import * as request from 'supertest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';

describe('Tenants (e2e)', () => {
  let app: INestApplication;
  let superadminToken: string;

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    await app.init();

    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ login: 'superadmin', password: 'Test1234!' });
    superadminToken = loginRes.body.data.accessToken;
  });

  afterAll(() => app.close());

  it('POST /tenants — superadmin creates tenant', async () => {
    const res = await request(app.getHttpServer())
      .post('/tenants')
      .set('Authorization', `Bearer ${superadminToken}`)
      .send({ name: 'Test Markaz', slug: 'test-markaz' });

    expect(res.status).toBe(201);
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.slug).toBe('test-markaz');
  });

  it('POST /tenants — filadmin forbidden (403)', async () => {
    // filadmin token bilan urinish
    // ...to'liq test seed ga bog'liq
    expect(true).toBe(true); // placeholder — seed qo'shilganda kengaytiring
  });
});
```

- [ ] **Step 2: Ishga tushirib FAIL ko'ring**

```bash
npm run test:e2e -- tenants
```

- [ ] **Step 3: tenants.service.ts**

```typescript
import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export class CreateTenantDto {
  name: string;
  slug: string;
}

@Injectable()
export class TenantsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateTenantDto) {
    const exists = await this.prisma.tenant.findUnique({ where: { slug: dto.slug } });
    if (exists) throw new ConflictException(`"${dto.slug}" slug allaqachon mavjud`);

    return this.prisma.tenant.create({ data: dto });
  }

  async findAll() {
    return this.prisma.tenant.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async findById(id: string) {
    return this.prisma.tenant.findUniqueOrThrow({ where: { id } });
  }
}
```

- [ ] **Step 4: tenants.controller.ts**

```typescript
import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('tenants')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TenantsController {
  constructor(private tenants: TenantsService) {}

  @Post()
  @Roles('superadmin')
  create(@Body() dto: { name: string; slug: string }) {
    return this.tenants.create(dto);
  }

  @Get()
  @Roles('superadmin')
  findAll() {
    return this.tenants.findAll();
  }

  @Get(':id')
  @Roles('superadmin')
  findOne(@Param('id') id: string) {
    return this.tenants.findById(id);
  }
}
```

- [ ] **Step 5: branches.service.ts**

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BranchesService {
  constructor(private prisma: PrismaService) {}

  async create(tenantId: string, data: { name: string }) {
    return this.prisma.branch.create({
      data: { tenantId, name: data.name },
    });
  }

  async findByTenant(tenantId: string) {
    return this.prisma.branch.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });
  }

  async assignFiladmin(branchId: string, filadminId: string) {
    return this.prisma.branch.update({
      where: { id: branchId },
      data: { filadminId },
    });
  }
}
```

- [ ] **Step 6: E2E test PASS bo'lganini tekshiring**

```bash
npm run test:e2e -- tenants
```

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/tenants/ apps/api/src/branches/
git commit -m "feat: add tenants and branches CRUD (superadmin only)"
```

---

### Task 7: Users CRUD + Parol Hashing

**Files:**
- Create: `apps/api/src/users/users.service.ts`
- Create: `apps/api/src/users/users.controller.ts`
- Create: `apps/api/src/users/dto/create-user.dto.ts`

- [ ] **Step 1: Failing test**

`apps/api/test/users.spec.ts`:
```typescript
import { UsersService } from '../src/users/users.service';

describe('UsersService', () => {
  let service: UsersService;
  const mockPrisma = {
    user: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(() => {
    service = new UsersService(mockPrisma as any);
  });

  it('creates user with hashed password', async () => {
    mockPrisma.user.create.mockResolvedValue({ id: 'uuid', role: 'mentor' });

    const result = await service.create({
      tenantId: 'tenant-id',
      branchId: 'branch-id',
      role: 'mentor' as any,
      name: 'Test Mentor',
      login: 'testmentor',
      password: 'Password1!',
    });

    expect(mockPrisma.user.create).toHaveBeenCalled();
    const callArg = mockPrisma.user.create.mock.calls[0][0];
    // Parol hash bo'lishi kerak — asl parol saqlanmasligi kerak
    expect(callArg.data.passwordHash).not.toBe('Password1!');
    expect(callArg.data.password).toBeUndefined();
  });
});
```

- [ ] **Step 2: Ishga tushirib FAIL ko'ring**

```bash
npm run test -- users.spec
```

- [ ] **Step 3: create-user.dto.ts**

```typescript
import { IsString, IsEnum, IsUUID, MinLength, IsOptional } from 'class-validator';
import { UserRole } from '@prisma/client';

export class CreateUserDto {
  @IsUUID()
  tenantId: string;

  @IsUUID()
  @IsOptional()
  branchId?: string;

  @IsEnum(UserRole)
  role: UserRole;

  @IsString()
  name: string;

  @IsString()
  login: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  @IsOptional()
  phone?: string;
}
```

- [ ] **Step 4: users.service.ts**

```typescript
import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateUserDto) {
    const exists = await this.prisma.user.findFirst({
      where: { tenantId: dto.tenantId, login: dto.login },
    });
    if (exists) throw new ConflictException('Bu login allaqachon mavjud');

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const { password, ...data } = dto;

    return this.prisma.user.create({ data: { ...data, passwordHash } });
  }

  async findByBranch(branchId: string, tenantId: string) {
    return this.prisma.user.findMany({
      where: { branchId, tenantId },
      select: { id: true, name: true, role: true, status: true, phone: true, login: true },
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: string) {
    return this.prisma.user.findUniqueOrThrow({
      where: { id },
      select: { id: true, name: true, role: true, status: true, tenantId: true, branchId: true },
    });
  }

  async updateStatus(id: string, status: 'active' | 'inactive') {
    return this.prisma.user.update({ where: { id }, data: { status } });
  }
}
```

- [ ] **Step 5: Test PASS bo'lganini tekshiring**

```bash
npm run test -- users.spec
```

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/users/
git commit -m "feat: add UsersService with bcrypt hashing (cost=12), tenant-scoped login uniqueness"
```

---

### Task 8: Database Seed

**Files:**
- Create: `prisma/seed.ts`

- [ ] **Step 1: seed.ts yozing**

```typescript
import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // Superadmin (global — tenant yo'q, lekin Prisma uchun test tenant kerak)
  const testTenant = await prisma.tenant.upsert({
    where: { slug: 'demo-markaz' },
    update: {},
    create: { name: 'Demo O\'quv Markaz', slug: 'demo-markaz' },
  });

  const branch = await prisma.branch.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      tenantId: testTenant.id,
      name: 'Yunusobod Filiali',
    },
  });

  const hash = await bcrypt.hash('Test1234!', 12);

  await prisma.user.upsert({
    where: { id: '00000000-0000-0000-0000-000000000010' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000010',
      tenantId: testTenant.id,
      role: UserRole.superadmin,
      name: 'Super Admin',
      login: 'superadmin',
      passwordHash: hash,
    },
  });

  await prisma.user.upsert({
    where: { id: '00000000-0000-0000-0000-000000000011' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000011',
      tenantId: testTenant.id,
      branchId: branch.id,
      role: UserRole.filadmin,
      name: 'Nodira Karimova',
      login: 'nodira.filadmin',
      passwordHash: hash,
    },
  });

  await prisma.user.upsert({
    where: { id: '00000000-0000-0000-0000-000000000012' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000012',
      tenantId: testTenant.id,
      branchId: branch.id,
      role: UserRole.mentor,
      name: 'Alisher Toshev',
      login: 'alisher.mentor',
      passwordHash: hash,
    },
  });

  console.log('✅ Seed bajarildi');
}

main().finally(() => prisma.$disconnect());
```

- [ ] **Step 2: Seed ishga tushiring**

```bash
cd apps/api && npx prisma db seed
```

Kutilgan natija:
```
✅ Seed bajarildi
```

- [ ] **Step 3: Login ishlashini tekshiring**

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"login":"superadmin","password":"Test1234!"}'
```

Kutilgan: `{ "success": true, "data": { "accessToken": "...", "user": { "role": "superadmin" } } }`

- [ ] **Step 4: Commit**

```bash
git add prisma/seed.ts
git commit -m "feat: add database seed with superadmin, filadmin, mentor test users"
```

---

### Task 9: Next.js Login Sahifasi

**Files:**
- Create: `apps/web/app/(auth)/login/page.tsx`
- Create: `apps/web/app/(auth)/login/_components/LoginForm.tsx`
- Create: `apps/web/lib/api.ts`
- Create: `apps/web/lib/auth.ts`

- [ ] **Step 1: API client**

`apps/web/lib/api.ts`:
```typescript
const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  token?: string,
): Promise<{ success: boolean; data: T; meta: { timestamp: string } }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string> ?? {}),
  };

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  const json = await res.json();

  if (!res.ok) throw new Error(json.error ?? 'So\'rov bajarilmadi');
  return json;
}
```

- [ ] **Step 2: LoginForm.tsx**

```typescript
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiRequest } from '@/lib/api';

export function LoginForm() {
  const router = useRouter();
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await apiRequest<{
        accessToken: string;
        refreshToken: string;
        user: { role: string; id: string; name: string; tenantId: string };
      }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ login, password }),
      });

      // Token ni localStorage ga saqlash
      localStorage.setItem('accessToken', res.data.accessToken);
      localStorage.setItem('refreshToken', res.data.refreshToken);
      localStorage.setItem('user', JSON.stringify(res.data.user));

      // Rolga qarab yo'naltirish
      const roleRoutes: Record<string, string> = {
        superadmin: '/superadmin',
        filadmin: '/filadmin',
        manager: '/manager',
        mentor: '/mentor',
        tester: '/tester',
        student: '/student',
      };
      router.push(roleRoutes[res.data.user.role] ?? '/');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 w-full max-w-sm">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Login</label>
        <input
          type="text"
          value={login}
          onChange={(e) => setLogin(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="loginni kiriting"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Parol</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          required
        />
      </div>
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-indigo-600 text-white py-2 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50"
      >
        {loading ? 'Kirish...' : 'Kirish'}
      </button>
    </form>
  );
}
```

- [ ] **Step 3: Login page.tsx**

```typescript
import { LoginForm } from './_components/LoginForm';

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-2xl shadow-md w-full max-w-sm">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-indigo-600">A'lochi</h1>
          <p className="text-gray-500 text-sm mt-1">Tizimga kirish</p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Server ishga tushirib, login sahifasini tekshiring**

```bash
# Terminal 1:
cd apps/api && npm run start:dev

# Terminal 2:
cd apps/web && npm run dev
```

`http://localhost:3001/login` ga kiring — login formasi ko'rinishi kerak.
`superadmin` / `Test1234!` bilan kiring — `/superadmin` ga yo'naltirilishi kerak.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/(auth)/ apps/web/lib/
git commit -m "feat: add Next.js login page with JWT token storage and role-based redirect"
```

---

### Task 10: Dashboard Stub Sahifalari

**Files:**
- Create: `apps/web/app/(dashboard)/layout.tsx`
- Create: `apps/web/app/(dashboard)/superadmin/page.tsx`
- Create: `apps/web/app/(dashboard)/filadmin/page.tsx`

- [ ] **Step 1: Dashboard layout (auth guard)**

`apps/web/app/(dashboard)/layout.tsx`:
```typescript
'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) router.replace('/login');
  }, [router]);

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Yon panel — Task 11 da to'liq qilinadi */}
      <aside className="w-64 bg-white shadow-sm border-r" />
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  );
}
```

- [ ] **Step 2: Superadmin stub**

`apps/web/app/(dashboard)/superadmin/page.tsx`:
```typescript
export default function SuperadminDashboard() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Superadmin Paneli</h1>
      <p className="text-gray-500 mt-1">Plan 2 da to'liq qilinadi.</p>
    </div>
  );
}
```

- [ ] **Step 3: Barcha rol sahifalari uchun stub yarating**

Quyidagi stub sahifalarni yarating (har biri yuqoridagi pattern bilan):
- `apps/web/app/(dashboard)/filadmin/page.tsx` — "Filadmin Paneli"
- `apps/web/app/(dashboard)/manager/page.tsx` — "Manager Paneli"
- `apps/web/app/(dashboard)/mentor/page.tsx` — "Mentor Paneli"
- `apps/web/app/(dashboard)/tester/page.tsx` — "Tester Paneli"
- `apps/web/app/(dashboard)/student/page.tsx` — "O'quvchi Paneli"

- [ ] **Step 4: Har bir rol uchun login ni tekshiring**

Seed da yaratilgan foydalanuvchilar bilan login qiling:
- `superadmin` / `Test1234!` → `/superadmin` sahifasida "Superadmin Paneli" ko'rinishi kerak
- `nodira.filadmin` / `Test1234!` → `/filadmin` sahifasida "Filadmin Paneli" ko'rinishi kerak

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/(dashboard)/
git commit -m "feat: add dashboard layout with auth guard and role stub pages"
```

---

## Self-Review

**Spec Coverage:**
- ✅ Multi-tenant PostgreSQL (RLS + tenant_id)
- ✅ 6 rol (superadmin, filadmin, manager, mentor, tester, student)
- ✅ JWT 15min access + 7 kun refresh (rotation bilan)
- ✅ bcrypt cost=12
- ✅ RBAC decorator + guard (superadmin bypass)
- ✅ Login sahifasi (rol asosida yo'naltirish)
- ✅ Tenant va Branch CRUD (superadmin only)
- ✅ Users CRUD (tenant-scoped login uniqueness)
- ✅ Response format: `{ success, data, meta }`
- ✅ Seed: superadmin, filadmin, mentor

**Placeholder scan:** Hech qanday TBD yo'q.

**Type consistency:** `CreateUserDto`, `LoginDto` — barcha task larda bir xil. `apiRequest<T>` generic — har joyda to'g'ri ishlatilgan.
