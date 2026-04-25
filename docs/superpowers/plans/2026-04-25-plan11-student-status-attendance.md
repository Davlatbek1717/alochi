# Plan 11: Student Status & Attendance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete student status and attendance modules — add `getRedStudents` backend endpoint, write missing unit tests for both modules, connect real status API on the student dashboard, and fix the two existing attendance pages (mentor + filadmin) that currently use mocks or wrong field names.

**Architecture:** Backend-first TDD approach: write failing tests, implement service additions, then connect frontend. All API calls use the existing `apiRequest` helper from `@/lib/api`. Both attendance frontend pages already exist but have bugs (MOCK_STUDENTS, wrong field names); they will be rewritten.

**Tech Stack:** NestJS 10, Prisma 5, Jest (backend); Next.js 15 App Router, TypeScript, Tailwind CSS (frontend); pnpm monorepo

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `apps/api/src/student-status/status.service.ts` | Add `getRedStudents(tenantId)` method |
| Modify | `apps/api/src/student-status/status.controller.ts` | Expose `GET /status/red-students` and `GET /status/history/:studentId` |
| Create | `apps/api/src/student-status/status.spec.ts` | Unit tests for all StatusService methods |
| Create | `apps/api/src/attendance/attendance.spec.ts` | Unit tests for both attendance services |
| Modify | `apps/web/app/(dashboard)/student/page.tsx` | Connect `GET /status/my` → replace hardcoded `⚪` dots |
| Rewrite | `apps/web/app/(dashboard)/mentor/attendance/page.tsx` | Replace MOCK_STUDENTS with real API, default `'present'` |
| Rewrite | `apps/web/app/(dashboard)/filadmin/attendance/page.tsx` | Fix branchId source (JWT not localStorage), fix field name mismatch |

---

## Task 1: StatusService — getRedStudents + controller endpoints (TDD)

**Files:**
- Modify: `apps/api/src/student-status/status.service.ts`
- Modify: `apps/api/src/student-status/status.controller.ts`
- Create: `apps/api/src/student-status/status.spec.ts`

### Context

Current `status.service.ts` has `setStatus`, `getLatest`, `getHistory` (lines 20–60). It does NOT have `getRedStudents`. The controller (lines 1–50) has `POST /status`, `GET /status/my`, `GET /status/:studentId` — but no history or red-students endpoints.

### Step 1: Write status.spec.ts (failing for getRedStudents)

Create `apps/api/src/student-status/status.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { StatusService } from './status.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  studentStatus: {
    upsert: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
  },
};

describe('StatusService', () => {
  let service: StatusService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        StatusService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get(StatusService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('setStatus', () => {
    it('upserts a status record and returns it', async () => {
      const record = {
        id: 's1',
        studentId: 'u1',
        date: new Date('2026-04-25'),
        englishStatus: 'yashil',
        personalStatus: null,
        criticalStatus: null,
      };
      mockPrisma.studentStatus.upsert.mockResolvedValue(record);

      const result = await service.setStatus({
        tenantId: 't1',
        studentId: 'u1',
        date: '2026-04-25',
        englishStatus: 'yashil',
      });

      expect(mockPrisma.studentStatus.upsert).toHaveBeenCalledTimes(1);
      expect(result.englishStatus).toBe('yashil');
    });
  });

  describe('getLatest', () => {
    it('returns the most recent status record for a student', async () => {
      const record = {
        id: 's1',
        studentId: 'u1',
        date: new Date('2026-04-25'),
        criticalStatus: 'qizil',
      };
      mockPrisma.studentStatus.findFirst.mockResolvedValue(record);

      const result = await service.getLatest('u1');

      expect(mockPrisma.studentStatus.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { studentId: 'u1' },
          orderBy: { date: 'desc' },
        }),
      );
      expect(result?.criticalStatus).toBe('qizil');
    });

    it('returns null when student has no status records', async () => {
      mockPrisma.studentStatus.findFirst.mockResolvedValue(null);

      const result = await service.getLatest('u-none');

      expect(result).toBeNull();
    });
  });

  describe('getHistory', () => {
    it('returns up to 30 status records ordered by date desc', async () => {
      const records = Array.from({ length: 5 }, (_, i) => ({
        id: `s${i}`,
        studentId: 'u1',
        date: new Date(),
      }));
      mockPrisma.studentStatus.findMany.mockResolvedValue(records);

      const result = await service.getHistory('u1');

      expect(mockPrisma.studentStatus.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { studentId: 'u1' },
          take: 30,
        }),
      );
      expect(result).toHaveLength(5);
    });
  });

  describe('getRedStudents', () => {
    it('returns students whose latest record has at least one qizil status', async () => {
      const redStudents = [
        {
          id: 's1',
          studentId: 'u1',
          criticalStatus: 'qizil',
          englishStatus: 'yashil',
          personalStatus: 'sariq',
          student: { id: 'u1', name: 'Ali Valiyev' },
        },
      ];
      mockPrisma.studentStatus.findMany.mockResolvedValue(redStudents);

      const result = await service.getRedStudents('t1');

      expect(mockPrisma.studentStatus.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            student: { tenantId: 't1' },
            OR: expect.arrayContaining([
              { englishStatus: 'qizil' },
              { personalStatus: 'qizil' },
              { criticalStatus: 'qizil' },
            ]),
          }),
          distinct: ['studentId'],
        }),
      );
      expect(result).toHaveLength(1);
      expect(result[0].student.name).toBe('Ali Valiyev');
    });

    it('returns empty array when no students have qizil status', async () => {
      mockPrisma.studentStatus.findMany.mockResolvedValue([]);

      const result = await service.getRedStudents('t1');

      expect(result).toHaveLength(0);
    });
  });
});
```

