# Plan 2: Dars Flow + O'quvchi / Mentor / Manager Paneli

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Superadmin dars yaratadi (video + MCQ + so'z tartibi); o'quvchi uy qismini o'tadi (video blok, testlar, N sessiya); Mentor + Manager asosiy panellari ishlaydi.

**Architecture:** Darslar `lessons` + `lesson_components` da saqlanadi. O'quvchi taraqiyoti `student_progress` + `student_lesson_config` (N override) da. YouTube tezlashtirish bloki iframe API `onStateChange` event orqali. Faza 2 komponentlari (AI Tutor, Azure, kamera) DB da saqlanadi lekin UI da "Tez kunda" ko'rsatiladi.

**Tech Stack:** Plan 1 stack + YouTube iframe API, React Hook Form, Zod validation, Zustand (client state), SWR (data fetching)

**Shart:** Plan 1 bajarilgan bo'lishi kerak (auth + DB ishlayapti).

---

## Fayl Tuzilmasi

```
apps/
  api/src/
    lessons/
      lessons.module.ts
      lessons.service.ts
      lessons.controller.ts
      dto/
        create-lesson.dto.ts
        update-lesson.dto.ts
    lesson-progress/
      progress.module.ts
      progress.service.ts
      progress.controller.ts
    student-lesson-config/
      config.module.ts
      config.service.ts
      config.controller.ts

  web/app/(dashboard)/
    superadmin/
      lessons/
        page.tsx              ← Darslar ro'yxati
        new/
          page.tsx            ← Yangi dars yaratish
        [id]/
          page.tsx            ← Dars tahrirlash
    student/
      page.tsx                ← Dashboard (yo'l xaritasi + progress)
      lessons/
        [id]/
          page.tsx            ← Dars sahifasi (video → test → akademiya)
          _components/
            VideoPlayer.tsx   ← YouTube tezlashtirish bloki
            McqTest.tsx       ← Ko'p tanlovli test
            WordOrderTest.tsx ← So'zlarni tartiblash
            SessionCounter.tsx
    mentor/
      page.tsx                ← Guruh ko'rinishi + davomat tugmasi
      group/
        page.tsx              ← Guruh ro'yxati + status berish
    manager/
      page.tsx                ← Qizil/Sariq o'quvchilar
      students/
        [id]/
          page.tsx            ← O'quvchi profili + N override

prisma/
  schema.prisma               ← Lessons, progress jadvallari qo'shiladi
```

---

### Task 1: Lessons Schema (Prisma)

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Lessons modellarini schema.prisma ga qo'shing**

```prisma
enum LessonType {
  english
  personal_development
  critical_thinking
  experiment
}

model Lesson {
  id          String     @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  tenantId    String     @map("tenant_id") @db.Uuid
  title       String
  type        LessonType
  orderNumber Int        @map("order_number")
  youtubeUrl  String     @map("youtube_url")
  nRepetitions Int       @default(3) @map("n_repetitions")
  maxNOverride Int       @default(10) @map("max_n_override")
  components  Json       @default("{}")
  // components format:
  // { mcq: bool, word_order: bool, vocabulary: bool, ai_tutor: bool, camera: bool }
  isPublished Boolean    @default(false) @map("is_published")
  createdAt   DateTime   @default(now()) @map("created_at")
  updatedAt   DateTime   @updatedAt @map("updated_at")

  tenant      Tenant     @relation(fields: [tenantId], references: [id])
  components_data LessonComponent[]
  progress    StudentProgress[]

  @@unique([tenantId, orderNumber])
  @@index([tenantId, isPublished])
  @@map("lessons")
}

model LessonComponent {
  id       String @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  lessonId String @map("lesson_id") @db.Uuid
  type     String // 'mcq' | 'word_order' | 'vocabulary' | 'ai_tutor'
  config   Json   // savollar, so'zlar, kontekst
  // MCQ: { questions: [{ text, options: [string], correct: number }] }
  // word_order: { sentences: [{ words: [string], correct: string }] }
  // vocabulary: { words: [{ uzbek: string, english: string }] }
  // ai_tutor: { context: string, subject: string }

  lesson   Lesson @relation(fields: [lessonId], references: [id], onDelete: Cascade)

  @@map("lesson_components")
}

model StudentProgress {
  id               String    @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  studentId        String    @map("student_id") @db.Uuid
  lessonId         String    @map("lesson_id") @db.Uuid
  sessionCount     Int       @default(0) @map("session_count")
  homeCompleted    Boolean   @default(false) @map("home_completed")
  academyCompleted Boolean   @default(false) @map("academy_completed")
  completedAt      DateTime? @map("completed_at")
  lastActivityAt   DateTime? @map("last_activity_at")

  student  User   @relation("StudentProgress", fields: [studentId], references: [id])
  lesson   Lesson @relation(fields: [lessonId], references: [id])

  @@unique([studentId, lessonId])
  @@index([studentId])
  @@map("student_progress")
}

model StudentLessonConfig {
  id                  String   @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  studentId           String   @map("student_id") @db.Uuid
  lessonId            String   @map("lesson_id") @db.Uuid
  nRepetitionsOverride Int     @map("n_repetitions_override")
  changedBy           String   @map("changed_by") @db.Uuid
  changedAt           DateTime @default(now()) @map("changed_at")
  reason              String?

  student   User   @relation("StudentConfig", fields: [studentId], references: [id])
  lesson    Lesson @relation(fields: [lessonId], references: [id])
  manager   User   @relation("ManagerConfig", fields: [changedBy], references: [id])

  @@unique([studentId, lessonId])
  @@map("student_lesson_config")
}
```

- [ ] **Step 2: Migration**

```bash
npx prisma migrate dev --name add-lessons-progress
```

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: add lessons, lesson_components, student_progress, student_lesson_config schema"
```

---

### Task 2: Lessons CRUD API

**Files:**
- Create: `apps/api/src/lessons/lessons.service.ts`
- Create: `apps/api/src/lessons/lessons.controller.ts`
- Create: `apps/api/src/lessons/dto/create-lesson.dto.ts`

- [ ] **Step 1: Failing test**

`apps/api/test/lessons.spec.ts`:
```typescript
import { LessonsService } from '../src/lessons/lessons.service';

describe('LessonsService', () => {
  const mockPrisma = {
    lesson: {
      create: jest.fn().mockResolvedValue({
        id: 'lesson-uuid',
        tenantId: 'tenant-uuid',
        title: 'Present Simple',
        orderNumber: 1,
      }),
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
    },
  };

  const service = new LessonsService(mockPrisma as any);

  it('creates a lesson', async () => {
    const result = await service.create({
      tenantId: 'tenant-uuid',
      title: 'Present Simple',
      type: 'english' as any,
      orderNumber: 1,
      youtubeUrl: 'https://youtu.be/test',
      nRepetitions: 3,
    });
    expect(result.id).toBe('lesson-uuid');
    expect(mockPrisma.lesson.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ title: 'Present Simple' }),
      }),
    );
  });

  it('blocks duplicate order number in same tenant', async () => {
    mockPrisma.lesson.findFirst.mockResolvedValueOnce({ id: 'existing' });
    await expect(
      service.create({
        tenantId: 'tenant-uuid',
        title: 'Another',
        type: 'english' as any,
        orderNumber: 1,
        youtubeUrl: 'https://youtu.be/test2',
        nRepetitions: 3,
      }),
    ).rejects.toThrow('tartib raqami');
  });
});
```

- [ ] **Step 2: Ishga tushirib FAIL ko'ring**

```bash
npm run test -- lessons.spec
```

- [ ] **Step 3: create-lesson.dto.ts**

```typescript
import { IsString, IsEnum, IsInt, IsUrl, IsBoolean, IsOptional, Min, Max } from 'class-validator';

