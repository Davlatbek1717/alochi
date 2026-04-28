# Social Feature Completeness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the partially-built social features — add the `social_feed_events` table with a proper event emitter, finish the duel lifecycle (respond, auto-complete + XP, expiry cron), fix the broken chat (native WebSocket → socket.io-client), and wire front-end duel acceptance.

**Architecture:** A new `FeedEventService` in `social` module writes to `social_feed_events` and pushes real-time updates to friends via the existing `SocialGateway`. `ProgressService` and `DuelService` call it after key actions. The chat page migrates from the incompatible native `WebSocket` API to `socket.io-client` v4, which matches the server. `DuelService` gets respond/list/get/auto-complete/expiry logic, and `XpService` is injected via `GamificationModule` → `SocialModule` import (no circular deps).

**Tech Stack:** NestJS 10, Prisma 5, `@nestjs/schedule` (already registered), socket.io v4 server, socket.io-client v4 (new), Next.js 15, TypeScript

---

## Working Directory

All backend paths are relative to `apps/api/src/`, all frontend to `apps/web/`.

---

## File Map

| Action | Path |
|--------|------|
| Create | `apps/api/src/social/feed-event.service.ts` |
| Create | `apps/api/src/social/duel.cron.ts` |
| Modify | `prisma/schema.prisma` |
| Modify | `apps/api/src/social/social.module.ts` |
| Modify | `apps/api/src/social/social.controller.ts` |
| Modify | `apps/api/src/social/duel.service.ts` |
| Modify | `apps/api/src/social/friends.service.ts` |
| Modify | `apps/api/src/social/social.gateway.ts` |
| Modify | `apps/api/src/lesson-progress/progress.service.ts` |
| Modify | `apps/api/src/lesson-progress/progress.module.ts` |
| Modify | `apps/web/app/(dashboard)/student/groups/[id]/chat/page.tsx` |
| Modify | `apps/web/app/(dashboard)/student/_components/SocialFeed.tsx` |
| Modify | `apps/web/app/(dashboard)/student/duel/[id]/page.tsx` |
| Modify | `apps/web/app/(dashboard)/student/friends/page.tsx` |

---

## Task 1: Add `social_feed_events` Prisma model + migration

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add `SocialFeedEvent` model and User relation**

Open `prisma/schema.prisma`. After the `ChatBan` model (line ~591), append:

```prisma
model SocialFeedEvent {
  id        String   @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  tenantId  String   @map("tenant_id") @db.Uuid
  actorId   String   @map("actor_id") @db.Uuid
  eventType String   @map("event_type")
  meta      Json     @default("{}")
  createdAt DateTime @default(now()) @map("created_at")

  actor User @relation("FeedEventActor", fields: [actorId], references: [id])

  @@index([actorId, createdAt])
  @@map("social_feed_events")
}
```

In the same file, find the `model User` block (around line 97) and add the relation line **before** the closing `@@unique`:

```prisma
  feedEvents         SocialFeedEvent[]   @relation("FeedEventActor")
```

- [ ] **Step 2: Run migration**

```bash
cd d:/projects/alochi/apps/api
npx prisma migrate dev --name add_social_feed_events
```

Expected: `✓ Generated Prisma Client` with migration applied.

- [ ] **Step 3: Verify Prisma Client regenerated**

```bash
npx prisma generate
```

Expected: `✓ Generated Prisma Client (v5.x.x)` — no errors.

- [ ] **Step 4: Commit**

```bash
cd d:/projects/alochi
git add prisma/schema.prisma apps/api/prisma/migrations/
git commit -m "feat(db): add social_feed_events table"
```

---

## Task 2: Create `FeedEventService`

**Files:**
- Create: `apps/api/src/social/feed-event.service.ts`
- Modify: `apps/api/src/social/social.module.ts`

- [ ] **Step 1: Create the service file**

```typescript
// apps/api/src/social/feed-event.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SocialGateway } from './social.gateway';

@Injectable()
export class FeedEventService {
  constructor(
    private prisma: PrismaService,
    private gateway: SocialGateway,
  ) {}

  async emit(
    tenantId: string,
    actorId: string,
    eventType: string,
    meta: Record<string, unknown> = {},
  ): Promise<void> {
    const event = await this.prisma.socialFeedEvent.create({
      data: { tenantId, actorId, eventType, meta },
      include: { actor: { select: { name: true } } },
    });

    const friendships = await this.prisma.friendship.findMany({
      where: {
        status: 'accepted',
        OR: [{ userId: actorId }, { friendId: actorId }],
      },
    });

    const friendIds = friendships.map((f) =>
      f.userId === actorId ? f.friendId : f.userId,
    );

    if (friendIds.length > 0) {
      this.gateway.broadcastFeedEvent(friendIds, {
        type: eventType,
        data: {
          actorId,
          actorName: event.actor.name,
          meta,
          createdAt: event.createdAt.toISOString(),
        },
      });
    }
  }
}
```