### Step 2: Run tests — verify getRedStudents fails

```bash
cd apps/api && npx jest src/student-status/status.spec.ts --no-coverage
```

Expected: `getRedStudents` tests FAIL with `TypeError: service.getRedStudents is not a function`. Other tests pass.

### Step 3: Add getRedStudents to StatusService

Replace the entire `apps/api/src/student-status/status.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface SetStatusDto {
  tenantId: string;
  studentId: string;
  date: string;
  englishStatus?: string;
  englishNote?: string;
  personalStatus?: string;
  personalNote?: string;
  criticalStatus?: string;
  criticalNote?: string;
}

@Injectable()
export class StatusService {
  constructor(private prisma: PrismaService) {}

  async setStatus(dto: SetStatusDto) {
    const { studentId, date, englishStatus, englishNote, personalStatus, personalNote, criticalStatus, criticalNote } = dto;
    const dateObj = new Date(date);

    return this.prisma.studentStatus.upsert({
      where: { studentId_date: { studentId, date: dateObj } },
      create: {
        studentId,
        date: dateObj,
        englishStatus,
        englishNote,
        personalStatus,
        personalNote,
        criticalStatus,
        criticalNote,
      },
      update: {
        englishStatus,
        englishNote,
        personalStatus,
        personalNote,
        criticalStatus,
        criticalNote,
      },
    });
  }

  async getLatest(studentId: string) {
    return this.prisma.studentStatus.findFirst({
      where: { studentId },
      orderBy: { date: 'desc' },
    });
  }

  async getHistory(studentId: string, limit = 30) {
    return this.prisma.studentStatus.findMany({
      where: { studentId },
      orderBy: { date: 'desc' },
      take: limit,
    });
  }

  async getRedStudents(tenantId: string) {
    return this.prisma.studentStatus.findMany({
      where: {
        student: { tenantId },
        OR: [
          { englishStatus: 'qizil' },
          { personalStatus: 'qizil' },
          { criticalStatus: 'qizil' },
        ],
      },
      orderBy: { date: 'desc' },
      distinct: ['studentId'],
      include: {
        student: { select: { id: true, name: true } },
      },
    });
  }
}
```

### Step 4: Run tests — verify all pass

```bash
cd apps/api && npx jest src/student-status/status.spec.ts --no-coverage
```

Expected: 6 tests pass, 0 fail.

### Step 5: Add endpoints to StatusController

Replace `apps/api/src/student-status/status.controller.ts`:

```typescript
import { Controller, Post, Get, Body, Param, UseGuards, Request } from '@nestjs/common';
import { StatusService } from './status.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

interface AuthRequest extends Request {
  user: {
    userId: string;
    tenantId: string;
    role: UserRole;
  };
}

@ApiTags('student-status')
@ApiBearerAuth()
@Controller('status')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StatusController {
  constructor(private statusService: StatusService) {}

  @Post()
  @Roles(UserRole.mentor, UserRole.manager)
  setStatus(
    @Body()
    body: {
      studentId: string;
      date: string;
      englishStatus?: string;
      englishNote?: string;
      personalStatus?: string;
      personalNote?: string;
      criticalStatus?: string;
      criticalNote?: string;
    },
    @Request() req: AuthRequest,
  ) {
    return this.statusService.setStatus({ ...body, tenantId: req.user.tenantId });
  }

  @Get('my')
  @Roles(UserRole.student)
  getMyStatus(@Request() req: AuthRequest) {
    return this.statusService.getLatest(req.user.userId);
  }

  @Get('red-students')
  @Roles(UserRole.mentor, UserRole.manager, UserRole.filadmin)
  getRedStudents(@Request() req: AuthRequest) {
    return this.statusService.getRedStudents(req.user.tenantId);
  }

  @Get('history/:studentId')
  @Roles(UserRole.mentor, UserRole.manager, UserRole.filadmin)
  getHistory(@Param('studentId') studentId: string) {
    return this.statusService.getHistory(studentId);
  }

  @Get(':studentId')
  @Roles(UserRole.mentor, UserRole.manager, UserRole.filadmin)
  getStudentStatus(@Param('studentId') studentId: string) {
    return this.statusService.getLatest(studentId);
  }
}
```

**Important:** `GET /status/red-students` MUST be defined before `GET /status/:studentId` in the file — otherwise NestJS will treat `red-students` as a `:studentId` param value.

### Step 6: TypeScript check

```bash
cd apps/api && npx tsc --noEmit
```

Expected: 0 errors.

### Step 7: Commit

```bash
git add apps/api/src/student-status/status.service.ts \
        apps/api/src/student-status/status.controller.ts \
        apps/api/src/student-status/status.spec.ts
git commit -m "feat: add getRedStudents endpoint + unit tests for StatusService"
```

---

## Task 2: Attendance Unit Tests

**Files:**
- Create: `apps/api/src/attendance/attendance.spec.ts`

### Context

`AttendanceStudentsService` (attendance-students.service.ts) has `markBulk` and `getDailyList`. `AttendanceStaffService` (attendance-staff.service.ts) has `checkIn`, `confirm`, `getDailyStaff`. No tests exist. The services are fully implemented — tests should pass immediately.

### Step 1: Create attendance.spec.ts