export class CreateLessonDto {
  @IsString()
  tenantId: string;

  @IsString()
  title: string;

  @IsEnum(['english', 'personal_development', 'critical_thinking', 'experiment'])
  type: string;

  @IsInt() @Min(1)
  orderNumber: number;

  @IsUrl()
  youtubeUrl: string;

  @IsInt() @Min(1) @Max(10)
  nRepetitions: number;

  @IsInt() @IsOptional() @Max(20)
  maxNOverride?: number;

  @IsBoolean() @IsOptional()
  mcqEnabled?: boolean;

  @IsBoolean() @IsOptional()
  wordOrderEnabled?: boolean;

  @IsBoolean() @IsOptional()
  vocabularyEnabled?: boolean;
}
```

- [ ] **Step 4: lessons.service.ts**

```typescript
import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLessonDto } from './dto/create-lesson.dto';

@Injectable()
export class LessonsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateLessonDto) {
    const existing = await this.prisma.lesson.findFirst({
      where: { tenantId: dto.tenantId, orderNumber: dto.orderNumber },
    });
    if (existing) throw new ConflictException(`${dto.orderNumber} tartib raqami allaqachon mavjud`);

    const { mcqEnabled, wordOrderEnabled, vocabularyEnabled, ...data } = dto;
    return this.prisma.lesson.create({
      data: {
        ...data,
        components: {
          mcq: mcqEnabled ?? false,
          word_order: wordOrderEnabled ?? false,
          vocabulary: vocabularyEnabled ?? false,
          ai_tutor: false, // Faza 2
          camera: false,   // Faza 2
        },
      },
    });
  }

  async findByTenant(tenantId: string) {
    return this.prisma.lesson.findMany({
      where: { tenantId },
      orderBy: { orderNumber: 'asc' },
    });
  }

  async findById(id: string, tenantId: string) {
    return this.prisma.lesson.findFirstOrThrow({
      where: { id, tenantId },
      include: { components_data: true },
    });
  }

  async publish(id: string, tenantId: string) {
    return this.prisma.lesson.update({
      where: { id },
      data: { isPublished: true },
    });
  }

  // O'quvchi uchun: keyingi ochiq dars (oldingi tugagan bo'lsa)
  async getNextLesson(studentId: string, tenantId: string) {
    const completed = await this.prisma.studentProgress.findMany({
      where: { studentId, academyCompleted: true },
      select: { lessonId: true },
    });
    const completedIds = completed.map((p) => p.lessonId);

    return this.prisma.lesson.findFirst({
      where: {
        tenantId,
        isPublished: true,
        id: { notIn: completedIds },
      },
      orderBy: { orderNumber: 'asc' },
    });
  }
}
```

- [ ] **Step 5: lessons.controller.ts**

```typescript
import { Controller, Get, Post, Body, Param, Patch, UseGuards, Request } from '@nestjs/common';
import { LessonsService } from './lessons.service';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('lessons')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LessonsController {
  constructor(private lessons: LessonsService) {}

  @Post()
  @Roles('superadmin')
  create(@Body() dto: CreateLessonDto) {
    return this.lessons.create(dto);
  }

  @Get()
  findAll(@Request() req: any) {
    return this.lessons.findByTenant(req.user.tenantId);
  }

  @Get('next')
  @Roles('student')
  getNext(@Request() req: any) {
    return this.lessons.getNextLesson(req.user.userId, req.user.tenantId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req: any) {
    return this.lessons.findById(id, req.user.tenantId);
  }

  @Patch(':id/publish')
  @Roles('superadmin')
  publish(@Param('id') id: string, @Request() req: any) {
    return this.lessons.publish(id, req.user.tenantId);
  }
}
```

- [ ] **Step 6: Test PASS bo'lganini tekshiring**

```bash
npm run test -- lessons.spec
```

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/lessons/
git commit -m "feat: add lessons CRUD API (create, list, publish, next-lesson-for-student)"
```

---

### Task 3: Lesson Components API (MCQ, So'z Tartibi)

**Files:**
- Create: `apps/api/src/lessons/components.service.ts`

- [ ] **Step 1: Failing test**

`apps/api/test/components.spec.ts`:
```typescript
import { ComponentsService } from '../src/lessons/components.service';

describe('ComponentsService', () => {
  const mockPrisma = {
    lessonComponent: {
      createMany: jest.fn().mockResolvedValue({ count: 2 }),
      findMany: jest.fn().mockResolvedValue([
        { type: 'mcq', config: { questions: [] } },
      ]),
    },
  };
  const service = new ComponentsService(mockPrisma as any);

  it('saves MCQ questions for a lesson', async () => {
    await service.setMcq('lesson-id', [
      { text: 'What is "apple"?', options: ['Olma', 'Nok', 'Uzum', 'Limon'], correct: 0 },
    ]);
    expect(mockPrisma.lessonComponent.createMany).toHaveBeenCalled();
  });

  it('returns lesson components', async () => {
    const result = await service.getComponents('lesson-id');
    expect(result).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Ishga tushirib FAIL ko'ring**

```bash
npm run test -- components.spec
```

- [ ] **Step 3: components.service.ts**

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface McqQuestion {
  text: string;
  options: string[];
  correct: number; // options array index
}

interface WordOrderSentence {
  words: string[];    // aralashtirilan so'zlar
  correct: string;    // to'g'ri tartib (masalan: "I am a student")
}

@Injectable()
export class ComponentsService {
  constructor(private prisma: PrismaService) {}

  async setMcq(lessonId: string, questions: McqQuestion[]) {
    await this.prisma.lessonComponent.deleteMany({ where: { lessonId, type: 'mcq' } });
    return this.prisma.lessonComponent.createMany({
      data: [{ lessonId, type: 'mcq', config: { questions } }],
    });
  }

  async setWordOrder(lessonId: string, sentences: WordOrderSentence[]) {
    await this.prisma.lessonComponent.deleteMany({ where: { lessonId, type: 'word_order' } });
    return this.prisma.lessonComponent.createMany({
      data: [{ lessonId, type: 'word_order', config: { sentences } }],
    });
  }

  async setVocabulary(lessonId: string, words: { uzbek: string; english: string }[]) {
    await this.prisma.lessonComponent.deleteMany({ where: { lessonId, type: 'vocabulary' } });
    return this.prisma.lessonComponent.createMany({
      data: [{ lessonId, type: 'vocabulary', config: { words } }],
    });
  }

  async getComponents(lessonId: string) {
    return this.prisma.lessonComponent.findMany({ where: { lessonId } });
  }
}
```

- [ ] **Step 4: Test PASS bo'lganini tekshiring**

```bash
npm run test -- components.spec
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/lessons/components.service.ts
git commit -m "feat: add lesson components service (MCQ, word order, vocabulary)"
```

---

### Task 4: Student Progress API

**Files:**
- Create: `apps/api/src/lesson-progress/progress.service.ts`
- Create: `apps/api/src/lesson-progress/progress.controller.ts`

- [ ] **Step 1: Failing test**

`apps/api/test/progress.spec.ts`:
```typescript
import { ProgressService } from '../src/lesson-progress/progress.service';

describe('ProgressService', () => {
  const mockPrisma = {
    studentProgress: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
    },
    lesson: {
      findFirst: jest.fn(),
    },
    studentLessonConfig: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
  };
  const service = new ProgressService(mockPrisma as any);

  it('increments session count on complete', async () => {
    mockPrisma.lesson.findFirst.mockResolvedValue({
      id: 'lesson-1', nRepetitions: 3, maxNOverride: 10,
    });
    mockPrisma.studentProgress.findUnique.mockResolvedValue({
      sessionCount: 2, homeCompleted: false,
    });
    mockPrisma.studentProgress.upsert.mockResolvedValue({
      sessionCount: 3, homeCompleted: true,
    });

    const result = await service.completeSession('student-id', 'lesson-id', 'tenant-id');
    expect(result.homeCompleted).toBe(true);
  });

  it('uses manager N override when set', async () => {
    mockPrisma.lesson.findFirst.mockResolvedValue({
      id: 'lesson-1', nRepetitions: 3, maxNOverride: 10,
    });
    // Manager N ni 2 ga o'zgartirgan
    mockPrisma.studentLessonConfig.findUnique.mockResolvedValue({ nRepetitionsOverride: 2 });
    mockPrisma.studentProgress.findUnique.mockResolvedValue({
      sessionCount: 1, homeCompleted: false,
    });
    mockPrisma.studentProgress.upsert.mockResolvedValue({
      sessionCount: 2, homeCompleted: true,
    });

    const result = await service.completeSession('student-id', 'lesson-id', 'tenant-id');
    expect(result.homeCompleted).toBe(true); // 2 sessiya = N override 2
  });
});
```

- [ ] **Step 2: Ishga tushirib FAIL ko'ring**

```bash
npm run test -- progress.spec
```

- [ ] **Step 3: progress.service.ts**

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProgressService {
  constructor(private prisma: PrismaService) {}

  private async getEffectiveN(studentId: string, lessonId: string, tenantId: string): Promise<number> {
    const lesson = await this.prisma.lesson.findFirst({
      where: { id: lessonId, tenantId },
    });
    if (!lesson) throw new Error('Dars topilmadi');

    const override = await this.prisma.studentLessonConfig.findUnique({
      where: { studentId_lessonId: { studentId, lessonId } },
    });

    // Manager override bo'lsa, lekin maxNOverride dan katta bo'lmasin
    if (override) {
      return Math.min(override.nRepetitionsOverride, lesson.maxNOverride);
    }
    return lesson.nRepetitions;
  }

  async completeSession(studentId: string, lessonId: string, tenantId: string) {
    const effectiveN = await this.getEffectiveN(studentId, lessonId, tenantId);

    const current = await this.prisma.studentProgress.findUnique({
      where: { studentId_lessonId: { studentId, lessonId } },
    });

    const newCount = (current?.sessionCount ?? 0) + 1;
    const homeCompleted = newCount >= effectiveN;

    return this.prisma.studentProgress.upsert({
      where: { studentId_lessonId: { studentId, lessonId } },
      create: {
        studentId,
        lessonId,
        sessionCount: newCount,
        homeCompleted,
        lastActivityAt: new Date(),
        ...(homeCompleted ? { completedAt: new Date() } : {}),
      },
      update: {
        sessionCount: newCount,
        homeCompleted,
        lastActivityAt: new Date(),
        ...(homeCompleted ? { completedAt: new Date() } : {}),
      },
    });
  }

  async markAcademyCompleted(studentId: string, lessonId: string) {
    return this.prisma.studentProgress.update({
      where: { studentId_lessonId: { studentId, lessonId } },
      data: { academyCompleted: true, completedAt: new Date() },
    });
  }

  async getStudentProgress(studentId: string, tenantId: string) {
    return this.prisma.studentProgress.findMany({
      where: { studentId },
      include: { lesson: { select: { id: true, title: true, orderNumber: true } } },
      orderBy: { lesson: { orderNumber: 'asc' } },
    });
  }
}
```

- [ ] **Step 4: progress.controller.ts**

```typescript
import { Controller, Post, Get, Param, UseGuards, Request } from '@nestjs/common';
import { ProgressService } from './progress.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('progress')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProgressController {
  constructor(private progress: ProgressService) {}

  // O'quvchi sessiyani tugatganda
  @Post(':lessonId/complete-session')
  @Roles('student')
  completeSession(@Param('lessonId') lessonId: string, @Request() req: any) {
    return this.progress.completeSession(req.user.userId, lessonId, req.user.tenantId);
  }

  // Tester/Mentor akademiya qismini tasdiqlaydi
  @Post(':lessonId/complete-academy/:studentId')
  @Roles('tester', 'mentor')
  completeAcademy(@Param('lessonId') lessonId: string, @Param('studentId') studentId: string) {
    return this.progress.markAcademyCompleted(studentId, lessonId);
  }

  // O'quvchining barcha taraqqiyoti
  @Get('my')
  @Roles('student')
  myProgress(@Request() req: any) {
    return this.progress.getStudentProgress(req.user.userId, req.user.tenantId);
  }
}
```

- [ ] **Step 5: Test PASS bo'lganini tekshiring**

```bash
npm run test -- progress.spec
```

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/lesson-progress/
git commit -m "feat: add student progress service with N-repetitions logic and manager override"
```