- [ ] **Step 2: Register and export in SocialModule**

Replace `apps/api/src/social/social.module.ts` with:

```typescript
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { DuelService } from './duel.service';
import { ChatService } from './chat.service';
import { FriendsService } from './friends.service';
import { ChallengeService } from './challenge.service';
import { FeedEventService } from './feed-event.service';
import { SocialGateway } from './social.gateway';
import { SocialController } from './social.controller';
import { GamificationModule } from '../gamification/gamification.module';

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
  providers: [DuelService, ChatService, FriendsService, ChallengeService, FeedEventService, SocialGateway],
  controllers: [SocialController],
  exports: [DuelService, ChatService, FriendsService, ChallengeService, FeedEventService],
})
export class SocialModule {}
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd d:/projects/alochi/apps/api
npx tsc --noEmit 2>&1 | grep -v "node_modules" | head -20
```

Expected: 0 errors in project source files.

- [ ] **Step 4: Commit**

```bash
cd d:/projects/alochi
git add apps/api/src/social/
git commit -m "feat(api): add FeedEventService and wire GamificationModule into SocialModule"
```

---

## Task 3: Emit `lesson_done` feed event when academy completed

**Files:**
- Modify: `apps/api/src/lesson-progress/progress.service.ts`
- Modify: `apps/api/src/lesson-progress/progress.module.ts`

- [ ] **Step 1: Inject FeedEventService into ProgressService**

Replace `apps/api/src/lesson-progress/progress.service.ts` with:

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FeedEventService } from '../social/feed-event.service';

@Injectable()
export class ProgressService {
  constructor(
    private prisma: PrismaService,
    private feedEvent: FeedEventService,
  ) {}

  private async getEffectiveN(studentId: string, lessonId: string, tenantId: string): Promise<number> {
    const lesson = await this.prisma.lesson.findFirst({ where: { id: lessonId, tenantId } });
    if (!lesson) throw new NotFoundException('Dars topilmadi');

    const override = await this.prisma.studentLessonConfig.findUnique({
      where: { studentId_lessonId: { studentId, lessonId } },
    });

    if (override) return Math.min(override.nRepetitionsOverride, lesson.maxNOverride);
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
    const result = await this.prisma.studentProgress.update({
      where: { studentId_lessonId: { studentId, lessonId } },
      data: { academyCompleted: true, completedAt: new Date() },
    });

    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      select: { title: true, tenantId: true },
    });

    if (lesson) {
      this.feedEvent
        .emit(lesson.tenantId, studentId, 'lesson_done', {
          lessonId,
          lessonTitle: lesson.title,
        })
        .catch(() => {});
    }

    return result;
  }

  async getStudentProgress(studentId: string) {
    return this.prisma.studentProgress.findMany({
      where: { studentId },
      include: { lesson: { select: { id: true, title: true, orderNumber: true } } },
      orderBy: { lesson: { orderNumber: 'asc' } },
    });
  }
}
```

- [ ] **Step 2: Import SocialModule in ProgressModule**

Replace `apps/api/src/lesson-progress/progress.module.ts` with:

```typescript
import { Module } from '@nestjs/common';
import { ProgressService } from './progress.service';
import { ProgressController } from './progress.controller';
import { SocialModule } from '../social/social.module';

@Module({
  imports: [SocialModule],
  providers: [ProgressService],
  controllers: [ProgressController],
  exports: [ProgressService],
})
export class ProgressModule {}
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd d:/projects/alochi/apps/api
npx tsc --noEmit 2>&1 | grep -v "node_modules" | head -20
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
cd d:/projects/alochi
git add apps/api/src/lesson-progress/
git commit -m "feat(api): emit lesson_done feed event when academy session completed"
```

---

## Task 4: Complete duel lifecycle — respond, auto-complete, XP, expiry cron, list/get endpoints

**Files:**
- Modify: `apps/api/src/social/duel.service.ts`
- Modify: `apps/api/src/social/social.controller.ts`
- Create: `apps/api/src/social/duel.cron.ts`
- Modify: `apps/api/src/social/social.module.ts` (add DuelCron)

- [ ] **Step 1: Rewrite `duel.service.ts`**

Replace the entire file:

```typescript
import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { XpService } from '../gamification/xp.service';
import { FeedEventService } from './feed-event.service';

@Injectable()
export class DuelService {
  constructor(
    private prisma: PrismaService,
    private xp: XpService,
    private feedEvent: FeedEventService,
  ) {}

