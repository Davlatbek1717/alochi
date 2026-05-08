# Groups Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Groups feature end-to-end — Prisma model, migration with backfill, NestJS CRUD module, and React management UI for filadmin and superadmin — so admins can create/edit/delete named groups and assign students + mentors to them.

**Architecture:** The existing `User.groupId String?` column is kept as an unconstrained UUID (no FK added) to avoid breaking existing rows; the new `groups` table is authoritative, and service-layer queries JOIN manually. The NestJS `GroupsModule` is a standard module (PrismaModule import, service + controller providers, exported service). Frontend pages mirror the existing filadmin/superadmin patterns: dark header, card grid, `Modal` for create/edit, `useFocusRevalidate` for refresh.

**Tech Stack:** NestJS + Prisma (PostgreSQL), Next.js 14 App Router, TypeScript, Tailwind CSS, Lucide icons. No new dependencies.

---

## File Map

### Created — Backend
- `prisma/migrations/0056_add_groups/migration.sql` — DDL + backfill
- `apps/api/src/groups/groups.module.ts`
- `apps/api/src/groups/groups.service.ts`
- `apps/api/src/groups/groups.controller.ts`

### Modified — Backend
- `prisma/schema.prisma` — add `Group` model + back-relations on `Tenant` and `Branch`
- `apps/api/src/app.module.ts` — register `GroupsModule`

### Created — Frontend
- `apps/web/app/(dashboard)/filadmin/groups/page.tsx`
- `apps/web/app/(dashboard)/superadmin/groups/page.tsx`

### Modified — Frontend
- `apps/web/app/(dashboard)/superadmin/users/page.tsx` — add group selector to edit modal
- `apps/web/app/(dashboard)/_components/TopNav.tsx` — add Guruhlar nav entries
- `apps/web/app/(dashboard)/mentor/page.tsx` — enhance groupError banner CTA
- `apps/web/app/(dashboard)/mentor/group/page.tsx` — enhance groupError banner CTA

---

## Task 1: Prisma schema — add Group model

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add Group model and back-relations**

Open `prisma/schema.prisma`. After the `Branch` model block (line ~92), add:

```prisma
model Group {
  id        String   @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  tenantId  String   @map("tenant_id") @db.Uuid
  branchId  String   @map("branch_id") @db.Uuid
  name      String
  mentorId  String?  @map("mentor_id") @db.Uuid
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  branch Branch @relation(fields: [branchId], references: [id], onDelete: Cascade)

  @@unique([branchId, name])
  @@index([tenantId, branchId])
  @@map("groups")
}
```

In the `Tenant` model, add after the existing `branches Branch[]` line:
```prisma
  groups   Group[]
```

In the `Branch` model, add after the existing `users User[]` line:
```prisma
  groups   Group[]
```

- [ ] **Step 2: Verify Prisma format**

```bash
cd D:/projects/alochi && pnpm --filter api exec prisma format
```

Expected: exits 0, possibly reformats whitespace. No type errors.

---

## Task 2: Migration SQL

**Files:**
- Create: `prisma/migrations/0056_add_groups/migration.sql`

- [ ] **Step 1: Create migration directory**

```bash
mkdir D:/projects/alochi/prisma/migrations/0056_add_groups
```

- [ ] **Step 2: Write migration.sql**

Create `prisma/migrations/0056_add_groups/migration.sql` with this exact content:

```sql
-- CreateTable groups
CREATE TABLE groups (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id   uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  name        text NOT NULL,
  mentor_id   uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (branch_id, name)
);

CREATE INDEX ON groups (tenant_id, branch_id);

-- Backfill: every distinct group_id currently used in users becomes
-- a Group row. Rows with no branch are skipped (orphaned group IDs).
-- Mentor is the first mentor-role user who already has that group_id.
INSERT INTO groups (id, tenant_id, branch_id, name, mentor_id)
SELECT
  gid,
  (SELECT tenant_id FROM users WHERE group_id = gid LIMIT 1) AS tenant_id,
  (SELECT branch_id FROM users WHERE group_id = gid AND branch_id IS NOT NULL LIMIT 1) AS branch_id,
  'Guruh ' || ROW_NUMBER() OVER (
    PARTITION BY (SELECT branch_id FROM users WHERE group_id = gid AND branch_id IS NOT NULL LIMIT 1)
    ORDER BY gid
  ) AS name,
  (SELECT id FROM users WHERE group_id = gid AND role = 'mentor' LIMIT 1) AS mentor_id
FROM (SELECT DISTINCT group_id AS gid FROM users WHERE group_id IS NOT NULL) g
WHERE (SELECT branch_id FROM users WHERE group_id = gid AND branch_id IS NOT NULL LIMIT 1) IS NOT NULL;
```

---

## Task 3: GroupsService

**Files:**
- Create: `apps/api/src/groups/groups.service.ts`

- [ ] **Step 1: Create the service file**

Create `apps/api/src/groups/groups.service.ts`:

```typescript
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GroupsService {
  constructor(
    private prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cache: Cache,
  ) {}

  // ── invalidate marketing student cache after group changes ──────────
  private async invalidateStudentCache() {
    await Promise.all([
      this.cache.del('mc:students:50:0').catch(() => undefined),
      this.cache.del('mc:students:100:0').catch(() => undefined),
    ]);
  }

  // ── list groups for a single branch (filadmin / manager view) ───────
  async listForBranch(branchId: string, tenantId: string) {
    const groups = await this.prisma.group.findMany({
      where: { branchId, tenantId },
      orderBy: { name: 'asc' },
    });

    return Promise.all(
      groups.map(async (g) => {
        const [studentCount, mentor] = await Promise.all([
          this.prisma.user.count({
            where: { groupId: g.id, role: 'student', tenantId },
          }),
          g.mentorId
            ? this.prisma.user.findFirst({
                where: { id: g.mentorId, tenantId },
                select: { id: true, name: true },
              })
            : null,
        ]);
        return { ...g, studentCount, mentor };
      }),
    );
  }

  // ── list groups tenant-wide (superadmin view) ────────────────────────
  async listForTenant(tenantId: string) {
    const groups = await this.prisma.group.findMany({
      where: { tenantId },
      orderBy: [{ branchId: 'asc' }, { name: 'asc' }],
      include: { branch: { select: { id: true, name: true } } },
    });

    return Promise.all(
      groups.map(async (g) => {
        const [studentCount, mentor] = await Promise.all([
          this.prisma.user.count({
            where: { groupId: g.id, role: 'student', tenantId },
          }),
          g.mentorId
            ? this.prisma.user.findFirst({
                where: { id: g.mentorId, tenantId },
                select: { id: true, name: true },
              })
            : null,
        ]);
        return { ...g, studentCount, mentor };
      }),
    );
  }

  // ── create ─────────────────────────────────────────────────────────────
  async create(
    tenantId: string,
    branchId: string,
    name: string,
    mentorId: string | null,
  ) {
    if (!name?.trim()) throw new BadRequestException('Guruh nomi kerak');

    // Validate branch belongs to tenant
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, tenantId },
    });
    if (!branch) throw new NotFoundException('Filial topilmadi');

    // Validate mentor if provided
    if (mentorId) {
      await this.validateMentor(mentorId, branchId, tenantId);
    }

    const group = await this.prisma.group.create({
      data: { tenantId, branchId, name: name.trim(), mentorId: mentorId ?? null },
    });

    // Assign mentor's groupId to the new group
    if (mentorId) {
      await this.setMentorGroup(mentorId, group.id, tenantId);
    }

    await this.invalidateStudentCache();
    return group;
  }

  // ── update ─────────────────────────────────────────────────────────────
  async update(
    id: string,
    tenantId: string,
    data: { name?: string; mentorId?: string | null },
  ) {
    const group = await this.findById(id, tenantId);

    if (data.name !== undefined) {
      if (!data.name.trim()) throw new BadRequestException('Guruh nomi kerak');
    }

    if (data.mentorId !== undefined && data.mentorId !== group.mentorId) {
      // Clear old mentor's groupId
      if (group.mentorId) {
        await this.prisma.user.updateMany({
          where: { id: group.mentorId, tenantId },
          data: { groupId: null },
        });
      }
      // Validate and assign new mentor
      if (data.mentorId) {
        await this.validateMentor(data.mentorId, group.branchId, tenantId);
        await this.setMentorGroup(data.mentorId, id, tenantId);
      }
    }

    const patch: { name?: string; mentorId?: string | null } = {};
    if (data.name !== undefined) patch.name = data.name.trim();
    if (data.mentorId !== undefined) patch.mentorId = data.mentorId ?? null;

    const updated = await this.prisma.group.update({
      where: { id },
      data: patch,
    });

    await this.invalidateStudentCache();
    return updated;
  }

  // ── add students (bulk) ─────────────────────────────────────────────────
  async addStudents(groupId: string, tenantId: string, studentIds: string[]) {
    const group = await this.findById(groupId, tenantId);

    // Validate: all must be students in the same branch
    const students = await this.prisma.user.findMany({
      where: { id: { in: studentIds }, tenantId },
      select: { id: true, role: true, branchId: true },
    });

    for (const s of students) {
      if (s.role !== 'student') {
        throw new BadRequestException(`Foydalanuvchi ${s.id} o'quvchi emas`);
      }
      if (s.branchId !== group.branchId) {
        throw new BadRequestException(
          `O'quvchi ${s.id} bu filialga tegishli emas`,
        );
      }
    }

    if (students.length !== studentIds.length) {
      throw new BadRequestException("Ba'zi o'quvchilar topilmadi");
    }

    await this.prisma.user.updateMany({
      where: { id: { in: studentIds }, tenantId },
      data: { groupId },
    });

    await this.invalidateStudentCache();
    return { updated: studentIds.length };
  }

  // ── remove a single student ─────────────────────────────────────────────
  async removeStudent(groupId: string, tenantId: string, studentId: string) {
    await this.findById(groupId, tenantId);

    const student = await this.prisma.user.findFirst({
      where: { id: studentId, tenantId, groupId, role: 'student' },
    });
    if (!student) {
      throw new NotFoundException("O'quvchi bu guruhda topilmadi");
    }

    await this.prisma.user.update({
      where: { id: studentId },
      data: { groupId: null },
    });

    await this.invalidateStudentCache();
    return { removed: true };
  }

  // ── delete ─────────────────────────────────────────────────────────────
  async delete(id: string, tenantId: string) {
    const group = await this.findById(id, tenantId);

    const studentCount = await this.prisma.user.count({
      where: { groupId: id, role: 'student', tenantId },
    });
    if (studentCount > 0) {
      throw new BadRequestException(
        `Guruhda ${studentCount} ta o'quvchi bor. Avval ularni boshqa guruhga ko'chiring yoki guruhdan chiqaring.`,
      );
    }

    // Clear mentor's groupId
    if (group.mentorId) {
      await this.prisma.user.updateMany({
        where: { id: group.mentorId, tenantId },
        data: { groupId: null },
      });
    }

    await this.prisma.group.delete({ where: { id } });
    await this.invalidateStudentCache();
    return { deleted: true };
  }

  // ── helpers ──────────────────────────────────────────────────────────────
  private async findById(id: string, tenantId: string) {
    const group = await this.prisma.group.findFirst({
      where: { id, tenantId },
    });
    if (!group) throw new NotFoundException('Guruh topilmadi');
    return group;
  }

  private async validateMentor(
    mentorId: string,
    branchId: string,
    tenantId: string,
  ) {
    const mentor = await this.prisma.user.findFirst({
      where: { id: mentorId, tenantId, role: 'mentor' },
    });
    if (!mentor) {
      throw new BadRequestException('Mentor topilmadi yoki rol mos emas');
    }
    if (mentor.branchId !== branchId) {
      throw new BadRequestException('Mentor bu filialga tegishli emas');
    }
  }

  private async setMentorGroup(
    mentorId: string,
    groupId: string,
    tenantId: string,
  ) {
    // If mentor already leads another group, clear that group's mentorId first
    const currentGroup = await this.prisma.group.findFirst({
      where: { mentorId, tenantId, id: { not: groupId } },
    });
    if (currentGroup) {
      await this.prisma.group.update({
        where: { id: currentGroup.id },
        data: { mentorId: null },
      });
    }
    await this.prisma.user.update({
      where: { id: mentorId },
      data: { groupId },
    });
  }
}
```

---

## Task 4: GroupsController

**Files:**
- Create: `apps/api/src/groups/groups.controller.ts`

- [ ] **Step 1: Create the controller**

Create `apps/api/src/groups/groups.controller.ts`:

```typescript
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { GroupsService } from './groups.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('groups')
@UseGuards(JwtAuthGuard, RolesGuard)
export class GroupsController {
  constructor(private groups: GroupsService) {}

  /**
   * GET /groups?branchId=
   * Superadmin can pass branchId; filadmin/manager uses their own branchId from JWT.
   */
  @Get()
  @Roles(UserRole.superadmin, UserRole.filadmin, UserRole.manager)
  async list(@Query('branchId') branchId: string | undefined, @Request() req: any) {
    const tenantId: string = req.user.tenantId;
    const role: UserRole = req.user.role;

    let resolvedBranchId: string;
    if (role === UserRole.superadmin) {
      if (!branchId) throw new BadRequestException('branchId majburiy');
      resolvedBranchId = branchId;
    } else {
      resolvedBranchId = req.user.branchId;
      if (!resolvedBranchId)
        throw new BadRequestException('Filial biriktirilmagan');
    }

    return this.groups.listForBranch(resolvedBranchId, tenantId);
  }

  /**
   * GET /groups/all — superadmin only, tenant-wide list with branch names
   */
  @Get('all')
  @Roles(UserRole.superadmin)
  listAll(@Request() req: any) {
    return this.groups.listForTenant(req.user.tenantId);
  }

  /**
   * POST /groups
   * Body: { branchId?, name, mentorId? }
   * Filadmin: branchId forced from JWT.
   * Superadmin: branchId from body required.
   */
  @Post()
  @Roles(UserRole.superadmin, UserRole.filadmin)
  async create(
    @Body() body: { branchId?: string; name: string; mentorId?: string },
    @Request() req: any,
  ) {
    const tenantId: string = req.user.tenantId;
    const role: UserRole = req.user.role;

    let branchId: string;
    if (role === UserRole.superadmin) {
      if (!body.branchId) throw new BadRequestException('branchId majburiy');
      branchId = body.branchId;
    } else {
      branchId = req.user.branchId;
      if (!branchId) throw new BadRequestException('Filial biriktirilmagan');
    }

    return this.groups.create(tenantId, branchId, body.name, body.mentorId ?? null);
  }

  /**
   * PATCH /groups/:id
   * Body: { name?, mentorId? }  (mentorId: null to unassign)
   */
  @Patch(':id')
  @Roles(UserRole.superadmin, UserRole.filadmin)
  update(
    @Param('id') id: string,
    @Body() body: { name?: string; mentorId?: string | null },
    @Request() req: any,
  ) {
    return this.groups.update(id, req.user.tenantId, body);
  }