---

### Task 5: Manager N Override API

**Files:**
- Create: `apps/api/src/student-lesson-config/config.service.ts`
- Create: `apps/api/src/student-lesson-config/config.controller.ts`

- [ ] **Step 1: Failing test**

`apps/api/test/config.spec.ts`:
```typescript
import { ConfigService } from '../src/student-lesson-config/config.service';

describe('ConfigService (N Override)', () => {
  const mockPrisma = {
    lesson: {
      findFirst: jest.fn().mockResolvedValue({ nRepetitions: 3, maxNOverride: 10 }),
    },
    studentLessonConfig: {
      upsert: jest.fn().mockResolvedValue({ nRepetitionsOverride: 5 }),
    },
  };
  const service = new ConfigService(mockPrisma as any);

  it('allows manager to set N override within limits', async () => {
    const result = await service.setNOverride({
      studentId: 's-id', lessonId: 'l-id', tenantId: 't-id',
      managerId: 'm-id', nRepetitions: 5,
    });
    expect(result.nRepetitionsOverride).toBe(5);
  });

  it('blocks N override above maxNOverride', async () => {
    await expect(
      service.setNOverride({
        studentId: 's-id', lessonId: 'l-id', tenantId: 't-id',
        managerId: 'm-id', nRepetitions: 15, // 10 dan katta
      }),
    ).rejects.toThrow('maximal');
  });

  it('blocks N override below 1', async () => {
    await expect(
      service.setNOverride({
        studentId: 's-id', lessonId: 'l-id', tenantId: 't-id',
        managerId: 'm-id', nRepetitions: 0,
      }),
    ).rejects.toThrow('kamida');
  });
});
```