  async create(challengerId: string, challengedId: string, tenantId: string) {
    const active = await this.prisma.duel.count({
      where: {
        status: 'active',
        OR: [{ challengerId }, { challengedId: challengerId }],
      },
    });
    if (active >= 2) {
      throw new BadRequestException('Bir vaqtda faqat 2 ta faol duel bo\'lishi mumkin');
    }

    const [aProgress, bProgress] = await Promise.all([
      this.prisma.studentProgress.findMany({
        where: { studentId: challengerId, academyCompleted: true },
        select: { lessonId: true },
      }),
      this.prisma.studentProgress.findMany({
        where: { studentId: challengedId, academyCompleted: true },
        select: { lessonId: true },
      }),
    ]);

    const aIds = new Set(aProgress.map((p) => p.lessonId));
    const sharedIds = bProgress.map((p) => p.lessonId).filter((id) => aIds.has(id));

    if (sharedIds.length === 0) {
      throw new BadRequestException('Umumiy bajarilgan dars topilmadi — duel uchun kamida 1 ta kerak');
    }

    const components = await this.prisma.lessonComponent.findMany({
      where: { type: 'mcq', lessonId: { in: sharedIds } },
    });

    const allQuestions = components.flatMap((c) => {
      const cfg = c.config as { questions?: unknown[] };
      return cfg.questions ?? [];
    });

    if (allQuestions.length < 10) {
      throw new BadRequestException('Duel uchun yetarli savol topilmadi (kamida 10 ta kerak)');
    }

    const selectedQuestions = [...allQuestions].sort(() => Math.random() - 0.5).slice(0, 10);

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    return this.prisma.duel.create({
      data: {
        challengerId,
        challengedId,
        tenantId,
        questions: selectedQuestions,
        status: 'pending',
        expiresAt,
      },
    });
  }

  async respond(duelId: string, userId: string, accept: boolean) {
    const duel = await this.prisma.duel.findUnique({ where: { id: duelId } });
    if (!duel) throw new NotFoundException('Duel topilmadi');
    if (duel.challengedId !== userId) throw new ForbiddenException('Ruxsat yo\'q');
    if (duel.status !== 'pending') throw new BadRequestException('Duel allaqachon boshlangan yoki rad etilgan');

    return this.prisma.duel.update({
      where: { id: duelId },
      data: { status: accept ? 'active' : 'rejected' },
    });
  }

  async submitAnswer(duelId: string, userId: string, questionIdx: number, answer: number) {
    const duel = await this.prisma.duel.findUnique({ where: { id: duelId } });
    if (!duel) throw new BadRequestException('Duel topilmadi');
    if (duel.status !== 'active') throw new BadRequestException('Duel faol emas');
    if (new Date() > duel.expiresAt) throw new BadRequestException('Duel muddati o\'tdi');

    const existing = await this.prisma.duelAnswer.findUnique({
      where: { duelId_userId_questionIdx: { duelId, userId, questionIdx } },
    });
    if (existing) throw new BadRequestException('Bu savol allaqachon javoblangan');

    const questions = duel.questions as Array<{ correct: number }>;
    const question = questions[questionIdx];
    const isCorrect = question != null && answer === question.correct;

    const isChallenger = userId === duel.challengerId;

    await this.prisma.duelAnswer.create({
      data: { duelId, userId, questionIdx, answer, isCorrect },
    });

    if (isCorrect) {
      await this.prisma.duel.update({
        where: { id: duelId },
        data: isChallenger
          ? { challengerScore: { increment: 1 } }
          : { challengedScore: { increment: 1 } },
      });
    }

    const [challengerCount, challengedCount] = await Promise.all([
      this.prisma.duelAnswer.count({ where: { duelId, userId: duel.challengerId } }),
      this.prisma.duelAnswer.count({ where: { duelId, userId: duel.challengedId } }),
    ]);

    if (challengerCount >= 10 && challengedCount >= 10) {
      const fresh = await this.prisma.duel.findUnique({ where: { id: duelId } });
      if (fresh && fresh.status === 'active') {
        const winnerId =
          fresh.challengerScore >= fresh.challengedScore
            ? fresh.challengerId
            : fresh.challengedId;
        const loserId = winnerId === fresh.challengerId ? fresh.challengedId : fresh.challengerId;

        await this.prisma.duel.update({ where: { id: duelId }, data: { status: 'completed', winnerId } });

        await Promise.all([
          this.xp.award(winnerId, 'DUEL_WIN'),
          this.xp.award(loserId, 'DUEL_PARTICIPATE'),
        ]);

        const winner = await this.prisma.user.findUnique({
          where: { id: winnerId },
          select: { tenantId: true },
        });
        if (winner) {
          this.feedEvent
            .emit(winner.tenantId, winnerId, 'duel_won', {
              opponentId: loserId,
              score: `${fresh.challengerScore}-${fresh.challengedScore}`,
            })
            .catch(() => {});
        }
      }
    }

    return { isCorrect };
  }