  /**
   * DELETE /groups/:id
   */
  @Delete(':id')
  @Roles(UserRole.superadmin, UserRole.filadmin)
  remove(@Param('id') id: string, @Request() req: any) {
    return this.groups.delete(id, req.user.tenantId);
  }

  /**
   * POST /groups/:id/students
   * Body: { studentIds: string[] }
   */
  @Post(':id/students')
  @Roles(UserRole.superadmin, UserRole.filadmin)
  addStudents(
    @Param('id') id: string,
    @Body('studentIds') studentIds: string[],
    @Request() req: any,
  ) {
    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      throw new BadRequestException('studentIds kerak');
    }
    return this.groups.addStudents(id, req.user.tenantId, studentIds);
  }

  /**
   * DELETE /groups/:id/students/:studentId
   */
  @Delete(':id/students/:studentId')
  @Roles(UserRole.superadmin, UserRole.filadmin)
  removeStudent(
    @Param('id') id: string,
    @Param('studentId') studentId: string,
    @Request() req: any,
  ) {
    return this.groups.removeStudent(id, req.user.tenantId, studentId);
  }
}
```

---

## Task 5: GroupsModule + register in AppModule

**Files:**
- Create: `apps/api/src/groups/groups.module.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Create groups.module.ts**

Create `apps/api/src/groups/groups.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { GroupsService } from './groups.service';
import { GroupsController } from './groups.controller';

@Module({
  providers: [GroupsService],
  controllers: [GroupsController],
  exports: [GroupsService],
})
export class GroupsModule {}
```

- [ ] **Step 2: Register in app.module.ts**

In `apps/api/src/app.module.ts`:

Add import at the top:
```typescript
import { GroupsModule } from './groups/groups.module';
```

In the `imports` array, add `GroupsModule` after `VideoCheckinModule`:
```typescript
    VideoCheckinModule,
    GroupsModule,
```

---

## Task 6: Regenerate Prisma client

**Files:** (generated artifacts only)

- [ ] **Step 1: Generate client**

```bash
cd D:/projects/alochi && pnpm --filter api exec prisma generate
```

Expected: "Generated Prisma Client" printed. The new `group` model is now available in `@prisma/client`.

---

## Task 7: Backend quality gates

- [ ] **Step 1: TypeScript check**

```bash
cd D:/projects/alochi && pnpm --filter api exec tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 2: Lint check**

```bash
cd D:/projects/alochi && pnpm --filter api run lint
```

Expected: 0 errors.

- [ ] **Step 3: Build**

```bash
cd D:/projects/alochi && pnpm --filter api run build
```

Expected: exits 0.

---

## Task 8: Filadmin groups page

**Files:**
- Create: `apps/web/app/(dashboard)/filadmin/groups/page.tsx`

- [ ] **Step 1: Create the page**

Create `apps/web/app/(dashboard)/filadmin/groups/page.tsx`:

```tsx
'use client';
import { useCallback, useEffect, useState } from 'react';
import {
  Users,
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronUp,
  X,
  UserPlus,
} from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { getBranchIdFromToken } from '@/lib/jwt';
import { useFocusRevalidate } from '@/lib/useFocusRevalidate';
import { EmptyState, Modal, Skeleton, useToast } from '@/components/ui';

type Mentor = { id: string; name: string };
type GroupItem = {
  id: string;
  name: string;
  mentorId: string | null;
  mentor: Mentor | null;
  studentCount: number;
};
type Student = { id: string; name: string; groupId: string | null };

function emptyGroupForm() {
  return { name: '', mentorId: '' };
}