- [ ] **Step 2: Ishga tushirib FAIL ko'ring**

```bash
npm run test -- config.spec
```

- [ ] **Step 3: config.service.ts**

```typescript
import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface SetNOverrideDto {
  studentId: string;
  lessonId: string;
  tenantId: string;
  managerId: string;
  nRepetitions: number;
  reason?: string;
}

@Injectable()
export class ConfigService {
  constructor(private prisma: PrismaService) {}

  async setNOverride(dto: SetNOverrideDto) {
    const lesson = await this.prisma.lesson.findFirst({
      where: { id: dto.lessonId, tenantId: dto.tenantId },
    });
    if (!lesson) throw new BadRequestException('Dars topilmadi');

    if (dto.nRepetitions < 1) {
      throw new BadRequestException('N kamida 1 bo\'lishi kerak');
    }
    if (dto.nRepetitions > lesson.maxNOverride) {
      throw new BadRequestException(
        `N ${lesson.maxNOverride} (maximal) dan oshib ketdi`,
      );
    }

    return this.prisma.studentLessonConfig.upsert({
      where: { studentId_lessonId: { studentId: dto.studentId, lessonId: dto.lessonId } },
      create: {
        studentId: dto.studentId,
        lessonId: dto.lessonId,
        nRepetitionsOverride: dto.nRepetitions,
        changedBy: dto.managerId,
        reason: dto.reason,
      },
      update: {
        nRepetitionsOverride: dto.nRepetitions,
        changedBy: dto.managerId,
        changedAt: new Date(),
        reason: dto.reason,
      },
    });
  }

  async getStudentConfigs(studentId: string) {
    return this.prisma.studentLessonConfig.findMany({
      where: { studentId },
      include: { lesson: { select: { title: true, orderNumber: true } } },
    });
  }
}
```

