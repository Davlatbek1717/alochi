# Social Completeness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the four missing social features: DB-backed keyword moderation, 13+ age restriction for branch friends, duel real-time WebSocket notifications, group challenge widget, and superadmin keyword management UI.

**Architecture:** Backend adds a `ChatKeyword` table (tenant-scoped, loaded into memory on startup), injects `SocialGateway` into `DuelService` for real-time push, and exposes keyword CRUD endpoints. Frontend adds a `DuelNotificationProvider` in the dashboard layout (student-only toast), a challenge progress widget at the top of the group chat page, and a new superadmin keyword management page.

**Tech Stack:** NestJS + Prisma + Socket.io (backend); Next.js 15 App Router + socket.io-client + Tailwind (frontend); Jest (backend unit tests only).

---

## Background

### ResponseInterceptor
All API responses: `{ success: true, data: T, meta: { timestamp } }` — access via `.data`.

### WebSocket namespace
`/social` namespace — clients auth via `socket.handshake.auth.token`. On connect, server joins client to `feed:${userId}` room. Emit to a specific user: `this.server.to(`feed:${userId}`).emit(event, data)`.

### Existing patterns
- JWT decode in frontend: `JSON.parse(atob(token.split('.')[1]))`
- `apiRequest<T>(path, options, token)` returns `{ data: T }`
- Mock Prisma pattern in tests: `{ model: { method: jest.fn() } }`

---

## Files

**Create:**
- `prisma/migrations/008_social_completeness/migration.sql`
- `apps/web/app/(dashboard)/_components/DuelNotificationProvider.tsx`
- `apps/web/app/(dashboard)/superadmin/keywords/page.tsx`

**Modify:**
- `prisma/schema.prisma` — add `birthDate` to User, add `ChatKeyword` model
- `apps/api/src/social/chat.service.ts` — tenant-scoped DB keywords
- `apps/api/src/social/friends.service.ts` — 13+ age check
- `apps/api/src/social/social.gateway.ts` — `emitDuelChallenge`, `emitDuelResult` methods
- `apps/api/src/social/duel.service.ts` — inject gateway, emit events
- `apps/api/src/social/social.controller.ts` — keyword CRUD endpoints
- `apps/api/src/social/social.module.ts` — no change needed (gateway already provided)
- `apps/web/app/(dashboard)/layout.tsx` — wrap children with DuelNotificationProvider
- `apps/web/app/(dashboard)/student/groups/[id]/chat/page.tsx` — challenge widget
- `apps/web/app/(dashboard)/superadmin/page.tsx` — add keywords nav card

---

## Task 1: Database migration — birthDate + ChatKeyword

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/008_social_completeness/migration.sql`

- [ ] **Step 1: Add birthDate to User model in schema.prisma**

In `prisma/schema.prisma`, find the `model User` block. After the `telegramId` line, add:

```prisma
  birthDate    DateTime?  @map("birth_date") @db.Date
```

- [ ] **Step 2: Add ChatKeyword model to schema.prisma**

At the end of `prisma/schema.prisma`, before the last line, add:

```prisma
model ChatKeyword {
  id        String   @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  tenantId  String   @map("tenant_id") @db.Uuid
  word      String
  createdAt DateTime @default(now()) @map("created_at")

  @@unique([tenantId, word])
  @@map("chat_keywords")
}
```

- [ ] **Step 3: Create migration SQL**

Create file `prisma/migrations/008_social_completeness/migration.sql`:

```sql
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "birth_date" DATE;

CREATE TABLE IF NOT EXISTS "chat_keywords" (
  "id"         UUID        NOT NULL DEFAULT uuid_generate_v4(),
  "tenant_id"  UUID        NOT NULL,
  "word"       TEXT        NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "chat_keywords_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "chat_keywords_tenant_id_word_key" UNIQUE ("tenant_id", "word")
);
```

- [ ] **Step 4: Apply migration**

```bash
cd apps/api
npx prisma migrate deploy
npx prisma generate
```

Expected: "1 migration applied", no errors.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/008_social_completeness/
git commit -m "feat(db): add birthDate to users and ChatKeyword table"
```

---

## Task 2: ChatService — tenant-scoped DB keywords