export default function FiladminGroupsPage() {
  const toast = useToast();
  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [loading, setLoading] = useState(true);

  // mentors and students in this branch for dropdowns
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [branchStudents, setBranchStudents] = useState<Student[]>([]);

  // create / edit modal
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<GroupItem | null>(null);
  const [form, setForm] = useState(emptyGroupForm());
  const [saving, setSaving] = useState(false);

  // delete confirm modal
  const [deleteTarget, setDeleteTarget] = useState<GroupItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  // expanded student panel per group (groupId → bool)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // add-students picker (groupId → bool)
  const [pickerGroup, setPickerGroup] = useState<string | null>(null);
  const [pickerSelected, setPickerSelected] = useState<string[]>([]);
  const [addingStudents, setAddingStudents] = useState(false);

  const token = () =>
    typeof window === 'undefined' ? '' : localStorage.getItem('accessToken') ?? '';

  const load = useCallback(async () => {
    const branchId = getBranchIdFromToken();
    if (!branchId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [groupsRes, usersRes] = await Promise.all([
        apiRequest<GroupItem[]>(`/groups?branchId=${branchId}`, {}, token()),
        apiRequest<{ id: string; name: string; role: string; groupId: string | null }[]>(
          `/users/by-branch/${branchId}`,
          {},
          token(),
        ),
      ]);
      setGroups(groupsRes.data ?? []);
      const users = usersRes.data ?? [];
      setMentors(users.filter((u) => u.role === 'mentor').map((u) => ({ id: u.id, name: u.name })));
      setBranchStudents(
        users
          .filter((u) => u.role === 'student')
          .map((u) => ({ id: u.id, name: u.name, groupId: u.groupId ?? null })),
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Yuklab boʻlmadi');
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load();
  }, [load]);

  useFocusRevalidate(load);

  // ── create ──────────────────────────────────────────────────────────────
  async function handleCreate() {
    if (!form.name.trim()) {
      toast.error('Guruh nomi kerak');
      return;
    }
    setSaving(true);
    try {
      await apiRequest(
        '/groups',
        {
          method: 'POST',
          body: JSON.stringify({
            name: form.name.trim(),
            mentorId: form.mentorId || undefined,
          }),
        },
        token(),
      );
      toast.success('Guruh yaratildi');
      setShowCreate(false);
      setForm(emptyGroupForm());
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xatolik');
    } finally {
      setSaving(false);
    }
  }

  // ── edit ────────────────────────────────────────────────────────────────
  function startEdit(g: GroupItem) {
    setEditTarget(g);
    setForm({ name: g.name, mentorId: g.mentorId ?? '' });
  }

  async function handleEdit() {
    if (!editTarget) return;
    if (!form.name.trim()) {
      toast.error('Guruh nomi kerak');
      return;
    }
    setSaving(true);
    try {
      await apiRequest(
        `/groups/${editTarget.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            name: form.name.trim(),
            mentorId: form.mentorId || null,
          }),
        },
        token(),
      );
      toast.success('Saqlandi');
      setEditTarget(null);
      setForm(emptyGroupForm());
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xatolik');
    } finally {
      setSaving(false);
    }
  }

  // ── delete ──────────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiRequest(
        `/groups/${deleteTarget.id}`,
        { method: 'DELETE' },
        token(),
      );
      toast.success("Guruh o'chirildi");
      setDeleteTarget(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "O'chirib bo'lmadi");
    } finally {
      setDeleting(false);
    }
  }

  // ── remove student ──────────────────────────────────────────────────────
  async function removeStudent(groupId: string, studentId: string) {
    try {
      await apiRequest(
        `/groups/${groupId}/students/${studentId}`,
        { method: 'DELETE' },
        token(),
      );
      toast.success("O'quvchi guruhdan chiqarildi");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xatolik');
    }
  }

  // ── add students ────────────────────────────────────────────────────────
  async function handleAddStudents() {
    if (!pickerGroup || pickerSelected.length === 0) return;
    setAddingStudents(true);
    try {
      await apiRequest(
        `/groups/${pickerGroup}/students`,
        {
          method: 'POST',
          body: JSON.stringify({ studentIds: pickerSelected }),
        },
        token(),
      );
      toast.success("O'quvchilar qo'shildi");
      setPickerGroup(null);
      setPickerSelected([]);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xatolik');
    } finally {
      setAddingStudents(false);
    }
  }

  // ── helpers ─────────────────────────────────────────────────────────────
  // mentors not already leading any group (available for assignment)
  function availableMentors(excludeId?: string | null) {
    const leadingIds = new Set(
      groups
        .filter((g) => g.mentorId && g.id !== (editTarget?.id ?? ''))
        .map((g) => g.mentorId as string),
    );
    return mentors.filter(
      (m) => !leadingIds.has(m.id) || m.id === (excludeId ?? ''),
    );
  }

  function studentsInGroup(groupId: string) {
    return branchStudents.filter((s) => s.groupId === groupId);
  }

  function studentsWithoutGroup() {
    return branchStudents.filter((s) => !s.groupId);
  }

  return (
    <div className="min-h-full bg-[#f7f4ef]">
      {/* Header */}
      <div className="bg-[#0f172a] px-5 pt-5 pb-6 relative overflow-hidden">
        <div
          aria-hidden
          className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-10 pointer-events-none"
          style={{
            background: 'radial-gradient(circle, #7c3aed 0%, transparent 70%)',
            transform: 'translate(30%, -30%)',
          }}
        />
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center">
              <Users size={20} className="text-violet-400" />
            </div>
            <div>
              <p className="text-[#94a3b8] text-xs font-medium uppercase tracking-wider">Filadmin</p>
              <p className="text-white text-lg font-bold">Guruhlar</p>
              <p className="text-[#64748b] text-xs">Filialingizdagi guruhlar va mentor tayinlash</p>
            </div>
          </div>
          <button
            onClick={() => { setShowCreate(true); setForm(emptyGroupForm()); }}
            className="flex items-center gap-2 bg-[#7c3aed] text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-violet-700 transition-colors"
          >
            <Plus size={15} />
            Yangi guruh
          </button>
        </div>
      </div>

      <div className="px-4 pt-5 pb-6 space-y-3">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-[18px]" theme="light" />)}
          </div>
        ) : groups.length === 0 ? (
          <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] overflow-hidden">
            <EmptyState
              icon={<Users size={28} />}
              title="Guruhlar yoʻq"
              description="Yangi guruh yarating"
              theme="light"
            />
          </div>
        ) : (
          groups.map((g) => {
            const isExpanded = expanded[g.id] ?? false;
            const inGroup = studentsInGroup(g.id);
            return (
              <div key={g.id} className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] overflow-hidden">
                {/* Group card header */}
                <div className="p-4 flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-violet-50 border border-violet-200 flex items-center justify-center shrink-0">
                    <Users size={18} className="text-violet-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[#0f172a] font-bold text-base truncate">{g.name}</p>
                    <p className="text-[#64748b] text-xs mt-0.5">
                      Mentor: {g.mentor?.name ?? (
                        <span className="text-rose-500 font-semibold">Tayinlanmagan</span>
                      )}
                    </p>
                    <p className="text-[#94a3b8] text-xs mt-0.5">
                      {g.studentCount} ta oʻquvchi
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => startEdit(g)}
                      className="w-8 h-8 rounded-xl bg-[#f7f4ef] border border-[#ede9e1] flex items-center justify-center hover:bg-violet-50 hover:border-violet-200 transition-colors"
                      title="Tahrirlash"
                    >
                      <Pencil size={13} className="text-[#64748b]" />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(g)}
                      className="w-8 h-8 rounded-xl bg-[#f7f4ef] border border-[#ede9e1] flex items-center justify-center hover:bg-rose-50 hover:border-rose-200 transition-colors"
                      title="O'chirish"
                    >
                      <Trash2 size={13} className="text-[#94a3b8] hover:text-rose-500" />
                    </button>
                    <button
                      onClick={() => setExpanded((p) => ({ ...p, [g.id]: !isExpanded }))}
                      className="w-8 h-8 rounded-xl bg-[#f7f4ef] border border-[#ede9e1] flex items-center justify-center hover:bg-[#ede9e1] transition-colors"
                      title={isExpanded ? 'Yopish' : "O'quvchilar"}
                    >
                      {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    </button>
                  </div>
                </div>

                {/* Expandable student panel */}
                {isExpanded && (
                  <div className="border-t border-[#ede9e1] px-4 py-3 space-y-2">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-[#64748b] uppercase tracking-widest">Oʻquvchilar</p>
                      <button
                        onClick={() => { setPickerGroup(g.id); setPickerSelected([]); }}
                        className="flex items-center gap-1.5 text-xs font-bold text-[#7c3aed] hover:underline"
                      >
                        <UserPlus size={12} />
                        Qoʻshish
                      </button>
                    </div>
                    {inGroup.length === 0 ? (
                      <p className="text-xs text-[#94a3b8] italic">Guruhda oʻquvchi yoʻq</p>
                    ) : (
                      inGroup.map((s) => (
                        <div key={s.id} className="flex items-center justify-between bg-[#f7f4ef] rounded-xl px-3 py-2">
                          <span className="text-sm text-[#0f172a] font-semibold">{s.name}</span>
                          <button
                            onClick={() => removeStudent(g.id, s.id)}
                            className="text-[#94a3b8] hover:text-rose-500 transition-colors"
                            title="Guruhdan chiqarish"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Create modal */}
      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="Yangi guruh"
      >
        <GroupForm
          form={form}
          onChange={setForm}
          mentors={availableMentors()}
          saving={saving}
          onSave={handleCreate}
          onCancel={() => setShowCreate(false)}
        />
      </Modal>

      {/* Edit modal */}
      <Modal
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        title="Guruhni tahrirlash"
      >
        <GroupForm
          form={form}
          onChange={setForm}
          mentors={availableMentors(editTarget?.mentorId)}
          saving={saving}
          onSave={handleEdit}
          onCancel={() => setEditTarget(null)}
        />
      </Modal>

      {/* Delete confirm modal */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Guruhni o'chirish"
      >
        <p className="text-[#64748b] text-sm mb-4">
          <span className="font-bold text-[#0f172a]">{deleteTarget?.name}</span>{' '}
          guruhini o&apos;chirishni tasdiqlaysizmi?
        </p>
        {deleteTarget && deleteTarget.studentCount > 0 && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 mb-4">
            <p className="text-rose-700 text-sm font-semibold">
              Guruhda {deleteTarget.studentCount} ta oʻquvchi bor. Avval ularni chiqaring.
            </p>
          </div>
        )}
        <div className="flex gap-2">
          <button
            onClick={handleDelete}
            disabled={deleting || (deleteTarget?.studentCount ?? 0) > 0}
            className="bg-rose-600 text-white text-sm px-4 py-2 rounded-xl font-bold disabled:opacity-40 hover:bg-rose-700 transition-colors"
          >
            {deleting ? 'Oʻchirilmoqda...' : "O'chirish"}
          </button>
          <button
            onClick={() => setDeleteTarget(null)}
            className="text-sm text-[#64748b] px-3 py-2 rounded-xl border border-[#ede9e1] font-semibold"
          >
            Bekor
          </button>
        </div>
      </Modal>

      {/* Add students picker modal */}
      <Modal
        open={!!pickerGroup}
        onClose={() => setPickerGroup(null)}
        title="Oʻquvchi qoʻshish"
        size="lg"
      >
        <div className="space-y-3">
          {studentsWithoutGroup().length === 0 ? (
            <p className="text-sm text-[#64748b] italic">Guruhsiz oʻquvchi yoʻq</p>
          ) : (
            studentsWithoutGroup().map((s) => {
              const checked = pickerSelected.includes(s.id);
              return (
                <label
                  key={s.id}
                  className="flex items-center gap-3 bg-[#f7f4ef] rounded-xl px-3 py-2.5 cursor-pointer hover:bg-violet-50 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() =>
                      setPickerSelected((p) =>
                        checked ? p.filter((x) => x !== s.id) : [...p, s.id],
                      )
                    }
                    className="accent-[#7c3aed] w-4 h-4"
                  />
                  <span className="text-sm text-[#0f172a] font-semibold">{s.name}</span>
                </label>
              );
            })
          )}
          <div className="flex gap-2 pt-2">
            <button
              onClick={handleAddStudents}
              disabled={addingStudents || pickerSelected.length === 0}
              className="bg-[#0f172a] text-white text-sm px-4 py-2 rounded-xl font-bold disabled:opacity-40"
            >
              {addingStudents ? 'Qoʻshilmoqda...' : `${pickerSelected.length} ta qoʻshish`}
            </button>
            <button
              onClick={() => setPickerGroup(null)}
              className="text-sm text-[#64748b] px-3 py-2 rounded-xl border border-[#ede9e1] font-semibold"
            >
              Bekor
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ── Shared form component ────────────────────────────────────────────────────
function GroupForm({
  form,
  onChange,
  mentors,
  saving,
  onSave,
  onCancel,
}: {
  form: { name: string; mentorId: string };
  onChange: (f: { name: string; mentorId: string }) => void;
  mentors: { id: string; name: string }[];
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs text-[#94a3b8] mb-1">Guruh nomi</label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => onChange({ ...form, name: e.target.value })}
          placeholder="Masalan: Guruh A"
          className="w-full bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#0f172a] text-[#0f172a]"
        />
      </div>
      <div>
        <label className="block text-xs text-[#94a3b8] mb-1">Mentor (ixtiyoriy)</label>
        {mentors.length === 0 ? (
          <p className="text-xs text-amber-600 font-semibold bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
            Mentor mavjud emas — avval mentorlarni qoʻshing
          </p>
        ) : (
          <select
            value={form.mentorId}
            onChange={(e) => onChange({ ...form, mentorId: e.target.value })}
            className="w-full appearance-none bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#0f172a] text-[#0f172a]"
          >
            <option value="">— tayinlanmagan —</option>
            {mentors.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        )}
      </div>
      <div className="flex gap-2 pt-1">
        <button
          onClick={onSave}
          disabled={saving}
          className="bg-[#0f172a] text-white text-sm px-4 py-2 rounded-xl font-bold disabled:opacity-50 hover:bg-[#1e293b] transition-colors"
        >
          {saving ? 'Saqlanmoqda...' : 'Saqlash'}
        </button>
        <button
          onClick={onCancel}
          className="text-sm text-[#64748b] px-3 py-2 rounded-xl border border-[#ede9e1] font-semibold"
        >
          Bekor
        </button>
      </div>
    </div>
  );
}
```

---

## Task 9: Superadmin groups page

**Files:**
- Create: `apps/web/app/(dashboard)/superadmin/groups/page.tsx`

- [ ] **Step 1: Create the page**

Create `apps/web/app/(dashboard)/superadmin/groups/page.tsx`:

```tsx
'use client';
import { useCallback, useEffect, useState } from 'react';
import { Users, Plus, Pencil, Trash2, ChevronDown, ChevronUp, X, UserPlus } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { useFocusRevalidate } from '@/lib/useFocusRevalidate';
import { EmptyState, Modal, Skeleton, useToast } from '@/components/ui';

type Branch = { id: string; name: string };
type Mentor = { id: string; name: string };
type GroupItem = {
  id: string;
  name: string;
  branchId: string;
  mentorId: string | null;
  mentor: Mentor | null;
  studentCount: number;
  branch?: { id: string; name: string };
};
type BranchUser = { id: string; name: string; role: string; branchId: string | null; groupId: string | null };

function emptyForm() {
  return { branchId: '', name: '', mentorId: '' };
}

export default function SuperadminGroupsPage() {
  const toast = useToast();
  const [allGroups, setAllGroups] = useState<GroupItem[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [allUsers, setAllUsers] = useState<BranchUser[]>([]);
  const [loading, setLoading] = useState(true);

  const [branchFilter, setBranchFilter] = useState('');

  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<GroupItem | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<GroupItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [pickerGroup, setPickerGroup] = useState<string | null>(null);
  const [pickerSelected, setPickerSelected] = useState<string[]>([]);
  const [addingStudents, setAddingStudents] = useState(false);

  const token = () =>
    typeof window === 'undefined' ? '' : localStorage.getItem('accessToken') ?? '';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [groupsRes, branchesRes, usersRes] = await Promise.all([
        apiRequest<GroupItem[]>('/groups/all', {}, token()),
        apiRequest<Branch[]>('/branches', {}, token()),
        apiRequest<BranchUser[]>('/users', {}, token()),
      ]);
      setAllGroups(groupsRes.data ?? []);
      setBranches(branchesRes.data ?? []);
      setAllUsers(usersRes.data ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Yuklab boʻlmadi');
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);
  useFocusRevalidate(load);

  const filteredGroups = branchFilter
    ? allGroups.filter((g) => g.branchId === branchFilter)
    : allGroups;

  function mentorsForBranch(branchId: string, excludeGroupId?: string) {
    const leadingIds = new Set(
      allGroups
        .filter((g) => g.mentorId && g.id !== (excludeGroupId ?? ''))
        .map((g) => g.mentorId as string),
    );
    return allUsers
      .filter((u) => u.role === 'mentor' && u.branchId === branchId && !leadingIds.has(u.id))
      .map((u) => ({ id: u.id, name: u.name }));
  }

  function studentsForBranch(branchId: string) {
    return allUsers.filter((u) => u.role === 'student' && u.branchId === branchId);
  }

  function studentsInGroup(groupId: string) {
    return allUsers.filter((u) => u.role === 'student' && u.groupId === groupId);
  }

  function studentsWithoutGroupInBranch(branchId: string) {
    return allUsers.filter((u) => u.role === 'student' && u.branchId === branchId && !u.groupId);
  }

  async function handleCreate() {
    if (!form.branchId) { toast.error('Filial tanlang'); return; }
    if (!form.name.trim()) { toast.error('Guruh nomi kerak'); return; }
    setSaving(true);
    try {
      await apiRequest('/groups', {
        method: 'POST',
        body: JSON.stringify({ branchId: form.branchId, name: form.name.trim(), mentorId: form.mentorId || undefined }),
      }, token());
      toast.success('Guruh yaratildi');
      setShowCreate(false);
      setForm(emptyForm());
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xatolik');
    } finally {
      setSaving(false);
    }
  }

  function startEdit(g: GroupItem) {
    setEditTarget(g);
    setForm({ branchId: g.branchId, name: g.name, mentorId: g.mentorId ?? '' });
  }

  async function handleEdit() {
    if (!editTarget) return;
    if (!form.name.trim()) { toast.error('Guruh nomi kerak'); return; }
    setSaving(true);
    try {
      await apiRequest(`/groups/${editTarget.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: form.name.trim(), mentorId: form.mentorId || null }),
      }, token());
      toast.success('Saqlandi');
      setEditTarget(null);
      setForm(emptyForm());
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xatolik');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiRequest(`/groups/${deleteTarget.id}`, { method: 'DELETE' }, token());
      toast.success("Guruh o'chirildi");
      setDeleteTarget(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "O'chirib bo'lmadi");
    } finally {
      setDeleting(false);
    }
  }

  async function removeStudent(groupId: string, studentId: string) {
    try {
      await apiRequest(`/groups/${groupId}/students/${studentId}`, { method: 'DELETE' }, token());
      toast.success("O'quvchi guruhdan chiqarildi");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xatolik');
    }
  }

  async function handleAddStudents() {
    if (!pickerGroup || pickerSelected.length === 0) return;
    setAddingStudents(true);
    try {
      await apiRequest(`/groups/${pickerGroup}/students`, {
        method: 'POST',
        body: JSON.stringify({ studentIds: pickerSelected }),
      }, token());
      toast.success("O'quvchilar qo'shildi");
      setPickerGroup(null);
      setPickerSelected([]);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xatolik');
    } finally {
      setAddingStudents(false);
    }
  }

  const pickerBranchId = pickerGroup ? (allGroups.find((g) => g.id === pickerGroup)?.branchId ?? '') : '';

  return (
    <div className="min-h-full bg-[#f7f4ef]">
      {/* Header */}
      <div className="bg-[#0f172a] px-5 pt-5 pb-6 relative overflow-hidden">
        <div aria-hidden className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-10 pointer-events-none" style={{ background: 'radial-gradient(circle, #7c3aed 0%, transparent 70%)', transform: 'translate(30%, -30%)' }} />
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center">
              <Users size={20} className="text-violet-400" />
            </div>
            <div>
              <p className="text-[#94a3b8] text-xs font-medium uppercase tracking-wider">Superadmin</p>
              <p className="text-white text-lg font-bold">Guruhlar</p>
              <p className="text-[#64748b] text-xs">Barcha filiallardagi guruhlar</p>
            </div>
          </div>
          <button
            onClick={() => { setShowCreate(true); setForm(emptyForm()); }}
            className="flex items-center gap-2 bg-[#7c3aed] text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-violet-700 transition-colors"
          >
            <Plus size={15} />
            Yangi guruh
          </button>
        </div>
      </div>

      <div className="px-4 pt-4 pb-6 space-y-4">
        {/* Branch filter */}
        <div className="flex items-center gap-2">
          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            className="appearance-none bg-white border border-[#ede9e1] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#0f172a] text-[#0f172a]"
          >
            <option value="">Barcha filiallar</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <ChevronDown size={12} className="text-[#94a3b8] -ml-6 pointer-events-none" />
        </div>

        {loading ? (
          <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-[18px]" theme="light" />)}</div>
        ) : filteredGroups.length === 0 ? (
          <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] overflow-hidden">
            <EmptyState icon={<Users size={28} />} title="Guruhlar yoʻq" description="Yangi guruh yarating" theme="light" />
          </div>
        ) : (
          filteredGroups.map((g) => {
            const isExpanded = expanded[g.id] ?? false;
            const inGroup = studentsInGroup(g.id);
            const branchName = g.branch?.name ?? branches.find((b) => b.id === g.branchId)?.name ?? '';
            return (
              <div key={g.id} className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] overflow-hidden">
                <div className="p-4 flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-violet-50 border border-violet-200 flex items-center justify-center shrink-0">
                    <Users size={18} className="text-violet-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-[#0f172a] font-bold text-base truncate">{g.name}</p>
                      {branchName && (
                        <span className="text-[10px] font-bold bg-slate-100 text-slate-500 rounded-full px-2 py-0.5">{branchName}</span>
                      )}
                    </div>
                    <p className="text-[#64748b] text-xs mt-0.5">
                      Mentor: {g.mentor?.name ?? <span className="text-rose-500 font-semibold">Tayinlanmagan</span>}
                    </p>
                    <p className="text-[#94a3b8] text-xs mt-0.5">{g.studentCount} ta oʻquvchi</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => startEdit(g)} className="w-8 h-8 rounded-xl bg-[#f7f4ef] border border-[#ede9e1] flex items-center justify-center hover:bg-violet-50 hover:border-violet-200 transition-colors" title="Tahrirlash"><Pencil size={13} className="text-[#64748b]" /></button>
                    <button onClick={() => setDeleteTarget(g)} className="w-8 h-8 rounded-xl bg-[#f7f4ef] border border-[#ede9e1] flex items-center justify-center hover:bg-rose-50 hover:border-rose-200 transition-colors" title="O'chirish"><Trash2 size={13} className="text-[#94a3b8]" /></button>
                    <button onClick={() => setExpanded((p) => ({ ...p, [g.id]: !isExpanded }))} className="w-8 h-8 rounded-xl bg-[#f7f4ef] border border-[#ede9e1] flex items-center justify-center hover:bg-[#ede9e1] transition-colors">{isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}</button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-[#ede9e1] px-4 py-3 space-y-2">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-[#64748b] uppercase tracking-widest">Oʻquvchilar</p>
                      <button onClick={() => { setPickerGroup(g.id); setPickerSelected([]); }} className="flex items-center gap-1.5 text-xs font-bold text-[#7c3aed] hover:underline"><UserPlus size={12} />Qoʻshish</button>
                    </div>
                    {inGroup.length === 0 ? (
                      <p className="text-xs text-[#94a3b8] italic">Guruhda oʻquvchi yoʻq</p>
                    ) : (
                      inGroup.map((s) => (
                        <div key={s.id} className="flex items-center justify-between bg-[#f7f4ef] rounded-xl px-3 py-2">
                          <span className="text-sm text-[#0f172a] font-semibold">{s.name}</span>
                          <button onClick={() => removeStudent(g.id, s.id)} className="text-[#94a3b8] hover:text-rose-500 transition-colors"><X size={14} /></button>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Create modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Yangi guruh" size="md">
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-[#94a3b8] mb-1">Filial</label>
            <select value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value, mentorId: '' })} className="w-full appearance-none bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#0f172a] text-[#0f172a]">
              <option value="">— tanlang —</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-[#94a3b8] mb-1">Guruh nomi</label>
            <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Masalan: Guruh A" className="w-full bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#0f172a] text-[#0f172a]" />
          </div>
          <div>
            <label className="block text-xs text-[#94a3b8] mb-1">Mentor (ixtiyoriy)</label>
            {form.branchId ? (
              mentorsForBranch(form.branchId).length === 0 ? (
                <p className="text-xs text-amber-600 font-semibold bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">Mentor mavjud emas</p>
              ) : (
                <select value={form.mentorId} onChange={(e) => setForm({ ...form, mentorId: e.target.value })} className="w-full appearance-none bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#0f172a] text-[#0f172a]">
                  <option value="">— tayinlanmagan —</option>
                  {mentorsForBranch(form.branchId).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              )
            ) : <p className="text-xs text-[#94a3b8] italic">Avval filial tanlang</p>}
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={handleCreate} disabled={saving} className="bg-[#0f172a] text-white text-sm px-4 py-2 rounded-xl font-bold disabled:opacity-50">{saving ? 'Saqlanmoqda...' : 'Saqlash'}</button>
            <button onClick={() => setShowCreate(false)} className="text-sm text-[#64748b] px-3 py-2 rounded-xl border border-[#ede9e1] font-semibold">Bekor</button>
          </div>
        </div>
      </Modal>

      {/* Edit modal */}
      <Modal open={!!editTarget} onClose={() => setEditTarget(null)} title="Guruhni tahrirlash">
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-[#94a3b8] mb-1">Guruh nomi</label>
            <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#0f172a] text-[#0f172a]" />
          </div>
          <div>
            <label className="block text-xs text-[#94a3b8] mb-1">Mentor</label>
            {editTarget && mentorsForBranch(editTarget.branchId, editTarget.id).length === 0 && !editTarget.mentorId ? (
              <p className="text-xs text-amber-600 font-semibold bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">Mentor mavjud emas</p>
            ) : (
              <select value={form.mentorId} onChange={(e) => setForm({ ...form, mentorId: e.target.value })} className="w-full appearance-none bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#0f172a] text-[#0f172a]">
                <option value="">— tayinlanmagan —</option>
                {editTarget && [
                  ...(editTarget.mentor ? [editTarget.mentor] : []),
                  ...mentorsForBranch(editTarget.branchId, editTarget.id).filter((m) => m.id !== editTarget.mentorId),
                ].map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            )}
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={handleEdit} disabled={saving} className="bg-[#0f172a] text-white text-sm px-4 py-2 rounded-xl font-bold disabled:opacity-50">{saving ? 'Saqlanmoqda...' : 'Saqlash'}</button>
            <button onClick={() => setEditTarget(null)} className="text-sm text-[#64748b] px-3 py-2 rounded-xl border border-[#ede9e1] font-semibold">Bekor</button>
          </div>
        </div>
      </Modal>

      {/* Delete confirm */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Guruhni o'chirish">
        <p className="text-[#64748b] text-sm mb-4"><span className="font-bold text-[#0f172a]">{deleteTarget?.name}</span> guruhini oʻchirishni tasdiqlaysizmi?</p>
        {deleteTarget && deleteTarget.studentCount > 0 && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 mb-4">
            <p className="text-rose-700 text-sm font-semibold">Guruhda {deleteTarget.studentCount} ta oʻquvchi bor. Avval ularni chiqaring.</p>
          </div>
        )}
        <div className="flex gap-2">
          <button onClick={handleDelete} disabled={deleting || (deleteTarget?.studentCount ?? 0) > 0} className="bg-rose-600 text-white text-sm px-4 py-2 rounded-xl font-bold disabled:opacity-40">{deleting ? 'Oʻchirilmoqda...' : "O'chirish"}</button>
          <button onClick={() => setDeleteTarget(null)} className="text-sm text-[#64748b] px-3 py-2 rounded-xl border border-[#ede9e1] font-semibold">Bekor</button>
        </div>
      </Modal>

      {/* Add students picker */}
      <Modal open={!!pickerGroup} onClose={() => setPickerGroup(null)} title="Oʻquvchi qoʻshish" size="lg">
        <div className="space-y-3">
          {studentsWithoutGroupInBranch(pickerBranchId).length === 0 ? (
            <p className="text-sm text-[#64748b] italic">Guruhsiz oʻquvchi yoʻq</p>
          ) : (
            studentsWithoutGroupInBranch(pickerBranchId).map((s) => {
              const checked = pickerSelected.includes(s.id);
              return (
                <label key={s.id} className="flex items-center gap-3 bg-[#f7f4ef] rounded-xl px-3 py-2.5 cursor-pointer hover:bg-violet-50 transition-colors">
                  <input type="checkbox" checked={checked} onChange={() => setPickerSelected((p) => checked ? p.filter((x) => x !== s.id) : [...p, s.id])} className="accent-[#7c3aed] w-4 h-4" />
                  <span className="text-sm text-[#0f172a] font-semibold">{s.name}</span>
                </label>
              );
            })
          )}
          <div className="flex gap-2 pt-2">
            <button onClick={handleAddStudents} disabled={addingStudents || pickerSelected.length === 0} className="bg-[#0f172a] text-white text-sm px-4 py-2 rounded-xl font-bold disabled:opacity-40">{addingStudents ? 'Qoʻshilmoqda...' : `${pickerSelected.length} ta qoʻshish`}</button>
            <button onClick={() => setPickerGroup(null)} className="text-sm text-[#64748b] px-3 py-2 rounded-xl border border-[#ede9e1] font-semibold">Bekor</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
```

---

## Task 10: Superadmin users page — add group selector to edit modal

**Files:**
- Modify: `apps/web/app/(dashboard)/superadmin/users/page.tsx`

- [ ] **Step 1: Read current edit modal state**

Read the full file to understand the current `editForm` state and `startEdit` / `saveEdit` functions.

- [ ] **Step 2: Add group state and group loading to the component**

In `SuperadminUsersPage`, add after the `editSaving` state:

```tsx
const [groups, setGroups] = useState<{ id: string; name: string; branchId: string }[]>([]);
const [editGroupId, setEditGroupId] = useState('');
```

Add `loadGroups` function after `loadBranches`:
```tsx
async function loadGroupsForBranch(branchId: string) {
  if (!branchId) { setGroups([]); return; }
  try {
    const res = await apiRequest<{ id: string; name: string; branchId: string }[]>(
      `/groups?branchId=${branchId}`,
      {},
      token(),
    );
    setGroups(res.data ?? []);
  } catch {
    setGroups([]);
  }
}
```

- [ ] **Step 3: Update startEdit to load groups and set groupId**

Change `startEdit` to:
```tsx
function startEdit(u: User) {
  setEditing(u);
  setEditForm({
    name: u.name,
    role: u.role,
    branchId: u.branchId ?? '',
    phone: u.phone ?? '',
  });
  setEditGroupId(u.groupId ?? '');
  if (u.branchId && (u.role === 'student' || u.role === 'mentor')) {
    loadGroupsForBranch(u.branchId).catch(() => {});
  } else {
    setGroups([]);
  }
}
```

This requires adding `groupId` to the `User` interface:
```tsx
interface User {
  id: string;
  name: string;
  login: string;
  role: string;
  status: string;
  phone?: string;
  branchId?: string;
  groupId?: string;
}
```

- [ ] **Step 4: Update saveEdit to send groupId**

In `saveEdit`, change the PATCH body to include `groupId`:
```tsx
      await apiRequest(
        `/users/${editing.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            name: editForm.name.trim(),
            role: editForm.role,
            branchId: editForm.branchId || null,
            phone: editForm.phone || null,
            groupId: (editForm.role === 'student' || editForm.role === 'mentor')
              ? (editGroupId || null)
              : null,
          }),
        },
        token(),
      );
```

- [ ] **Step 5: Add group selector to edit modal JSX**

In the edit modal's form fields (after the existing branchId select), add:
```tsx
{(editForm.role === 'student' || editForm.role === 'mentor') && (
  <div>
    <label className="block text-xs text-[#94a3b8] mb-1">Guruh</label>
    <div className="relative">
      <select
        value={editGroupId}
        onChange={(e) => setEditGroupId(e.target.value)}
        className="w-full appearance-none bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#0f172a] text-[#0f172a] pr-8"
      >
        <option value="">— guruhsiz —</option>
        {groups.map((g) => (
          <option key={g.id} value={g.id}>{g.name}</option>
        ))}
      </select>
      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94a3b8] pointer-events-none" />
    </div>
  </div>
)}
```

Also add a `useEffect` or `onChange` handler so that when `editForm.role` changes to/from mentor/student, `loadGroupsForBranch` is called again:
```tsx
// When role changes in edit form, reload groups
useEffect(() => {
  if (!editing) return;
  if ((editForm.role === 'student' || editForm.role === 'mentor') && editForm.branchId) {
    loadGroupsForBranch(editForm.branchId).catch(() => {});
  } else {
    setGroups([]);
  }
}, [editForm.role, editForm.branchId]); // eslint-disable-line react-hooks/exhaustive-deps
```

---

## Task 11: TopNav — add Guruhlar links

**Files:**
- Modify: `apps/web/app/(dashboard)/_components/TopNav.tsx`

- [ ] **Step 1: Add Guruhlar to filadmin nav**

In the `NAV.filadmin` array, find the `"O'quvchilar"` entry (the one with `items` containing `/filadmin/students`). Add a new `items` entry for groups:

```tsx
{ href: '/filadmin/groups', icon: <Users size={14} />, label: 'Guruhlar' },
```

Place it at position 3 of the `items` array (after `warnings`), so it reads:
```tsx
items: [
  { href: '/filadmin/students', icon: <Users size={14} />, label: "O'quvchilar" },
  { href: '/filadmin/blocked-students', icon: <AlertTriangle size={14} />, label: 'Bloklanganlar' },
  { href: '/filadmin/warnings', icon: <AlertTriangle size={14} />, label: 'Ogohlantirish' },
  { href: '/filadmin/groups', icon: <Users size={14} />, label: 'Guruhlar' },
],
```

- [ ] **Step 2: Add Guruhlar to superadmin nav**

In the `NAV.superadmin` array, find the `"Foydalanuvchilar"` entry (the one with `items`). Add:

```tsx
{ href: '/superadmin/groups', icon: <Users size={14} />, label: 'Guruhlar' },
```

So it reads:
```tsx
items: [
  { href: '/superadmin/users', icon: <Users size={14} />, label: 'Foydalanuvchilar' },
  { href: '/superadmin/blocked-students', icon: <AlertTriangle size={14} />, label: "Bloklangan o'quvchilar" },
  { href: '/superadmin/groups', icon: <Users size={14} />, label: 'Guruhlar' },
],
```

---

## Task 12: Enhance groupError banners in mentor pages

**Files:**
- Modify: `apps/web/app/(dashboard)/mentor/page.tsx`
- Modify: `apps/web/app/(dashboard)/mentor/group/page.tsx`

- [ ] **Step 1: Update mentor/page.tsx banner**

In `mentor/page.tsx`, find the `groupError` banner (around line 252):

```tsx
{groupError && (
  <section className="bg-rose-50 border border-rose-200 rounded-2xl p-4">
    <p className="text-rose-800 text-sm font-bold">{groupError}</p>
  </section>
)}
```

Replace with:
```tsx
{groupError && (
  <section className="bg-rose-50 border border-rose-200 rounded-2xl p-4 space-y-2">
    <p className="text-rose-800 text-sm font-bold">{groupError}</p>
    <p className="text-rose-700 text-xs">
      Filadmin orqali sizga guruh tayinlanishi kerak.{' '}
      <a href="/filadmin/groups" className="underline font-semibold hover:text-rose-900">
        Guruhlarni boshqarish →
      </a>
    </p>
  </section>
)}
```

- [ ] **Step 2: Update mentor/group/page.tsx banner**

In `mentor/group/page.tsx`, find the `error` banner (around line 97):
```tsx
setError('Guruh biriktirilmagan — superadmin orqali sizga guruh tayinlanishi kerak.');
```

That string is used to display an error. Find the JSX that renders `error` (look for `{error &&`). The existing render pattern shows error as text. Replace the error display JSX:

```tsx
{error && (
  <div className="p-4 bg-rose-50 rounded-2xl border border-rose-200 space-y-2">
    <p className="text-rose-800 text-sm font-bold">{error}</p>
    <p className="text-rose-700 text-xs">
      Filadmin orqali sizga guruh tayinlanishi kerak.{' '}
      <a href="/filadmin/groups" className="underline font-semibold hover:text-rose-900">
        Guruhlarni boshqarish →
      </a>
    </p>
  </div>
)}
```

---

## Task 13: Frontend quality gates

- [ ] **Step 1: TypeScript check**

```bash
cd D:/projects/alochi && pnpm --filter web exec tsc --noEmit
```

Expected: 0 errors. If errors in users/page.tsx around the new `groupId` field or the `loadGroupsForBranch` function, fix them:
- Ensure `User` interface has `groupId?: string`
- Ensure `loadGroupsForBranch` is declared before use (move above `startEdit` if needed)
- Ensure the `useEffect` for role/branch change has correct deps

- [ ] **Step 2: Lint check**

```bash
cd D:/projects/alochi && pnpm --filter web run lint
```

Expected: 0 errors (warnings OK). Fix any `no-unused-vars` or missing dep lint errors.

- [ ] **Step 3: Build**

```bash
cd D:/projects/alochi && pnpm --filter web run build
```

Expected: exits 0. Fix any type errors surfaced by the build that tsc --noEmit missed.

---

## Self-Review Checklist

**Spec coverage:**

| Spec requirement | Task |
|---|---|
| A1. Group model in schema | Task 1 |
| A2. Migration SQL + backfill | Task 2 |
| A3. GroupsModule (service + controller) | Tasks 3, 4, 5 |
| A3. listForBranch with studentCount + mentor | Task 3 |
| A3. listForTenant with branch.name | Task 3 |
| A3. create with mentor validation + swap | Task 3 |
| A3. update with mentor swap | Task 3 |
| A3. addStudents bulk | Task 3 |
| A3. removeStudent | Task 3 |
| A3. delete (guard 0 students) | Task 3 |
| A3. All 8 routes in controller | Task 4 |
| A3. Register GroupsModule in AppModule | Task 5 |
| A4. Cache invalidation | Task 3 (invalidateStudentCache called in all write methods) |
| B1. Filadmin groups page | Task 8 |
| B1. useFocusRevalidate | Task 8 |
| B1. Error/empty/loading states | Task 8 |
| B1. Add students panel per group | Task 8 |
| B2. Superadmin groups page with branch filter | Task 9 |
| B2. Branch selector in create form | Task 9 |
| B3. Superadmin users edit — group selector | Task 10 |
| B4. TopNav filadmin Guruhlar link | Task 11 |
| B4. TopNav superadmin Guruhlar link | Task 11 |
| B5. Mentor banner enhanced CTA | Task 12 |
| Quality gates all 6 | Tasks 7, 13 |

**Judgment call — User.groupId reverse relation:** No Prisma relation added on `User` pointing to `Group`. Service uses raw `prisma.user.count({ where: { groupId: g.id } })` and `prisma.user.findMany({ where: { groupId: groupId } })`. This is safe because `Group.id` is a UUID and `User.groupId` stores the same UUID — they match without a FK constraint. Adding a Prisma relation would require a FK which would reject existing `User` rows whose `groupId` doesn't yet exist in the new `groups` table.

**Not done intentionally:**
- No migration `prisma_migrations` table entry — `--create-only` means parent applies manually on VPS
- No test files — spec says trust quality gates, not deep test per phase
- No `/filadmin/groups/[id]` detail page — spec only shows card list with expandable panel
- `mentor/group/page.tsx` error link points to `/filadmin/groups` generically — the mentor doesn't know their admin's role, and the spec says "for filadmin or superadmin visiting the same component, link to the appropriate URL" but the mentor page has no role-awareness of the *viewer's* role (the mentor IS the viewer). The spec's B5 is interpreted as: enhance the text with a hint link. The page is only visible to mentors, so linking to `/filadmin/groups` is appropriate (their admin is always a filadmin or superadmin who can reach that page).