- [ ] **Step 4: Test PASS bo'lganini tekshiring**

```bash
npm run test -- config.spec
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/student-lesson-config/
git commit -m "feat: add manager N-override service with min/max validation and audit logging"
```

---

### Task 6: YouTube Tezlashtirish Bloki (Frontend)

**Files:**
- Create: `apps/web/app/(dashboard)/student/lessons/[id]/_components/VideoPlayer.tsx`

- [ ] **Step 1: VideoPlayer.tsx yozing**

```typescript
'use client';
import { useEffect, useRef } from 'react';

interface VideoPlayerProps {
  youtubeUrl: string;
  onCompleted: () => void; // >90% ko'rilganda chaqiriladi
}

// YouTube video ID ni URL dan ajratib olish
function extractVideoId(url: string): string | null {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([^?&\s]{11})/);
  return match ? match[1] : null;
}

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

export function VideoPlayer({ youtubeUrl, onCompleted }: VideoPlayerProps) {
  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const watchedRef = useRef(0);  // kuzatilgan foiz
  const completedRef = useRef(false);

  const videoId = extractVideoId(youtubeUrl);

  useEffect(() => {
    if (!videoId) return;

    const initPlayer = () => {
      playerRef.current = new window.YT.Player(containerRef.current!, {
        videoId,
        playerVars: { modestbranding: 1, rel: 0, controls: 1 },
        events: {
          onStateChange: (event: any) => {
            // Tezlashtirish bloki: playbackRate doim 1x bo'lishi kerak
            if (playerRef.current) {
              const rate = playerRef.current.getPlaybackRate();
              if (rate !== 1) {
                playerRef.current.setPlaybackRate(1);
              }
            }
          },
          onReady: (event: any) => {
            // playbackRate ni 1 ga qulflash (har 500ms tekshirish)
            const interval = setInterval(() => {
              if (!playerRef.current) return;
              const state = playerRef.current.getPlayerState();
              const duration = playerRef.current.getDuration();
              const current = playerRef.current.getCurrentTime();

              if (duration > 0) {
                const percent = (current / duration) * 100;
                if (percent > watchedRef.current) watchedRef.current = percent;

                if (watchedRef.current >= 90 && !completedRef.current) {
                  completedRef.current = true;
                  onCompleted();
                }
              }

              if (state === window.YT.PlayerState.PLAYING) {
                const rate = playerRef.current.getPlaybackRate();
                if (rate !== 1) playerRef.current.setPlaybackRate(1);
              }
            }, 500);

            return () => clearInterval(interval);
          },
        },
      });
    };

    // YouTube iframe API yuklash
    if (window.YT && window.YT.Player) {
      initPlayer();
    } else {
      window.onYouTubeIframeAPIReady = initPlayer;
      if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
        const script = document.createElement('script');
        script.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(script);
      }
    }

    return () => {
      if (playerRef.current) playerRef.current.destroy();
    };
  }, [videoId]);

  if (!videoId) {
    return <div className="bg-red-100 p-4 rounded-lg text-red-700">Video URL noto'g'ri</div>;
  }

  return (
    <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden">
      <div ref={containerRef} className="w-full h-full" />
      <div className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
        🔒 Tezlashtirish bloklangan
      </div>
    </div>
  );
}
```