**Files:**
- Modify: `apps/api/src/social/chat.service.ts`

- [ ] **Step 1: Write failing test**

In `apps/api/src/social/chat.service.ts` there is no spec file. Create `apps/api/src/social/chat.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ChatService } from './chat.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  chatKeyword: { findMany: jest.fn(), create: jest.fn(), delete: jest.fn() },
  chatBan: { findFirst: jest.fn() },
  groupMessage: { count: jest.fn(), create: jest.fn(), findMany: jest.fn(), update: jest.fn() },
  messageReaction: { upsert: jest.fn() },
};

describe('ChatService', () => {
  let service: ChatService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ChatService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get(ChatService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('onModuleInit', () => {
    it('loads keywords from DB into memory on startup', async () => {
      mockPrisma.chatKeyword.findMany.mockResolvedValue([
        { tenantId: 't1', word: 'badword' },
        { tenantId: 't1', word: 'spam' },
      ]);

      await service.onModuleInit();

      expect(mockPrisma.chatKeyword.findMany).toHaveBeenCalledTimes(1);
    });
  });

  describe('sendMessage', () => {
    const dto = { tenantId: 't1', groupId: 'g1', senderId: 'u1', content: 'hello' };

    beforeEach(async () => {
      mockPrisma.chatKeyword.findMany.mockResolvedValue([
        { tenantId: 't1', word: 'badword' },
      ]);
      await service.onModuleInit();
      mockPrisma.chatKeyword.findMany.mockClear();
    });

    it('blocks message containing a tenant keyword', async () => {
      mockPrisma.chatBan.findFirst.mockResolvedValue(null);
      mockPrisma.groupMessage.count.mockResolvedValue(0);

      await expect(
        service.sendMessage({ ...dto, content: 'this has BADWORD in it' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('allows message with no blocked keywords', async () => {
      mockPrisma.chatBan.findFirst.mockResolvedValue(null);
      mockPrisma.groupMessage.count.mockResolvedValue(0);
      mockPrisma.groupMessage.create.mockResolvedValue({ id: 'm1', content: 'hello', sender: { name: 'Ali', role: 'student' }, createdAt: new Date() });

      const result = await service.sendMessage(dto);
      expect(result.id).toBe('m1');
    });

    it('blocks banned user regardless of content', async () => {
      mockPrisma.chatBan.findFirst.mockResolvedValue({ id: 'ban1', expiresAt: null });

      await expect(service.sendMessage(dto)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('addKeyword / removeKeyword / getKeywords', () => {
    it('addKeyword inserts into DB and updates cache', async () => {
      mockPrisma.chatKeyword.create.mockResolvedValue({ tenantId: 't1', word: 'spam' });
      mockPrisma.chatKeyword.findMany.mockResolvedValue([]);
      await service.onModuleInit();

      await service.addKeyword('t1', 'spam');

      expect(mockPrisma.chatKeyword.create).toHaveBeenCalledWith({
        data: { tenantId: 't1', word: 'spam' },
      });
    });

    it('removeKeyword deletes from DB and updates cache', async () => {
      mockPrisma.chatKeyword.delete.mockResolvedValue({});
      mockPrisma.chatKeyword.findMany.mockResolvedValue([{ tenantId: 't1', word: 'spam' }]);
      await service.onModuleInit();

      await service.removeKeyword('t1', 'spam');

      expect(mockPrisma.chatKeyword.delete).toHaveBeenCalledWith({
        where: { tenantId_word: { tenantId: 't1', word: 'spam' } },
      });
    });

    it('getKeywords returns array of words for tenant', async () => {
      mockPrisma.chatKeyword.findMany.mockResolvedValue([
        { tenantId: 't1', word: 'badword' },
        { tenantId: 't1', word: 'spam' },
      ]);

      const result = await service.getKeywords('t1');

      expect(result).toEqual(['badword', 'spam']);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/api
npx jest chat.spec --no-coverage
```

Expected: FAIL — `onModuleInit is not a function` or similar.

- [ ] **Step 3: Rewrite chat.service.ts**

Replace the full content of `apps/api/src/social/chat.service.ts`:

```typescript
import { Injectable, BadRequestException, ForbiddenException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const MAX_MESSAGE_LENGTH = 200;
const MAX_DAILY_MESSAGES = 20;
const ALLOWED_EMOJIS = ['👍', '🎉', '💪', '🔥', '❤️'];

interface SendMessageDto {
  tenantId: string;
  groupId: string;
  senderId: string;
  content: string;
}

@Injectable()
export class ChatService implements OnModuleInit {
  private keywordCache: Map<string, Set<string>> = new Map();

  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    const keywords = await this.prisma.chatKeyword.findMany();
    for (const kw of keywords) {
      if (!this.keywordCache.has(kw.tenantId)) {
        this.keywordCache.set(kw.tenantId, new Set());
      }
      this.keywordCache.get(kw.tenantId)!.add(kw.word.toLowerCase());
    }
  }

  async sendMessage(dto: SendMessageDto) {
    if (dto.content.length > MAX_MESSAGE_LENGTH) {
      throw new BadRequestException(
        `Xabar ${MAX_MESSAGE_LENGTH} belgidan uzun bo'lmasligi kerak`,
      );
    }

    const tenantKeywords = this.keywordCache.get(dto.tenantId);
    if (tenantKeywords) {
      const lower = dto.content.toLowerCase();
      for (const kw of tenantKeywords) {
        if (lower.includes(kw)) {
          throw new BadRequestException("Xabar taqiqlangan so'z o'z ichiga oldi");
        }
      }
    }

    const ban = await this.prisma.chatBan.findFirst({
      where: {
        userId: dto.senderId,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    });
    if (ban) throw new ForbiddenException('Siz chat dan ban olindingiz');

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dailyCount = await this.prisma.groupMessage.count({
      where: {
        senderId: dto.senderId,
        groupId: dto.groupId,
        isDeleted: false,
        createdAt: { gte: today },
      },
    });
    if (dailyCount >= MAX_DAILY_MESSAGES) {
      throw new BadRequestException(`Kunlik ${MAX_DAILY_MESSAGES} ta xabar limiti to'ldi`);
    }

    return this.prisma.groupMessage.create({
      data: dto,
      include: { sender: { select: { name: true, role: true } } },
    });
  }

  async getGroupMessages(groupId: string, limit = 50) {
    return this.prisma.groupMessage.findMany({
      where: { groupId, isDeleted: false },
      include: {
        sender: { select: { name: true, role: true } },
        reactions: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async deleteMessage(messageId: string, deletedBy: string) {
    return this.prisma.groupMessage.update({
      where: { id: messageId },
      data: { isDeleted: true, deletedBy, deletedAt: new Date() },
    });
  }

  async addReaction(messageId: string, userId: string, emoji: string) {
    if (!ALLOWED_EMOJIS.includes(emoji)) {
      throw new BadRequestException(`Faqat quyidagi emoji ruxsat: ${ALLOWED_EMOJIS.join(' ')}`);
    }
    return this.prisma.messageReaction.upsert({
      where: { messageId_userId_emoji: { messageId, userId, emoji } },
      create: { messageId, userId, emoji },
      update: {},
    });
  }

  async banUser(userId: string, bannedBy: string, reason: string, expiresAt?: Date) {
    return this.prisma.chatBan.create({
      data: { userId, bannedBy, reason, expiresAt },
    });
  }

  async addKeyword(tenantId: string, word: string): Promise<void> {
    await this.prisma.chatKeyword.create({ data: { tenantId, word } });
    if (!this.keywordCache.has(tenantId)) {
      this.keywordCache.set(tenantId, new Set());
    }
    this.keywordCache.get(tenantId)!.add(word.toLowerCase());
  }

  async removeKeyword(tenantId: string, word: string): Promise<void> {
    await this.prisma.chatKeyword.delete({
      where: { tenantId_word: { tenantId, word } },
    });
    this.keywordCache.get(tenantId)?.delete(word.toLowerCase());
  }

  async getKeywords(tenantId: string): Promise<string[]> {
    const rows = await this.prisma.chatKeyword.findMany({ where: { tenantId } });
    return rows.map((r) => r.word);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd apps/api
npx jest chat.spec --no-coverage
```

Expected: 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/social/chat.service.ts apps/api/src/social/chat.spec.ts
git commit -m "feat(social): DB-backed tenant-scoped keyword moderation in ChatService"
```

---

## Task 3: FriendsService — 13+ age check

**Files:**
- Modify: `apps/api/src/social/friends.service.ts`

- [ ] **Step 1: Write failing test**

Create `apps/api/src/social/friends.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { FriendsService } from './friends.service';
import { PrismaService } from '../prisma/prisma.service';

function dob(yearsAgo: number): Date {
  const d = new Date();
  d.setFullYear(d.getFullYear() - yearsAgo);
  return d;
}

const mockPrisma = {
  user: { findUnique: jest.fn() },
  friendship: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), findMany: jest.fn() },
  socialFeedEvent: { findMany: jest.fn() },
};

describe('FriendsService', () => {
  let service: FriendsService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        FriendsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get(FriendsService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('sendRequest', () => {
    it('throws ForbiddenException when sender is under 13', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', birthDate: dob(12) });

      await expect(service.sendRequest('u1', 'u2', 'b1')).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when sender has no birthDate', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', birthDate: null });

      await expect(service.sendRequest('u1', 'u2', 'b1')).rejects.toThrow(ForbiddenException);
    });

    it('creates friend request when sender is exactly 13', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', birthDate: dob(13) });
      mockPrisma.friendship.findUnique.mockResolvedValue(null);
      mockPrisma.friendship.create.mockResolvedValue({ id: 'f1', status: 'pending' });

      const result = await service.sendRequest('u1', 'u2', 'b1');

      expect(result.id).toBe('f1');
    });

    it('throws ConflictException when request already exists', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', birthDate: dob(15) });
      mockPrisma.friendship.findUnique.mockResolvedValue({ id: 'f1' });

      await expect(service.sendRequest('u1', 'u2', 'b1')).rejects.toThrow(ConflictException);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/api
npx jest friends.spec --no-coverage
```

Expected: FAIL — age check not implemented.

- [ ] **Step 3: Update sendRequest in friends.service.ts**

Replace the `sendRequest` method:

```typescript
async sendRequest(userId: string, friendId: string, branchId: string): Promise<Friendship> {
  const sender = await this.prisma.user.findUnique({
    where: { id: userId },
    select: { birthDate: true },
  });

  if (!sender?.birthDate) {
    throw new ForbiddenException('Filial darajasida do\'st qo\'shish uchun tug\'ilgan sana talab qilinadi');
  }

  const today = new Date();
  const age = today.getFullYear() - sender.birthDate.getFullYear() -
    (today < new Date(today.getFullYear(), sender.birthDate.getMonth(), sender.birthDate.getDate()) ? 1 : 0);

  if (age < 13) {
    throw new ForbiddenException('Filial darajasida do\'st qo\'shish uchun 13 yoshdan katta bo\'lish kerak');
  }

  const existing = await this.prisma.friendship.findUnique({
    where: { userId_friendId: { userId, friendId } },
  });
  if (existing) throw new ConflictException('Friend request already exists');

  return this.prisma.friendship.create({
    data: { userId, friendId, scope: branchId, status: 'pending' },
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd apps/api
npx jest friends.spec --no-coverage
```

Expected: 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/social/friends.service.ts apps/api/src/social/friends.spec.ts
git commit -m "feat(social): enforce 13+ age restriction for branch-level friend requests"
```

---

## Task 4: SocialGateway — duel emit methods

**Files:**
- Modify: `apps/api/src/social/social.gateway.ts`

- [ ] **Step 1: Add emitDuelChallenge and emitDuelResult to social.gateway.ts**

Add these two methods at the end of `SocialGateway` class, before the closing `}`:

```typescript
emitDuelChallenge(challengedId: string, data: {
  duelId: string;
  challengerName: string;
  expiresAt: string;
}) {
  this.server.to(`feed:${challengedId}`).emit('duel:challenged', data);
}

emitDuelResult(challengerId: string, challengedId: string, data: {
  duelId: string;
  winnerId: string;
  challengerScore: number;
  challengedScore: number;
}) {
  this.server.to(`feed:${challengerId}`).emit('duel:result', data);
  this.server.to(`feed:${challengedId}`).emit('duel:result', data);
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd apps/api
npx jest social --no-coverage 2>&1 | head -20
```

Expected: gateway compiles, any existing tests pass.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/social/social.gateway.ts
git commit -m "feat(social): add emitDuelChallenge and emitDuelResult to SocialGateway"
```

---

## Task 5: DuelService — inject gateway, emit real-time events

**Files:**
- Modify: `apps/api/src/social/duel.service.ts`

- [ ] **Step 1: Inject SocialGateway into DuelService**

In `apps/api/src/social/duel.service.ts`, update the imports and constructor:

```typescript
import { Injectable, BadRequestException, ForbiddenException, NotFoundException, forwardRef, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { XpService } from '../gamification/xp.service';
import { FeedEventService } from './feed-event.service';
import { SocialGateway } from './social.gateway';

@Injectable()
export class DuelService {
  constructor(
    private prisma: PrismaService,
    private xp: XpService,
    private feedEvent: FeedEventService,
    @Inject(forwardRef(() => SocialGateway))
    private gateway: SocialGateway,
  ) {}
```

- [ ] **Step 2: Emit duel:challenged after duel creation**

In the `create()` method, after `return this.prisma.duel.create(...)`, change to:

```typescript
const duel = await this.prisma.duel.create({
  data: {
    challengerId,
    challengedId,
    tenantId,
    questions: selectedQuestions,
    status: 'pending',
    expiresAt,
  },
  include: {
    challenger: { select: { name: true } },
  },
});

this.gateway.emitDuelChallenge(challengedId, {
  duelId: duel.id,
  challengerName: duel.challenger.name,
  expiresAt: duel.expiresAt.toISOString(),
});

return duel;
```

- [ ] **Step 3: Emit duel:result when duel completes**

In `submitAnswer()`, inside the `if (updated.count > 0)` block, after `await Promise.all([this.xp.award(...)])`, add:

```typescript
this.gateway.emitDuelResult(freshDuel.challengerId, freshDuel.challengedId, {
  duelId: freshDuel.id,
  winnerId,
  challengerScore: freshDuel.challengerScore,
  challengedScore: freshDuel.challengedScore,
});
```

- [ ] **Step 4: Update SocialModule to use forwardRef**

In `apps/api/src/social/social.module.ts`, update the providers array to handle the circular reference:

```typescript
import { Module, forwardRef } from '@nestjs/common';
// ... existing imports

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_SECRET'),
      }),
    }),
    GamificationModule,
  ],
  providers: [
    DuelService,
    DuelCron,
    ChatService,
    FriendsService,
    ChallengeService,
    FeedEventService,
    SocialGateway,
  ],
  controllers: [SocialController],
  exports: [DuelService, ChatService, FriendsService, ChallengeService, FeedEventService],
})
export class SocialModule {}
```

- [ ] **Step 5: Run all social tests**

```bash
cd apps/api
npx jest src/social --no-coverage
```

Expected: all passing (chat.spec: 7, friends.spec: 4, any existing duel tests).

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/social/duel.service.ts apps/api/src/social/social.module.ts
git commit -m "feat(social): emit duel:challenged and duel:result via WebSocket on duel events"
```

---

## Task 6: SocialController — keyword CRUD endpoints

**Files:**
- Modify: `apps/api/src/social/social.controller.ts`

- [ ] **Step 1: Add keyword endpoints to social.controller.ts**

Add the following imports to the top (add `Delete, Query` to the existing import):

```typescript
import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Request,
} from '@nestjs/common';
```

Add these three routes at the end of `SocialController` class, before `}`:

```typescript
@Get('keywords')
@Roles(UserRole.superadmin)
getKeywords(@Request() req: any) {
  return this.chat.getKeywords(req.user.tenantId);
}

@Post('keywords')
@Roles(UserRole.superadmin)
addKeyword(@Body('word') word: string, @Request() req: any) {
  return this.chat.addKeyword(req.user.tenantId, word);
}

@Delete('keywords/:word')
@Roles(UserRole.superadmin)
removeKeyword(@Param('word') word: string, @Request() req: any) {
  return this.chat.removeKeyword(req.user.tenantId, word);
}
```

- [ ] **Step 2: Verify API starts without error**

```bash
cd apps/api
npx jest chat.spec friends.spec --no-coverage
```

Expected: all 11 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/social/social.controller.ts
git commit -m "feat(social): add GET/POST/DELETE /social/keywords endpoints for superadmin"
```

---

## Task 7: Frontend — DuelNotificationProvider

**Files:**
- Create: `apps/web/app/(dashboard)/_components/DuelNotificationProvider.tsx`
- Modify: `apps/web/app/(dashboard)/layout.tsx`

- [ ] **Step 1: Create DuelNotificationProvider.tsx**

Create `apps/web/app/(dashboard)/_components/DuelNotificationProvider.tsx`:

```tsx
'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import { apiRequest } from '@/lib/api';

interface DuelChallenge {
  duelId: string;
  challengerName: string;
  expiresAt: string;
}

interface DuelResult {
  duelId: string;
  winnerId: string;
  challengerScore: number;
  challengedScore: number;
}

function getUserId(): string {
  try {
    const token = localStorage.getItem('accessToken') ?? '';
    const payload = JSON.parse(atob(token.split('.')[1])) as { sub?: string; userId?: string };
    return payload.sub ?? payload.userId ?? '';
  } catch {
    return '';
  }
}

function getUserRole(): string {
  try {
    const raw = localStorage.getItem('user') ?? '{}';
    const user = JSON.parse(raw) as { role?: string };
    return user.role ?? '';
  } catch {
    return '';
  }
}

export default function DuelNotificationProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const socketRef = useRef<Socket | null>(null);
  const [challenge, setChallenge] = useState<DuelChallenge | null>(null);
  const [result, setResult] = useState<{ message: string } | null>(null);
  const [responding, setResponding] = useState(false);

  useEffect(() => {
    const role = getUserRole();
    if (role !== 'student') return;

    const token = localStorage.getItem('accessToken') ?? '';
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

    const socket = io(`${apiUrl}/social`, { auth: { token } });
    socketRef.current = socket;

    socket.on('duel:challenged', (data: DuelChallenge) => {
      setChallenge(data);
      setTimeout(() => setChallenge(null), 30_000);
    });

    socket.on('duel:result', (data: DuelResult) => {
      const myId = getUserId();
      const won = data.winnerId === myId;
      const xp = won ? '+150 XP' : '+30 XP';
      const score = `${data.challengerScore}-${data.challengedScore}`;
      setResult({ message: won ? `🏆 Yutdingiz! ${score} ${xp}` : `😔 Yutqazdingiz ${score} ${xp}` });
      setTimeout(() => setResult(null), 5_000);
    });

    return () => { socket.disconnect(); };
  }, []);

  async function accept() {
    if (!challenge || responding) return;
    setResponding(true);
    try {
      const token = localStorage.getItem('accessToken') ?? '';
      await apiRequest(`/social/duels/${challenge.duelId}/respond`, {
        method: 'PATCH',
        body: JSON.stringify({ accept: true }),
      }, token);
      setChallenge(null);
      router.push(`/student/duel/${challenge.duelId}`);
    } catch {
      setResponding(false);
    }
  }

  async function decline() {
    if (!challenge || responding) return;
    setResponding(true);
    try {
      const token = localStorage.getItem('accessToken') ?? '';
      await apiRequest(`/social/duels/${challenge.duelId}/respond`, {
        method: 'PATCH',
        body: JSON.stringify({ accept: false }),
      }, token);
    } catch {
      // ignore
    } finally {
      setChallenge(null);
      setResponding(false);
    }
  }

  return (
    <>
      {challenge && (
        <div className="fixed top-16 left-0 right-0 z-50 flex justify-center px-4 pointer-events-none">
          <div className="bg-white rounded-2xl shadow-xl border border-indigo-200 p-4 w-full max-w-sm pointer-events-auto">
            <p className="font-semibold text-gray-900">⚔️ Duel taklifi!</p>
            <p className="text-sm text-gray-600 mt-1">
              <span className="font-medium text-indigo-600">{challenge.challengerName}</span> sizni duelga chaqirdi
            </p>
            <div className="flex gap-2 mt-3">
              <button
                onClick={accept}
                disabled={responding}
                className="flex-1 bg-indigo-600 text-white py-2 rounded-xl text-sm font-medium disabled:opacity-50"
              >
                Qabul
              </button>
              <button
                onClick={decline}
                disabled={responding}
                className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-xl text-sm font-medium disabled:opacity-50"
              >
                Rad
              </button>
            </div>
          </div>
        </div>
      )}

      {result && (
        <div className="fixed top-16 left-0 right-0 z-50 flex justify-center px-4 pointer-events-none">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 px-5 py-3 pointer-events-auto">
            <p className="font-medium text-gray-800">{result.message}</p>
          </div>
        </div>
      )}

      {children}
    </>
  );
}
```

- [ ] **Step 2: Add DuelNotificationProvider to dashboard layout**

In `apps/web/app/(dashboard)/layout.tsx`, add the import and wrap `<main>`:

```tsx
import DuelNotificationProvider from './_components/DuelNotificationProvider';

// Inside return, wrap the entire return with DuelNotificationProvider:
return (
  <DuelNotificationProvider>
    <div className="flex flex-col min-h-screen bg-gray-50">
      <header className="sticky top-0 z-50 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-900 truncate max-w-[70%]">
          {user?.name ?? '...'}
        </p>
        <button
          onClick={handleLogout}
          className="text-xs text-red-500 hover:text-red-700 font-medium"
        >
          Chiqish
        </button>
      </header>
      <main className="flex-1 overflow-y-auto p-4 pb-24">{children}</main>
      <BottomNav />
    </div>
  </DuelNotificationProvider>
);
```

- [ ] **Step 3: TypeScript check**

```bash
cd apps/web
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/\(dashboard\)/_components/DuelNotificationProvider.tsx apps/web/app/\(dashboard\)/layout.tsx
git commit -m "feat(web): add DuelNotificationProvider — real-time duel challenge/result toasts for students"
```

---

## Task 8: Frontend — Group challenge widget in chat page

**Files:**
- Modify: `apps/web/app/(dashboard)/student/groups/[id]/chat/page.tsx`

- [ ] **Step 1: Add challenge state and fetch to GroupChatPage**

Add the following type and state to `GroupChatPage`, after the existing type definitions:

```typescript
type GroupChallenge = {
  id: string;
  groupAId: string;
  groupBId: string;
  groupAXp: number;
  groupBXp: number;
  endDate: string;
  status: string;
};
```

Add this state inside the component, after the existing `useState` declarations:

```typescript
const [challenge, setChallenge] = useState<GroupChallenge | null>(null);
```

Add this fetch inside `useEffect`, after `fetchMessages()`:

```typescript
// fetch active challenge for this group
const token = localStorage.getItem('accessToken') ?? '';
apiRequest<GroupChallenge | null>(`/social/challenges/active/${groupId}`, {}, token)
  .then((res) => setChallenge(res.data))
  .catch(() => {});
```

- [ ] **Step 2: Add challenge widget above messages**

In the JSX, add this block immediately after the `<div className="bg-white border-b ...">` header div and before the `<div className="flex-1 overflow-y-auto ...">` messages div:

```tsx
{challenge && challenge.status === 'active' && (() => {
  const totalXp = challenge.groupAXp + challenge.groupBXp || 1;
  const aPercent = Math.round((challenge.groupAXp / totalXp) * 100);
  const daysLeft = Math.max(0, Math.ceil((new Date(challenge.endDate).getTime() - Date.now()) / 86400000));
  return (
    <div className="bg-indigo-50 border-b border-indigo-100 px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-indigo-700">⚔️ Guruh raqobati</p>
        <p className="text-xs text-indigo-500">{daysLeft} kun qoldi</p>
      </div>
      <div className="flex items-center gap-2 text-xs text-gray-600">
        <span className="font-medium truncate max-w-[80px]">Guruh A</span>
        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-500 rounded-full transition-all"
            style={{ width: `${aPercent}%` }}
          />
        </div>
        <span className="font-medium truncate max-w-[80px] text-right">Guruh B</span>
      </div>
      <div className="flex justify-between text-xs text-gray-500 mt-1">
        <span>{challenge.groupAXp} XP</span>
        <span>{challenge.groupBXp} XP</span>
      </div>
    </div>
  );
})()}
```

- [ ] **Step 3: TypeScript check**

```bash
cd apps/web
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/\(dashboard\)/student/groups/\[id\]/chat/page.tsx
git commit -m "feat(web): add group challenge progress widget to group chat page"
```

---

## Task 9: Frontend — Superadmin keyword management

**Files:**
- Create: `apps/web/app/(dashboard)/superadmin/keywords/page.tsx`
- Modify: `apps/web/app/(dashboard)/superadmin/page.tsx`

- [ ] **Step 1: Create keywords/page.tsx**

Create `apps/web/app/(dashboard)/superadmin/keywords/page.tsx`:

```tsx
'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiRequest } from '@/lib/api';

export default function KeywordsPage() {
  const router = useRouter();
  const [keywords, setKeywords] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const token = localStorage.getItem('accessToken') ?? '';
    try {
      const res = await apiRequest<string[]>('/social/keywords', {}, token);
      setKeywords(res.data ?? []);
    } catch {
      setError('Yuklab bo\'lmadi');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleAdd() {
    const word = input.trim().toLowerCase();
    if (!word) return;
    setAdding(true);
    setError('');
    try {
      const token = localStorage.getItem('accessToken') ?? '';
      await apiRequest('/social/keywords', {
        method: 'POST',
        body: JSON.stringify({ word }),
      }, token);
      setInput('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Qo\'shib bo\'lmadi');
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(word: string) {
    const token = localStorage.getItem('accessToken') ?? '';
    try {
      await apiRequest(`/social/keywords/${encodeURIComponent(word)}`, {
        method: 'DELETE',
      }, token);
      setKeywords((prev) => prev.filter((w) => w !== word));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'O\'chirib bo\'lmadi');
    }
  }

  return (
    <div className="max-w-xl space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600">←</button>
        <h1 className="text-2xl font-bold">🚫 Taqiqlangan So&apos;zlar</h1>
      </div>

      <div className="bg-white rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder="Yangi so'z kiriting..."
            className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          <button
            onClick={handleAdd}
            disabled={adding || !input.trim()}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {adding ? '...' : 'Qo\'shish'}
          </button>
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        {loading ? (
          <p className="text-gray-400 text-sm text-center py-4">Yuklanmoqda...</p>
        ) : keywords.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-4">Hali taqiqlangan so&apos;z yo&apos;q</p>
        ) : (
          <ul className="space-y-2">
            {keywords.map((word) => (
              <li key={word} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                <span className="text-sm text-gray-800 font-mono">{word}</span>
                <button
                  onClick={() => handleRemove(word)}
                  className="text-red-400 hover:text-red-600 text-lg leading-none"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add keywords card to superadmin/page.tsx**

In `apps/web/app/(dashboard)/superadmin/page.tsx`, add this card inside the grid div, after the payments card:

```tsx
<Link
  href="/superadmin/keywords"
  className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow border border-transparent hover:border-indigo-200"
>
  <div className="text-3xl mb-2">🚫</div>
  <h2 className="font-semibold text-gray-900">Taqiqlangan So&apos;zlar</h2>
  <p className="text-sm text-gray-500 mt-1">Chat moderatsiyasi uchun kalit so&apos;zlar</p>
</Link>
```

- [ ] **Step 3: TypeScript check**

```bash
cd apps/web
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Run all API tests to confirm no regressions**

```bash
cd apps/api
npx jest --no-coverage 2>&1 | tail -10
```

Expected: chat.spec (7), friends.spec (4), all existing tests — same pass count as before, 3 pre-existing failures (prisma.spec, telegram.spec, progress.spec).

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/\(dashboard\)/superadmin/keywords/page.tsx apps/web/app/\(dashboard\)/superadmin/page.tsx
git commit -m "feat(web): add superadmin keyword management page with add/delete UI"
```

---

## Final: merge to master

- [ ] **Verify all API tests pass**

```bash
cd apps/api
npx jest --no-coverage 2>&1 | tail -5
```

Expected: 11 new tests (7 chat + 4 friends) + 153 existing = 164 passing. 3 pre-existing suite failures unchanged.

- [ ] **Verify web TypeScript clean**

```bash
cd apps/web
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Merge to master**

```bash
git checkout master
git merge feat/plan15-social-completeness
```