Create `apps/api/src/attendance/attendance.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { AttendanceStudentsService } from './attendance-students.service';
import { AttendanceStaffService } from './attendance-staff.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrismaStudents = {
  attendanceStudent: {
    upsert: jest.fn(),
    findMany: jest.fn(),
  },
};

const mockPrismaStaff = {
  attendanceStaff: {
    upsert: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
  },
};

describe('AttendanceStudentsService', () => {
  let service: AttendanceStudentsService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AttendanceStudentsService,
        { provide: PrismaService, useValue: mockPrismaStudents },
      ],
    }).compile();
    service = module.get(AttendanceStudentsService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('markBulk', () => {
    it('upserts one record per student and returns results array', async () => {
      const records = [
        { studentId: 'u1', status: 'present', tenantId: 't1', branchId: 'b1', date: '2026-04-25' },
        { studentId: 'u2', status: 'absent', tenantId: 't1', branchId: 'b1', date: '2026-04-25' },
      ];
      mockPrismaStudents.attendanceStudent.upsert
        .mockResolvedValueOnce({ id: 'a1', studentId: 'u1', status: 'present' })
        .mockResolvedValueOnce({ id: 'a2', studentId: 'u2', status: 'absent' });

      const result = await service.markBulk(records);

      expect(mockPrismaStudents.attendanceStudent.upsert).toHaveBeenCalledTimes(2);
      expect(result).toHaveLength(2);
      expect(result[0].status).toBe('present');
      expect(result[1].status).toBe('absent');
    });

    it('returns empty array when given empty records list', async () => {
      const result = await service.markBulk([]);

      expect(mockPrismaStudents.attendanceStudent.upsert).not.toHaveBeenCalled();
      expect(result).toHaveLength(0);
    });
  });

  describe('getDailyList', () => {
    it('returns attendance records filtered by branchId and date', async () => {
      const attendance = [
        {
          id: 'a1',
          studentId: 'u1',
          status: 'present',
          student: { id: 'u1', name: 'Ali Valiyev' },
        },
      ];
      mockPrismaStudents.attendanceStudent.findMany.mockResolvedValue(attendance);

      const result = await service.getDailyList('b1', '2026-04-25');

      expect(mockPrismaStudents.attendanceStudent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { branchId: 'b1', date: new Date('2026-04-25') },
        }),
      );
      expect(result).toHaveLength(1);
      expect(result[0].student.name).toBe('Ali Valiyev');
    });
  });
});

describe('AttendanceStaffService', () => {
  let service: AttendanceStaffService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AttendanceStaffService,
        { provide: PrismaService, useValue: mockPrismaStaff },
      ],
    }).compile();
    service = module.get(AttendanceStaffService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('checkIn', () => {
    it('marks isLate true when checking in after 09:00 UTC', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-04-25T09:30:00Z'));
      mockPrismaStaff.attendanceStaff.upsert.mockResolvedValue({
        id: 'att1',
        userId: 'u1',
        isLate: true,
        loginTime: new Date('2026-04-25T09:30:00Z'),
      });

      const result = await service.checkIn('u1', 't1', 'b1', 'manual');

      expect(result.isLate).toBe(true);
      jest.useRealTimers();
    });

    it('marks isLate false when checking in before 09:00 UTC', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-04-25T08:00:00Z'));
      mockPrismaStaff.attendanceStaff.upsert.mockResolvedValue({
        id: 'att2',
        userId: 'u1',
        isLate: false,
        loginTime: new Date('2026-04-25T08:00:00Z'),
      });

      const result = await service.checkIn('u1', 't1', 'b1', 'face_id');

      expect(result.isLate).toBe(false);
      jest.useRealTimers();
    });
  });

  describe('confirm', () => {
    it('updates confirmedAt and confirmedBy for the given userId and date', async () => {
      const confirmedAt = new Date('2026-04-25T09:05:00Z');
      mockPrismaStaff.attendanceStaff.update.mockResolvedValue({
        id: 'att1',
        userId: 'u1',
        confirmedAt,
        confirmedBy: 'admin1',
      });

      const result = await service.confirm('u1', 'admin1', '2026-04-25');

      expect(mockPrismaStaff.attendanceStaff.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId_date: { userId: 'u1', date: new Date('2026-04-25') } },
          data: expect.objectContaining({ confirmedBy: 'admin1' }),
        }),
      );
      expect(result.confirmedBy).toBe('admin1');
      expect(result.confirmedAt).toEqual(confirmedAt);
    });
  });
});
```

### Step 2: Run tests — verify all pass

```bash
cd apps/api && npx jest src/attendance/attendance.spec.ts --no-coverage
```

Expected: 5 tests pass, 0 fail. (Services are already implemented correctly.)

### Step 3: Commit

```bash
git add apps/api/src/attendance/attendance.spec.ts
git commit -m "test: add unit tests for AttendanceStudentsService and AttendanceStaffService"
```

---

## Task 3: Frontend — Student Dashboard Status Connection

**Files:**
- Modify: `apps/web/app/(dashboard)/student/page.tsx`

### Context

Current file (line 51–57) has a `Promise.all` with 5 calls. Lines 98–108 have a status grid with hardcoded `⚪`. Need to add a 6th API call and replace the emoji.

### Step 1: Add StatusData type and state

Open `apps/web/app/(dashboard)/student/page.tsx`.

After the `CityData` type (line 35), add:

```typescript
type StatusData = {
  englishStatus?: string;
  personalStatus?: string;
  criticalStatus?: string;
};
```

After `const [loading, setLoading] = useState(true);` (line 44), add:

```typescript
const [statusData, setStatusData] = useState<StatusData | null>(null);
```