- [ ] **Step 2: VideoPlayer componentini dars sahifasiga qo'shing**

`apps/web/app/(dashboard)/student/lessons/[id]/page.tsx`:
```typescript
'use client';
import { useState } from 'react';
import { VideoPlayer } from './_components/VideoPlayer';

// Mock dars — Plan 2 da API bilan bog'lanadi
const MOCK_LESSON = {
  id: '1',
  title: 'Present Simple',
  youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ', // test uchun
  nRepetitions: 3,
};

type Step = 'video' | 'tests' | 'academy';

export default function LessonPage() {
  const [step, setStep] = useState<Step>('video');
  const [videoCompleted, setVideoCompleted] = useState(false);

  return (
    <div className="max-w-3xl mx-auto py-6 space-y-6">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-bold">{MOCK_LESSON.title}</h1>
      </div>

      {/* Bosqich ko'rsatkichi */}
      <div className="flex gap-2">
        {(['video', 'tests', 'academy'] as Step[]).map((s) => (
          <div
            key={s}
            className={`flex-1 h-2 rounded-full ${
              step === s ? 'bg-indigo-600' :
              (step === 'tests' && s === 'video') || (step === 'academy') ? 'bg-green-400' :
              'bg-gray-200'
            }`}
          />
        ))}
      </div>

      {step === 'video' && (
        <div className="space-y-4">
          <VideoPlayer
            youtubeUrl={MOCK_LESSON.youtubeUrl}
            onCompleted={() => setVideoCompleted(true)}
          />
          {videoCompleted && (
            <button
              onClick={() => setStep('tests')}
              className="w-full bg-indigo-600 text-white py-3 rounded-xl font-medium"
            >
              Davom etish → Testlar
            </button>
          )}
          {!videoCompleted && (
            <p className="text-center text-gray-500 text-sm">
              Davom etish uchun videoni 90% ko'ring
            </p>
          )}
        </div>
      )}

      {step === 'tests' && (
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold text-lg mb-4">Testlar</h2>
          <p className="text-gray-500">MCQ va so'z tartibi testlari Plan 2 Task 7 da qo'shiladi.</p>
          <button
            onClick={() => setStep('academy')}
            className="mt-4 w-full bg-indigo-600 text-white py-3 rounded-xl font-medium"
          >
            Davom etish → Akademiya
          </button>
        </div>
      )}

      {step === 'academy' && (
        <div className="bg-green-50 rounded-xl p-6 text-center">
          <div className="text-4xl mb-2">🎓</div>
          <h2 className="font-bold text-lg">Akademiyaga boring!</h2>
          <p className="text-gray-600">Uy qismi tugadi. Tester siz kelganizda belgilaydi.</p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Dars sahifasini brauzerda tekshiring**

```bash
cd apps/web && npm run dev
```

`http://localhost:3001/student/lessons/1` ga kiring.
- Video yuklanishi kerak
- Tezlashtirish: 2x ga o'rnatsangiz — darhol 1x ga qaytishi kerak (Chrome DevTools → Performance tab da `playbackRate` ni kuzating)

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/(dashboard)/student/
git commit -m "feat: add YouTube video player with speed lock (1x enforced via onStateChange polling)"
```

---

### Task 7: MCQ va So'z Tartibi Test Komponentlari

**Files:**
- Create: `apps/web/app/(dashboard)/student/lessons/[id]/_components/McqTest.tsx`
- Create: `apps/web/app/(dashboard)/student/lessons/[id]/_components/WordOrderTest.tsx`

- [ ] **Step 1: McqTest.tsx**

```typescript
'use client';
import { useState } from 'react';

interface McqQuestion {
  text: string;
  options: string[];
  correct: number;
}

interface McqTestProps {
  questions: McqQuestion[];
  onPassed: () => void;
  onFailed: () => void; // Qaytadan boshlanadi (1-bosqichga)
}