  async getDuel(duelId: string, requesterId: string) {
    const duel = await this.prisma.duel.findUnique({
      where: { id: duelId },
      include: {
        challenger: { select: { id: true, name: true } },
        challenged: { select: { id: true, name: true } },
      },
    });
    if (!duel) throw new NotFoundException('Duel topilmadi');

    const myAnswers = await this.prisma.duelAnswer.count({
      where: { duelId, userId: requesterId },
    });

    const winnerName =
      duel.winnerId === duel.challengerId
        ? duel.challenger.name
        : duel.winnerId === duel.challengedId
          ? duel.challenged.name
          : null;

    return {
      ...duel,
      challengerName: duel.challenger.name,
      challengedName: duel.challenged.name,
      currentQuestionIdx: myAnswers,
      winner: winnerName,
    };
  }

  async listDuels(userId: string) {
    const duels = await this.prisma.duel.findMany({
      where: { OR: [{ challengerId: userId }, { challengedId: userId }] },
      include: {
        challenger: { select: { id: true, name: true } },
        challenged: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return duels.map((d) => ({
      ...d,
      challengerName: d.challenger.name,
      challengedName: d.challenged.name,
    }));
  }

  async getResult(duelId: string) {
    return this.getDuel(duelId, '');
  }

  async expireOverdue(): Promise<void> {
    const expired = await this.prisma.duel.findMany({
      where: { status: 'active', expiresAt: { lt: new Date() } },
    });

    for (const duel of expired) {
      const challengedCount = await this.prisma.duelAnswer.count({
        where: { duelId: duel.id, userId: duel.challengedId },
      });

      if (challengedCount === 0) {
        await this.xp.award(duel.challengerId, 'DUEL_PARTICIPATE');
      }

      await this.prisma.duel.update({ where: { id: duel.id }, data: { status: 'expired' } });
    }

    await this.prisma.duel.updateMany({
      where: { status: 'pending', expiresAt: { lt: new Date() } },
      data: { status: 'expired' },
    });
  }
}
```

- [ ] **Step 2: Add duel endpoints to the controller**

In `apps/api/src/social/social.controller.ts`, add these routes after the existing duel routes (after `getDuelResult`):

```typescript
  @Patch('duels/:id/respond')
  respondToDuel(
    @Param('id') id: string,
    @Body() body: { accept: boolean },
    @Request() req: any,
  ) {
    return this.duel.respond(id, req.user.userId, body.accept);
  }

  @Get('duels')
  listDuels(@Request() req: any) {
    return this.duel.listDuels(req.user.userId);
  }

  @Get('duels/:id')
  getDuel(@Param('id') id: string, @Request() req: any) {
    return this.duel.getDuel(id, req.user.userId);
  }
```

Also add `Patch` to the imports at the top:

```typescript
import {
  Controller, Get, Post, Patch, Body, Param, UseGuards, Request,
} from '@nestjs/common';
```

- [ ] **Step 3: Create duel expiry cron**

```typescript
// apps/api/src/social/duel.cron.ts
import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DuelService } from './duel.service';

@Injectable()
export class DuelCron {
  constructor(private duel: DuelService) {}

  @Cron('*/5 * * * *')
  async handleExpiry() {
    await this.duel.expireOverdue();
  }
}
```

- [ ] **Step 4: Register DuelCron in SocialModule**

In `apps/api/src/social/social.module.ts`, add `DuelCron` to imports and providers:

```typescript
import { DuelCron } from './duel.cron';

// In @Module:
providers: [DuelService, ChatService, FriendsService, ChallengeService, FeedEventService, SocialGateway, DuelCron],
```

- [ ] **Step 5: Verify TypeScript**

```bash
cd d:/projects/alochi/apps/api
npx tsc --noEmit 2>&1 | grep -v "node_modules" | head -20
```

Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
cd d:/projects/alochi
git add apps/api/src/social/
git commit -m "feat(api): complete duel lifecycle — respond, auto-complete XP, expiry cron, list/get"
```

---

## Task 5: Fix chat — add `chat:join` to gateway, fix message shape

**Files:**
- Modify: `apps/api/src/social/social.gateway.ts`

The current gateway tries to join `group:<groupId>` from the JWT payload (which doesn't include `groupId`). Also, it broadcasts `chat:message` with `sender: { name, role }` but the frontend expects `senderName`.

- [ ] **Step 1: Rewrite `social.gateway.ts`**

```typescript
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ChatService } from './chat.service';

interface JwtPayload {
  userId: string;
  tenantId: string;
  role: string;
}

@WebSocketGateway({ cors: { origin: '*' }, namespace: '/social' })
export class SocialGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private jwt: JwtService,
    private chat: ChatService,
  ) {}

  async handleConnection(client: Socket) {
    const token = client.handshake.auth?.token as string | undefined;
    if (!token) {
      client.disconnect();
      return;
    }

    try {
      const payload = this.jwt.verify(token) as JwtPayload;
      client.data.user = payload;
      client.join(`feed:${payload.userId}`);
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(_client: Socket) {}

  @SubscribeMessage('chat:join')
  handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { groupId: string },
  ) {
    if (data?.groupId) {
      client.join(`group:${data.groupId}`);
    }
  }

  @SubscribeMessage('chat:send')
  async handleChatMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { groupId: string; content: string },
  ) {
    const user = client.data.user as JwtPayload | undefined;
    if (!user) return;

    try {
      const msg = await this.chat.sendMessage({
        tenantId: user.tenantId,
        groupId: data.groupId,
        senderId: user.userId,
        content: data.content,
      });

      this.server.to(`group:${data.groupId}`).emit('chat:message', {
        id: msg.id,
        content: msg.content,
        senderName: (msg as any).sender?.name ?? 'Unknown',
        createdAt: msg.createdAt,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      client.emit('chat:error', { message });
    }
  }

  @SubscribeMessage('feed:subscribe')
  handleFeedSubscribe(@ConnectedSocket() client: Socket) {
    const user = client.data.user as JwtPayload | undefined;
    if (user?.userId) {
      client.join(`feed:${user.userId}`);
    }
  }

  broadcastFeedEvent(userIds: string[], event: { type: string; data: object }) {
    for (const id of userIds) {
      this.server.to(`feed:${id}`).emit('feed:event', event);
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
cd d:/projects/alochi
git add apps/api/src/social/social.gateway.ts
git commit -m "fix(api): chat:join handler, fix message shape (senderName), auto-join feed room on connect"
```

---

## Task 6: Update `GET /social/feed` to use `social_feed_events`

**Files:**
- Modify: `apps/api/src/social/friends.service.ts`

The current `getFeed` uses `studentProgress` as a fallback. Replace with proper `socialFeedEvent` queries.

- [ ] **Step 1: Rewrite `getFeed` in `friends.service.ts`**

Replace the existing `getFeed` method (leave `sendRequest`, `respond`, `getFriends`, `getPendingRequests` unchanged):

```typescript
  async getFeed(userId: string, tenantId: string): Promise<object[]> {
    const friendships = await this.prisma.friendship.findMany({
      where: {
        status: 'accepted',
        OR: [{ userId }, { friendId: userId }],
      },
    });

    if (friendships.length === 0) return [];

    const friendIds = friendships.map((f) =>
      f.userId === userId ? f.friendId : f.userId,
    );

    const events = await this.prisma.socialFeedEvent.findMany({
      where: { actorId: { in: friendIds } },
      include: { actor: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return events
      .filter((e) => e.actor != null)
      .map((e) => ({
        id: e.id,
        actorId: e.actorId,
        actorName: e.actor.name,
        eventType: e.eventType,
        meta: e.meta as Record<string, unknown>,
        createdAt: e.createdAt.toISOString(),
      }));
  }
```

Also update the `getFeed` call in the controller. In `social.controller.ts`, the `GET /social/feed` handler currently calls `this.friends.getFeed(req.user.userId, req.user.tenantId)` — this is already correct from Plan 8.

- [ ] **Step 2: Verify TypeScript**

```bash
cd d:/projects/alochi/apps/api
npx tsc --noEmit 2>&1 | grep -v "node_modules" | head -20
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
cd d:/projects/alochi
git add apps/api/src/social/friends.service.ts
git commit -m "feat(api): GET /social/feed now reads from social_feed_events table"
```

---

## Task 7: Migrate chat page to socket.io-client

**Files:**
- Modify: `apps/web/app/(dashboard)/student/groups/[id]/chat/page.tsx`

The current page uses native `WebSocket` which is incompatible with socket.io. This means chat is completely non-functional. Install `socket.io-client` and rewrite the connection logic.

- [ ] **Step 1: Install socket.io-client**

```bash
cd d:/projects/alochi/apps/web
pnpm add socket.io-client
```

Expected: `dependencies: { "socket.io-client": "^4.x.x" }`

- [ ] **Step 2: Rewrite the chat page**

Replace the entire `apps/web/app/(dashboard)/student/groups/[id]/chat/page.tsx`:

```typescript
'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import { apiRequest } from '@/lib/api';

type Reaction = {
  emoji: string;
  count: number;
};

type Message = {
  id: string;
  senderName: string;
  content: string;
  createdAt: string;
  reactions?: Reaction[];
};

const EMOJIS = ['👍', '❤️', '💪', '🔥', '🎉'];

export default function GroupChatPage() {
  const params = useParams();
  const groupId = params?.id as string;

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [input, setInput] = useState('');
  const [connected, setConnected] = useState(false);
  const [reactingTo, setReactingTo] = useState<string | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchMessages = useCallback(async () => {
    const token = localStorage.getItem('accessToken') ?? '';
    try {
      const res = await apiRequest<Message[]>(`/social/groups/${groupId}/messages`, {}, token);
      setMessages(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xabarlarni yuklashda xato');
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    if (!groupId) return;
    fetchMessages();

    const token = localStorage.getItem('accessToken') ?? '';
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

    const socket = io(`${apiUrl}/social`, {
      auth: { token },
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('chat:join', { groupId });
    });

    socket.on('disconnect', () => setConnected(false));

    socket.on('chat:message', (msg: Message) => {
      setMessages((prev) => [...prev, msg]);
    });

    socket.on('chat:error', (data: { message: string }) => {
      alert(data.message);
    });

    return () => {
      socket.disconnect();
    };
  }, [groupId, fetchMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function sendMessage() {
    if (!input.trim() || !socketRef.current?.connected) return;
    socketRef.current.emit('chat:send', { groupId, content: input.trim() });
    setInput('');
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') sendMessage();
  }

  async function handleReact(messageId: string, emoji: string) {
    const token = localStorage.getItem('accessToken') ?? '';
    setReactingTo(null);
    try {
      await apiRequest(`/social/messages/${messageId}/react`, {
        method: 'POST',
        body: JSON.stringify({ emoji }),
      }, token);
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== messageId) return m;
          const existing = m.reactions?.find((r) => r.emoji === emoji);
          if (existing) {
            return {
              ...m,
              reactions: m.reactions?.map((r) =>
                r.emoji === emoji ? { ...r, count: r.count + 1 } : r,
              ),
            };
          }
          return {
            ...m,
            reactions: [...(m.reactions ?? []), { emoji, count: 1 }],
          };
        }),
      );
    } catch {
      // ignore reaction errors
    }
  }

  function formatTime(iso: string) {
    try {
      return new Date(iso).toLocaleTimeString('uz', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  }

  if (loading) {
    return (
      <div className="max-w-lg mx-auto py-20 flex justify-center">
        <p className="text-gray-500">Yuklanmoqda...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-lg mx-auto py-10">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto flex flex-col h-[calc(100vh-80px)]">
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-gray-300'}`} />
          <h1 className="font-semibold text-gray-800">Guruh chati</h1>
        </div>
        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">
          20 xabar/kun
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 ? (
          <p className="text-center text-gray-400 text-sm mt-10">Hali xabarlar yo&apos;q</p>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className="space-y-1">
              <div className="bg-white rounded-2xl rounded-tl-sm px-3 py-2 shadow-sm border border-gray-100 inline-block max-w-[85%]">
                <p className="text-xs text-indigo-600 font-medium mb-0.5">{msg.senderName}</p>
                <p className="text-sm text-gray-800">{msg.content}</p>
                <div className="flex items-center justify-between gap-2 mt-1">
                  <p className="text-xs text-gray-400">{formatTime(msg.createdAt)}</p>
                  <button
                    onClick={() => setReactingTo(reactingTo === msg.id ? null : msg.id)}
                    className="text-xs text-gray-400 hover:text-gray-600"
                  >
                    😊
                  </button>
                </div>
              </div>

              {reactingTo === msg.id && (
                <div className="flex gap-1 ml-1">
                  {EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => handleReact(msg.id, emoji)}
                      className="text-xl hover:scale-125 transition-transform"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}

              {msg.reactions && msg.reactions.length > 0 && (
                <div className="flex gap-1 ml-1 flex-wrap">
                  {msg.reactions.map((r) => (
                    <span key={r.emoji} className="bg-gray-100 text-xs px-2 py-0.5 rounded-full">
                      {r.emoji} {r.count}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <div className="bg-white border-t border-gray-100 px-4 py-3">
        <div className="flex gap-2 items-center">
          <div className="flex-1 relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value.slice(0, 200))}
              onKeyDown={handleKeyDown}
              placeholder="Xabar yozing..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
              {input.length}/200
            </span>
          </div>
          <button
            onClick={sendMessage}
            disabled={!connected || !input.trim()}
            className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-50 shrink-0"
          >
            ➤
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

```bash
cd d:/projects/alochi/apps/web
npx tsc --noEmit 2>&1 | grep "chat/page" | head -10
```

Expected: 0 errors for `chat/page.tsx`.

- [ ] **Step 4: Commit**

```bash
cd d:/projects/alochi
git add apps/web/app/\(dashboard\)/student/groups/ apps/web/package.json pnpm-lock.yaml
git commit -m "fix(web): replace native WebSocket with socket.io-client in group chat"
```

---

## Task 8: Update `SocialFeed` component for rich event types

**Files:**
- Modify: `apps/web/app/(dashboard)/student/_components/SocialFeed.tsx`

The current component shows `${item.userName} ${item.lessonTitle} darsini o'rgandi`. After Task 6, the feed returns `{ actorId, actorName, eventType, meta, createdAt }` instead.

- [ ] **Step 1: Rewrite `SocialFeed.tsx`**

Replace the entire file:

```typescript
'use client';
import { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';

type FeedItem = {
  id: string;
  actorId: string;
  actorName: string;
  eventType: string;
  meta: Record<string, unknown>;
  createdAt: string;
};

function relativeTime(isoDate: string): string {
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return '';
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);
  if (diffMin < 60) return `${diffMin} daqiqa oldin`;
  if (diffHour < 24) return `${diffHour} soat oldin`;
  return `${diffDay} kun oldin`;
}

function eventLabel(item: FeedItem): string {
  switch (item.eventType) {
    case 'lesson_done':
      return `${item.actorName} "${item.meta.lessonTitle as string}" darsini tugatdi! 📚`;
    case 'duel_won':
      return `${item.actorName} duelda g'olib bo'ldi! ⚔️`;
    case 'streak_milestone':
      return `${item.actorName} ${item.meta.streak as number} kunlik streak! 🔥`;
    default:
      return `${item.actorName} faol bo'ldi`;
  }
}

export function SocialFeed() {
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const token = localStorage.getItem('accessToken') ?? '';

    apiRequest<FeedItem[]>('/social/feed', {}, token)
      .then((res) => {
        if (!cancelled) setFeed(res.data);
      })
      .catch(() => {
        if (!cancelled) setFeed([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        <p className="text-sm text-gray-400 text-center">Yuklanmoqda...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
      <h2 className="font-semibold text-gray-700 mb-3 text-sm">Do&apos;stlar lentasi</h2>

      {feed.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">
          Do&apos;stlaringiz hali faol emas
        </p>
      ) : (
        <ul className="space-y-3">
          {feed.map((item) => (
            <li key={`${item.actorId}:${item.id}`} className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xs shrink-0">
                {item.actorName.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-800 leading-snug">{eventLabel(item)}</p>
                <p className="text-xs text-gray-400 mt-0.5">{relativeTime(item.createdAt)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd d:/projects/alochi/apps/web
npx tsc --noEmit 2>&1 | grep "SocialFeed" | head -10
```

Expected: 0 errors for `SocialFeed.tsx`.

- [ ] **Step 3: Commit**

```bash
cd d:/projects/alochi
git add apps/web/app/\(dashboard\)/student/_components/SocialFeed.tsx
git commit -m "feat(web): SocialFeed shows rich event types (lesson_done, duel_won, streak_milestone)"
```

---

## Task 9: Wire duel accept/reject in DuelPage + "Duelga chaqir" in FriendsPage

**Files:**
- Modify: `apps/web/app/(dashboard)/student/duel/[id]/page.tsx`
- Modify: `apps/web/app/(dashboard)/student/friends/page.tsx`

- [ ] **Step 1: Add respond buttons to DuelPage**

In `apps/web/app/(dashboard)/student/duel/[id]/page.tsx`:

Add a helper function to decode JWT (add before `export default function DuelPage`):

```typescript
function getCurrentUserId(): string {
  try {
    const token = localStorage.getItem('accessToken') ?? '';
    const payload = JSON.parse(atob(token.split('.')[1]));
    return (payload.userId ?? payload.sub ?? '') as string;
  } catch {
    return '';
  }
}
```

Add `handleRespond` function inside the component (after `handleAnswer`):

```typescript
  async function handleRespond(accept: boolean) {
    if (!duel) return;
    const token = localStorage.getItem('accessToken') ?? '';
    try {
      await apiRequest(`/social/duels/${id}/respond`, {
        method: 'PATCH',
        body: JSON.stringify({ accept }),
      }, token);
      await fetchDuel();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Xato yuz berdi');
    }
  }
```

Replace the existing `{duel.status === 'pending' && (...)}` block with:

```typescript
      {duel.status === 'pending' && (() => {
        const myId = getCurrentUserId();
        const isChallenged = myId === duel.challengedId;
        return isChallenged ? (
          <div className="bg-white rounded-2xl p-6 shadow-sm text-center border border-gray-100 space-y-4">
            <p className="text-4xl">⚡</p>
            <p className="font-medium text-gray-700">{duel.challengerName} sizi duelga chaqirdi!</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => handleRespond(true)}
                className="bg-green-500 text-white px-6 py-2 rounded-xl font-medium"
              >
                ✅ Qabul qilish
              </button>
              <button
                onClick={() => handleRespond(false)}
                className="bg-red-100 text-red-600 px-6 py-2 rounded-xl font-medium"
              >
                ❌ Rad etish
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl p-6 shadow-sm text-center border border-gray-100">
            <p className="text-4xl mb-3">⏳</p>
            <p className="font-medium text-gray-700">Raqib qabul qilishini kutmoqdamiz</p>
            <p className="text-sm text-gray-400 mt-1">So&apos;rov yuborildi</p>
          </div>
        );
      })()}
```

- [ ] **Step 2: Add `useRouter` import**

Ensure the import at the top includes:

```typescript
import { useParams, useRouter } from 'next/navigation';
```

And declare `const router = useRouter();` inside the component.

- [ ] **Step 3: Add "Duelga chaqir" button to FriendsPage**

In `apps/web/app/(dashboard)/student/friends/page.tsx`:

Add `useRouter` import and `router` declaration:

```typescript
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiRequest } from '@/lib/api';

// Inside component:
const router = useRouter();
```

Add `handleChallenge` function:

```typescript
  async function handleChallenge(friendId: string) {
    const token = localStorage.getItem('accessToken') ?? '';
    try {
      const res = await apiRequest<{ id: string }>('/social/duels', {
        method: 'POST',
        body: JSON.stringify({ challengedId: friendId }),
      }, token);
      router.push(`/student/duel/${res.data.id}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Xato yuz berdi');
    }
  }
```

In the friends list `<li>` element, add a button after the name:

```tsx
              <button
                onClick={() => handleChallenge(f.id)}
                className="text-xs bg-orange-100 text-orange-700 px-3 py-1.5 rounded-lg font-medium"
              >
                ⚡ Duel
              </button>
```

- [ ] **Step 4: Verify TypeScript**

```bash
cd d:/projects/alochi/apps/web
npx tsc --noEmit 2>&1 | grep -E "duel|friends" | head -10
```

Expected: 0 errors for these files.

- [ ] **Step 5: Commit**

```bash
cd d:/projects/alochi
git add apps/web/app/\(dashboard\)/student/duel/ apps/web/app/\(dashboard\)/student/friends/
git commit -m "feat(web): duel respond UI, Duelga chaqir button on friends page"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task covering it |
|---|---|
| Social feed events (`lesson_done`, `duel_won`) | Task 1+2+3+4 |
| `GET /social/feed` reads real events | Task 6 |
| SocialFeed rich event types | Task 8 |
| Duel respond (accept/reject) | Task 4 (API) + Task 9 (UI) |
| Duel auto-complete + XP award | Task 4 |
| Duel 24h expiry cron | Task 4 |
| `GET /social/duels`, `GET /social/duels/:id` | Task 4 |
| Chat WebSocket fix | Task 5 (gateway) + Task 7 (client) |
| `chat:join` event for group rooms | Task 5 |
| Duelga chaqir button on friends page | Task 9 |

**What's NOT in this plan (deferred):**
- Group challenge respond flow (requires Group model, not in DB schema yet)
- Challenge XP wiring (same reason)
- Streak milestone feed events (no streak hook currently)
- National leaderboard
- Moderation UI for Mentor

**Placeholder scan:** No TBDs or "implement later" statements found.

**Type consistency check:**
- `FeedItem` in Task 8 (`actorId, actorName, eventType, meta, createdAt`) matches `getFeed` return shape from Task 6
- `getDuel` returns `challengerName, challengedName, currentQuestionIdx, winner` — DuelPage types in Task 9 reference `duel.challengedId` which is returned from `getDuel` via spread of the Prisma Duel model ✅
- `FeedEventService.emit(tenantId, actorId, eventType, meta)` called consistently across Task 3 and Task 4

---

**Plan complete and saved to `docs/superpowers/plans/2026-04-25-plan9-social-completeness.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — fresh subagent per task, spec + quality review between tasks, fast iteration

**2. Inline Execution** — execute tasks in this session using executing-plans

**Which approach?**