### Step 2: Add STATUS_COLOR constant

After the `useEffect` opening (before `async function fetchData`), add:

```typescript
const STATUS_COLOR: Record<string, string> = {
  yashil: '🟢',
  sariq: '🟡',
  qizil: '🔴',
  '': '⚪',
};
```

### Step 3: Extend Promise.all with status call

Replace the destructuring line (currently line 51):

```typescript
const [xpRes, questsRes, cityRes, streakRes, progressRes] = await Promise.all([
```

With:

```typescript
const [xpRes, questsRes, cityRes, streakRes, progressRes, statusRes] = await Promise.all([
```

After `apiRequest<unknown[]>('/progress/my', {}, token),` add:

```typescript
  apiRequest<StatusData>('/status/my', {}, token).catch(() => ({ data: null as StatusData | null })),
```

After `setLessonProgress(progressRes.data.length);` add:

```typescript
setStatusData(statusRes.data);
```

### Step 4: Replace hardcoded status grid

Replace lines 98–108 (the `grid grid-cols-3` section):

```tsx
<div className="grid grid-cols-3 gap-3">
  {[
    { label: 'Ingliz tili', field: 'englishStatus' as const },
    { label: 'Shaxsiy', field: 'personalStatus' as const },
    { label: 'Tanqidiy', field: 'criticalStatus' as const },
  ].map((s) => (
    <div key={s.field} className="bg-white rounded-xl p-3 text-center shadow-sm">
      <p className="text-2xl">
        {STATUS_COLOR[statusData?.[s.field] ?? ''] ?? '⚪'}
      </p>
      <p className="text-xs text-gray-500 mt-1">{s.label}</p>
    </div>
  ))}
</div>
```

### Step 5: TypeScript check

```bash
cd apps/web && npx tsc --noEmit
```

Expected: 0 errors.

### Step 6: Commit

```bash
git add apps/web/app/\(dashboard\)/student/page.tsx
git commit -m "feat: connect GET /status/my to student dashboard status dots"
```

---

## Task 4: Frontend — Mentor Attendance Page (Replace Mock with Real API)

**Files:**
- Rewrite: `apps/web/app/(dashboard)/mentor/attendance/page.tsx`

### Context

Current page uses hardcoded `MOCK_STUDENTS` (line 16–20). Default status is `null` — should be `'present'`. No JWT-based groupId. Needs full replacement.

### Step 1: Replace the entire file

Write `apps/web/app/(dashboard)/mentor/attendance/page.tsx`:

```typescript
'use client';
import { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '@/lib/api';

type AttendanceStatus = 'present' | 'absent' | 'late';

type ApiStudent = {
  id: string;
  name: string;
};

type StudentRow = {
  id: string;
  name: string;
  status: AttendanceStatus;
};

function getGroupIdFromToken(): string | null {
  try {
    const token = localStorage.getItem('accessToken') ?? '';
    const payload = JSON.parse(atob(token.split('.')[1])) as { groupId?: string };
    return typeof payload.groupId === 'string' ? payload.groupId : null;
  } catch {
    return null;
  }
}

const TODAY = new Date().toISOString().split('T')[0];

const STATUS_CONFIG: {
  status: AttendanceStatus;
  label: string;
  active: string;
  inactive: string;
}[] = [
  {
    status: 'present',
    label: '✅ Keldi',
    active: 'bg-green-500 text-white',
    inactive: 'bg-gray-100 text-gray-500',
  },
  {
    status: 'absent',
    label: '❌ Kelmadi',
    active: 'bg-red-500 text-white',
    inactive: 'bg-gray-100 text-gray-500',
  },
  {
    status: 'late',
    label: '⏰ Kechikdi',
    active: 'bg-yellow-500 text-white',
    inactive: 'bg-gray-100 text-gray-500',
  },
];

export default function MentorAttendancePage() {
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');

  const loadStudents = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('accessToken') ?? '';
      const groupId = getGroupIdFromToken();
      if (!groupId) throw new Error("Guruh topilmadi. Administrator bilan bog'laning.");
      const res = await apiRequest<ApiStudent[]>(`/users/group/${groupId}`, {}, token);
      setStudents(res.data.map((s) => ({ ...s, status: 'present' as AttendanceStatus })));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Yuklab bo'lmadi");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  function setStatus(id: string, status: AttendanceStatus) {
    setStudents((prev) => prev.map((s) => (s.id === id ? { ...s, status } : s)));
  }

  async function saveAttendance() {
    setSaving(true);
    setSaveError('');
    try {
      const token = localStorage.getItem('accessToken') ?? '';
      await apiRequest(
        '/attendance/students/bulk',
        {
          method: 'POST',
          body: JSON.stringify({
            date: TODAY,
            records: students.map(({ id, status }) => ({ studentId: id, status })),
          }),
        },
        token,
      );
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Saqlashda xatolik');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4 max-w-2xl">
        <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="bg-white rounded-xl p-4 h-16 animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4 max-w-2xl">
        <h1 className="text-2xl font-bold text-gray-900">Bugungi Davomat</h1>
        <div className="bg-white rounded-xl p-6 text-center shadow-sm">
          <p className="text-red-500 mb-3">{error}</p>
          <button
            onClick={loadStudents}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium"
          >
            Qayta urinish
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bugungi Davomat</h1>
          <p className="text-gray-500 mt-1">{TODAY}</p>
        </div>
        <button
          onClick={saveAttendance}
          disabled={saving}
          className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {saving ? (
            <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : saved ? (
            '✅ Saqlandi'
          ) : (
            'Saqlash'
          )}
        </button>
      </div>

      {saveError && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">{saveError}</div>
      )}

      <div className="space-y-3">
        {students.map((student) => (
          <div
            key={student.id}
            className="bg-white rounded-xl shadow-sm px-5 py-4 flex items-center justify-between"
          >
            <span className="font-medium text-gray-900">{student.name}</span>
            <div className="flex gap-2">
              {STATUS_CONFIG.map(({ status, label, active, inactive }) => (
                <button
                  key={status}
                  onClick={() => setStatus(student.id, status)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium min-h-[44px] transition-colors ${
                    student.status === status ? active : inactive
                  }`}
                >
                  {label}
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

### Step 2: TypeScript check

```bash
cd apps/web && npx tsc --noEmit
```

Expected: 0 errors.

### Step 3: Commit

```bash
git add apps/web/app/\(dashboard\)/mentor/attendance/page.tsx
git commit -m "feat: replace mock students with real API in mentor attendance page"
```

---

## Task 5: Frontend — Filadmin Attendance Page (Fix Field Names + BranchId Source)

**Files:**
- Rewrite: `apps/web/app/(dashboard)/filadmin/attendance/page.tsx`

### Context

Current page has two bugs:
1. `branchId` read from `localStorage.getItem('user').tenantId` — wrong; `tenantId ≠ branchId`. Must come from JWT `payload.branchId`.
2. Type uses `arrivalTime` and `isConfirmed: boolean` — but the API returns `loginTime: string | null` and `confirmedAt: string | null` (from `attendance-staff.service.ts`). This causes silent runtime rendering failures.

### Step 1: Replace the entire file

Write `apps/web/app/(dashboard)/filadmin/attendance/page.tsx`:

```typescript
'use client';
import { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '@/lib/api';

type StaffRecord = {
  id: string;
  userId: string;
  loginTime: string | null;
  isLate: boolean;
  recognitionMethod: string | null;
  confirmedAt: string | null;
  confirmedBy: string | null;
  user: { id: string; name: string };
};

function getBranchIdFromToken(): string | null {
  try {
    const token = localStorage.getItem('accessToken') ?? '';
    const payload = JSON.parse(atob(token.split('.')[1])) as { branchId?: string };
    return typeof payload.branchId === 'string' ? payload.branchId : null;
  } catch {
    return null;
  }
}

function formatTime(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '—';
  }
}

const TODAY = new Date().toISOString().split('T')[0];

export default function FiladminAttendancePage() {
  const [date, setDate] = useState(TODAY);
  const [records, setRecords] = useState<StaffRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState<string | null>(null);

  const branchId = getBranchIdFromToken();

  const loadRecords = useCallback(
    async (selectedDate: string) => {
      if (!branchId) return;
      setLoading(true);
      setError('');
      try {
        const token = localStorage.getItem('accessToken') ?? '';
        const res = await apiRequest<StaffRecord[]>(
          `/attendance/staff/${branchId}/${selectedDate}`,
          {},
          token,
        );
        setRecords(res.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Yuklab bo'lmadi");
      } finally {
        setLoading(false);
      }
    },
    [branchId],
  );

  useEffect(() => {
    loadRecords(date);
  }, [date, loadRecords]);

  async function confirmStaff(userId: string) {
    setConfirming(userId);
    try {
      const token = localStorage.getItem('accessToken') ?? '';
      await apiRequest(
        `/attendance/staff/confirm/${userId}`,
        { method: 'POST', body: JSON.stringify({ date }) },
        token,
      );
      setRecords((prev) =>
        prev.map((r) =>
          r.userId === userId ? { ...r, confirmedAt: new Date().toISOString() } : r,
        ),
      );
    } catch {
      // User can retry by clicking the button again
    } finally {
      setConfirming(null);
    }
  }

  if (!branchId) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">Xodimlar Davomati</h1>
        <div className="bg-white rounded-xl p-6 text-center shadow-sm">
          <p className="text-red-500">Filial topilmadi. Administrator bilan bog&#39;laning.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Xodimlar Davomati</h1>
        <input
          type="date"
          value={date}
          max={TODAY}
          onChange={(e) => setDate(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={() => loadRecords(date)}
            className="ml-4 underline text-sm font-medium"
          >
            Qayta urinish
          </button>
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['Xodim', 'Kirish vaqti', 'Usul', 'Kechikdi', 'Tasdiqlangan'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3, 4, 5].map((i) => (
                <tr key={i} className="border-t border-gray-100">
                  {[1, 2, 3, 4, 5].map((j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4" />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : records.length === 0 && !error ? (
        <div className="bg-white rounded-xl p-10 text-center text-gray-500 shadow-sm">
          <p className="text-4xl mb-2">📋</p>
          <p className="font-medium">Bu kun uchun davomat yo&apos;q</p>
        </div>
      ) : !error ? (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['Xodim', 'Kirish vaqti', 'Usul', 'Kechikdi', 'Tasdiqlangan'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {records.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{r.user.name}</td>
                  <td className="px-4 py-3 text-gray-600">{formatTime(r.loginTime)}</td>
                  <td className="px-4 py-3">
                    {r.recognitionMethod === 'face_id' ? (
                      <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-xs px-2 py-1 rounded-full font-medium">
                        📷 Face ID
                      </span>
                    ) : r.recognitionMethod === 'manual' ? (
                      <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded-full font-medium">
                        ✍️ Qo&apos;lda
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {r.loginTime && r.isLate ? (
                      <span className="text-red-600 font-medium">🔴 Kech</span>
                    ) : r.loginTime ? (
                      <span className="text-green-600 font-medium">🟢 O&apos;z vaqtida</span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {!r.loginTime ? (
                      <span className="text-gray-400">Kelmagan</span>
                    ) : r.confirmedAt ? (
                      <span className="text-green-600 font-medium">
                        ✓ {formatTime(r.confirmedAt)}
                      </span>
                    ) : (
                      <button
                        onClick={() => confirmStaff(r.userId)}
                        disabled={confirming === r.userId}
                        className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
                      >
                        {confirming === r.userId ? '...' : 'Tasdiqlash'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
```

### Step 2: TypeScript check

```bash
cd apps/web && npx tsc --noEmit
```

Expected: 0 errors.

### Step 3: Run all backend tests to confirm nothing broken

```bash
cd apps/api && npx jest --no-coverage
```

Expected: All tests pass.

### Step 4: Commit

```bash
git add apps/web/app/\(dashboard\)/filadmin/attendance/page.tsx
git commit -m "fix: filadmin attendance — use branchId from JWT, fix loginTime/confirmedAt field names"
```

---

## Final Verification

```bash
# Backend: all tests
cd apps/api && npx jest --no-coverage

# Frontend: TypeScript
cd apps/web && npx tsc --noEmit
```

Expected:
- All backend tests pass (including 6 new status tests + 5 new attendance tests)
- 0 TypeScript errors in web