export function McqTest({ questions, onPassed, onFailed }: McqTestProps) {
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [wrongs, setWrongs] = useState(0);

  const q = questions[current];

  function handleAnswer(idx: number) {
    setSelected(idx);
    setShowResult(true);

    if (idx !== q.correct) {
      setWrongs((w) => w + 1);
    }

    setTimeout(() => {
      if (current + 1 < questions.length) {
        setCurrent((c) => c + 1);
        setSelected(null);
        setShowResult(false);
      } else {
        // Barcha savollarga javob berildi
        if (wrongs + (idx !== q.correct ? 1 : 0) === 0) {
          onPassed();
        } else {
          onFailed(); // Xato bor — qaytadan
        }
      }
    }, 1200);
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between text-sm text-gray-500">
        <span>Savol {current + 1} / {questions.length}</span>
        {wrongs > 0 && <span className="text-red-500">{wrongs} ta xato</span>}
      </div>

      <div className="bg-white rounded-xl p-6 shadow-sm">
        <p className="font-semibold text-lg mb-4">{q.text}</p>
        <div className="space-y-2">
          {q.options.map((opt, idx) => (
            <button
              key={idx}
              onClick={() => !showResult && handleAnswer(idx)}
              className={`w-full text-left p-3 rounded-lg border-2 transition-colors ${
                showResult && idx === q.correct ? 'border-green-500 bg-green-50' :
                showResult && idx === selected && idx !== q.correct ? 'border-red-500 bg-red-50' :
                'border-gray-200 hover:border-indigo-300'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: WordOrderTest.tsx**

```typescript
'use client';
import { useState } from 'react';

interface WordOrderTestProps {
  sentences: { words: string[]; correct: string }[];
  onPassed: () => void;
  onFailed: () => void;
}

export function WordOrderTest({ sentences, onPassed, onFailed }: WordOrderTestProps) {
  const [current, setCurrent] = useState(0);
  const [arranged, setArranged] = useState<string[]>([]);
  const [remaining, setRemaining] = useState(() => [...sentences[0].words]);
  const [showResult, setShowResult] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);

  const sentence = sentences[current];

  function addWord(word: string, idx: number) {
    setArranged((prev) => [...prev, word]);
    setRemaining((prev) => prev.filter((_, i) => i !== idx));
  }

  function removeWord(word: string, idx: number) {
    setRemaining((prev) => [...prev, word]);
    setArranged((prev) => prev.filter((_, i) => i !== idx));
  }

  function checkAnswer() {
    const answer = arranged.join(' ');
    const correct = answer === sentence.correct;
    setIsCorrect(correct);
    setShowResult(true);

    setTimeout(() => {
      if (!correct) {
        onFailed();
        return;
      }
      if (current + 1 < sentences.length) {
        setCurrent((c) => c + 1);
        setArranged([]);
        setRemaining([...sentences[current + 1].words]);
        setShowResult(false);
      } else {
        onPassed();
      }
    }, 1500);
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">Savol {current + 1} / {sentences.length}</p>

      {/* Tartiblangan so'zlar */}
      <div className="min-h-12 bg-indigo-50 rounded-xl p-3 flex flex-wrap gap-2">
        {arranged.map((w, i) => (
          <button
            key={i}
            onClick={() => !showResult && removeWord(w, i)}
            className="bg-indigo-600 text-white px-3 py-1 rounded-lg text-sm"
          >
            {w}
          </button>
        ))}
        {arranged.length === 0 && (
          <span className="text-gray-400 text-sm">So'zlarni bosib tartibga soling...</span>
        )}
      </div>

      {/* Mavjud so'zlar */}
      <div className="flex flex-wrap gap-2">
        {remaining.map((w, i) => (
          <button
            key={i}
            onClick={() => !showResult && addWord(w, i)}
            className="bg-white border-2 border-gray-200 px-3 py-1 rounded-lg text-sm hover:border-indigo-400"
          >
            {w}
          </button>
        ))}
      </div>

      {!showResult && arranged.length > 0 && (
        <button
          onClick={checkAnswer}
          className="w-full bg-indigo-600 text-white py-3 rounded-xl font-medium"
        >
          Tekshirish
        </button>
      )}

      {showResult && (
        <div className={`p-3 rounded-xl text-center font-medium ${
          isCorrect ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
        }`}>
          {isCorrect ? '✅ To\'g\'ri!' : '❌ Xato — qaytadan boshlanadi'}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Test komponentlarini brauzerda tekshiring**

Dars sahifasidagi `step === 'tests'` blokini quyidagi bilan almashtiring (test uchun mock data):
```typescript
// Faqat manual test uchun — API bilan bog'lanish Task 8 da
{step === 'tests' && (
  <McqTest
    questions={[
      { text: 'What is "apple" in Uzbek?', options: ['Olma', 'Nok', 'Uzum', 'Limon'], correct: 0 },
      { text: '"She ___ English."', options: ['speak', 'speaks', 'speaking', 'spoke'], correct: 1 },
    ]}
    onPassed={() => setStep('academy')}
    onFailed={() => { setStep('video'); setVideoCompleted(false); }}
  />
)}
```

- Barcha to'g'ri javob → akademiyaga o'tilishi kerak
- Xato javob → video bosqichiga qaytishi kerak

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/(dashboard)/student/lessons/[id]/_components/
git commit -m "feat: add MCQ and word-order test components with pass/fail flow"
```

---

### Task 8: Mentor Guruh Sahifasi

**Files:**
- Create: `apps/web/app/(dashboard)/mentor/group/page.tsx`

- [ ] **Step 1: Mentor Group page.tsx**

```typescript
'use client';
import { useState } from 'react';

// Mock data — API Task 9 da bog'lanadi
const MOCK_STUDENTS = [
  { id: '1', name: 'Sardor Rahimov', status: 'green', attendance: true },
  { id: '2', name: 'Malika Yusupova', status: 'yellow', attendance: false },
  { id: '3', name: 'Jasur Mirzayev', status: 'red', attendance: true },
];

type Status = 'green' | 'yellow' | 'red';

const STATUS_COLORS = {
  green: 'bg-green-100 text-green-700',
  yellow: 'bg-yellow-100 text-yellow-700',
  red: 'bg-red-100 text-red-700',
};

const STATUS_LABELS = { green: '🟢 Yashil', yellow: '🟡 Sariq', red: '🔴 Qizil' };

export default function MentorGroupPage() {
  const [students, setStudents] = useState(MOCK_STUDENTS);
  const [saved, setSaved] = useState(false);

  function updateStatus(id: string, status: Status) {
    setStudents((prev) => prev.map((s) => s.id === id ? { ...s, status } : s));
  }

  function toggleAttendance(id: string) {
    setStudents((prev) => prev.map((s) => s.id === id ? { ...s, attendance: !s.attendance } : s));
  }

  async function saveAll() {
    // TODO: API call — Plan 3 da to'liq amalga oshiriladi
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">5A Guruh</h1>
        <button
          onClick={saveAll}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium"
        >
          {saved ? '✅ Saqlandi' : 'Saqlash'}
        </button>
      </div>

      <div className="space-y-2">
        {students.map((student) => (
          <div key={student.id} className="bg-white rounded-xl p-4 shadow-sm flex items-center gap-4">
            <button
              onClick={() => toggleAttendance(student.id)}
              className={`w-10 h-10 rounded-full border-2 font-bold ${
                student.attendance ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 text-gray-400'
              }`}
            >
              {student.attendance ? '✓' : '✗'}
            </button>

            <div className="flex-1">
              <p className="font-medium">{student.name}</p>
            </div>

            {/* Status tugmalari */}
            <div className="flex gap-1">
              {(['green', 'yellow', 'red'] as Status[]).map((s) => (
                <button
                  key={s}
                  onClick={() => updateStatus(student.id, s)}
                  className={`px-3 py-1 rounded-lg text-sm font-medium transition-all ${
                    student.status === s ? STATUS_COLORS[s] + ' ring-2 ring-offset-1' : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {s === 'green' ? '🟢' : s === 'yellow' ? '🟡' : '🔴'}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Manager qizil/sariq sahifasi**

`apps/web/app/(dashboard)/manager/page.tsx`:
```typescript
export default function ManagerDashboard() {
  // Mock data
  const redStudents = [
    { id: '1', name: 'Sardor Rahimov', note: '3 kun kelmadi', days: 3 },
    { id: '2', name: 'Anvar Karimov', note: 'Status qizil 5 kun', days: 5 },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Manager Paneli</h1>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 bg-red-50 border-b border-red-100">
          <h2 className="font-semibold text-red-700">🔴 Qizil O'quvchilar ({redStudents.length})</h2>
        </div>
        <div className="divide-y">
          {redStudents.map((s) => (
            <div key={s.id} className="p-4 flex items-center justify-between">
              <div>
                <p className="font-medium">{s.name}</p>
                <p className="text-sm text-gray-500">{s.note}</p>
              </div>
              <button className="bg-indigo-600 text-white px-3 py-1 rounded-lg text-sm">
                1:1 Sessiya
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Brauzerda tekshiring**

`http://localhost:3001/mentor/group` — o'quvchilar ro'yxati, davomat tugmalari, status o'zgartirish ko'rinishi kerak.
`http://localhost:3001/manager` — qizil o'quvchilar ro'yxati ko'rinishi kerak.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/(dashboard)/mentor/ apps/web/app/(dashboard)/manager/
git commit -m "feat: add mentor group page (attendance + status) and manager red-students dashboard"
```

---

## Self-Review

**Spec Coverage:**
- ✅ Superadmin dars yaratish (video URL, MCQ, so'z tartibi, N repetition, maxNOverride)
- ✅ O'quvchi dars jarayoni: video (>90% ko'rilishi kerak) → testlar → akademiya
- ✅ YouTube tezlashtirish bloki (playbackRate polling, 500ms interval)
- ✅ N sessiya logikasi (effectiveN = override ?? lesson default, max bounded)
- ✅ Manager N override (min 1, max maxNOverride, log saqlanadi)
- ✅ MCQ test (xato → video ga qaytish)
- ✅ So'z tartibi test (xato → video ga qaytish)
- ✅ Mentor guruh sahifasi (davomat + status berish stub)
- ✅ Manager qizil/sariq ro'yxat stub

**Faza 2 komponentlari:** AI Tutor, Azure talaffuz, MediaPipe kamera — schema da bor, UI da "Tez kunda" ko'rsatiladi. Plan 4 da amalga oshiriladi.

**Type consistency:** `McqQuestion`, `WordOrderSentence` — service va frontend da bir xil struktura.
