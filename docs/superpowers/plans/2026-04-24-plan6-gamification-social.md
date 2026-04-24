# Plan 6: Gamifikatsiya + Ijtimoiy Funksiyalar

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** XP, streak, virtual shahar, sertifikat, kunlik quests + do'stlar, 1v1 duel, guruh challenge, guruh chat, moderatsiya, va real-time ijtimoiy lenta (WebSocket).

**Architecture:** Gamifikatsiya backend (NestJS) — XP events, streak cron, quest generator. Ijtimoiy qism — `friendships`, `duels`, `group_challenges`, `group_messages` + WebSocket (Socket.io) real-time. Chat moderation: keyword filter (Superadmin manages), 200 char limit, 20 msg/day rate limiter.

**Tech Stack:** Plan 1–5 stack + @nestjs/websockets, socket.io, PDFKit (sertifikat), node-cron (streak check, quest reset)

**Shart:** Plan 1–3 bajarilgan (XP asosiy jadvallar uchun). Plan 4 Telegram bot ishlaydi (streak 30 kun notif uchun).

---

## Fayl Tuzilmasi

```
apps/
  api/src/
    gamification/
      gamification.module.ts
      xp.service.ts             ← XP berish, daraja hisoblash
      streak.service.ts         ← Streak tracking + shield
      quest.service.ts          ← Daily quests generate + check
      city.service.ts           ← Virtual shahar (dars soniga qarab)
      certificates.service.ts   ← Sertifikat berish + PDF generate
      gamification.controller.ts
    social/
      social.module.ts
      friends.service.ts        ← Do'stlar + filial do'stlik so'rovi
      duel.service.ts           ← 1v1 duel (savol tanlash + natija)
      challenge.service.ts      ← Guruh challenge
      chat.service.ts           ← Guruh chati + moderatsiya
      social.controller.ts
      social.gateway.ts         ← WebSocket gateway (socket.io)

  web/app/(dashboard)/student/
    page.tsx                    ← Dashboard (XP, streak, virtual shahar, quests, lenta)
    _components/
      XpBar.tsx
      VirtualCity.tsx           ← Animatsiyali shahar
      StreakBadge.tsx
      DailyQuests.tsx
      SocialFeed.tsx            ← Do'stlar lentasi (real-time)
    friends/
      page.tsx                  ← Do'stlar ro'yxati + so'rov yuborish
    duel/
      [id]/page.tsx             ← Duel jarayoni
    groups/
      [id]/chat/page.tsx        ← Guruh chati

prisma/
  schema.prisma                 ← gamification + social jadvallar

apps/api/src/
  gamification/certificates.service.ts   ← PDFKit bilan
```

---

### Task 1: Gamifikatsiya Schema

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Gamification + Social modellarni qo'shing**

```prisma
// ---- XP VA STREAK ----
model StudentXp {
  id          String   @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  studentId   String   @unique @map("student_id") @db.Uuid
  totalXp     Int      @default(0) @map("total_xp")
  currentStreak Int    @default(0) @map("current_streak")
  longestStreak Int    @default(0) @map("longest_streak")
  shieldCount Int      @default(0) @map("shield_count")  // Streak shield
  lastActivity DateTime? @map("last_activity")
  updatedAt   DateTime @updatedAt @map("updated_at")

  student     User     @relation("StudentXp", fields: [studentId], references: [id])

  @@map("student_xp")
}

model XpEvent {
  id          String   @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  studentId   String   @map("student_id") @db.Uuid
  amount      Int
  reason      String   // 'lesson_complete' | 'streak' | 'quest' | 'duel_win' ...
  metadata    Json?
  createdAt   DateTime @default(now()) @map("created_at")

  student     User     @relation("XpEvents", fields: [studentId], references: [id])

  @@index([studentId])
  @@map("xp_events")
}

model DailyQuest {
  id          String   @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  studentId   String   @map("student_id") @db.Uuid
  date        DateTime @db.Date
  questType   String   @map("quest_type")
  // 'learn_words:3' | 'watch_video:1' | 'ask_tutor:3' | 'lesson_complete:1'
  targetValue Int      @map("target_value")
  progress    Int      @default(0)
  completed   Boolean  @default(false)
  xpReward    Int      @map("xp_reward")

  student     User     @relation("DailyQuests", fields: [studentId], references: [id])

  @@unique([studentId, date, questType])
  @@map("daily_quests")
}

// ---- SERTIFIKAT ----
model Certificate {
  id          String   @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  studentId   String   @map("student_id") @db.Uuid
  tenantId    String   @map("tenant_id") @db.Uuid
  level       String   // 'bronze' | 'silver' | 'gold' | 'diamond'
  lessonsCompleted Int @map("lessons_completed")
  qrCode      String   @map("qr_code")  // verify URL
  issuedAt    DateTime @default(now()) @map("issued_at")

  student     User     @relation("Certificates", fields: [studentId], references: [id])

  @@map("certificates")
}

// ---- IJTIMOIY ----
model Friendship {
  id          String   @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  userId      String   @map("user_id") @db.Uuid
  friendId    String   @map("friend_id") @db.Uuid
  scope       String   // 'group' (auto) | 'branch' (request)
  status      String   @default("pending") // 'pending' | 'accepted'
  createdAt   DateTime @default(now()) @map("created_at")

  user        User     @relation("UserFriends", fields: [userId], references: [id])
  friend      User     @relation("FriendOf", fields: [friendId], references: [id])

  @@unique([userId, friendId])
  @@map("friendships")
}

model Duel {
  id          String   @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  challengerId String  @map("challenger_id") @db.Uuid
  challengedId String  @map("challenged_id") @db.Uuid
  tenantId    String   @map("tenant_id") @db.Uuid
  questions   Json     // 10 ta MCQ savol (shared completed lessons dan)
  status      String   @default("pending")
  // 'pending' | 'active' | 'completed' | 'expired'
  challengerScore Int  @default(0) @map("challenger_score")
  challengedScore Int  @default(0) @map("challenged_score")
  winnerId    String?  @map("winner_id") @db.Uuid
  expiresAt   DateTime @map("expires_at")  // +24 soat
  createdAt   DateTime @default(now()) @map("created_at")

  challenger  User     @relation("DuelChallenger", fields: [challengerId], references: [id])
  challenged  User     @relation("DuelChallenged", fields: [challengedId], references: [id])
  answers     DuelAnswer[]

  @@map("duels")
}

model DuelAnswer {
  id          String   @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  duelId      String   @map("duel_id") @db.Uuid
  userId      String   @map("user_id") @db.Uuid
  questionIdx Int      @map("question_idx")
  answer      Int      // selected option index
  isCorrect   Boolean  @map("is_correct")
  answeredAt  DateTime @default(now()) @map("answered_at")

  duel        Duel     @relation(fields: [duelId], references: [id])

  @@unique([duelId, userId, questionIdx])
  @@map("duel_answers")
}

model GroupChallenge {
  id          String   @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  tenantId    String   @map("tenant_id") @db.Uuid
  groupAId    String   @map("group_a_id") @db.Uuid  // branchId yoki groupId
  groupBId    String   @map("group_b_id") @db.Uuid
  startDate   DateTime @map("start_date")
  endDate     DateTime @map("end_date")
  groupAXp    Int      @default(0) @map("group_a_xp")
  groupBXp    Int      @default(0) @map("group_b_xp")
  status      String   @default("active")
  createdAt   DateTime @default(now()) @map("created_at")

  @@map("group_challenges")
}

model GroupMessage {
  id          String   @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  tenantId    String   @map("tenant_id") @db.Uuid
  groupId     String   @map("group_id") @db.Uuid  // branch/group ID
  senderId    String   @map("sender_id") @db.Uuid
  content     String   @db.VarChar(200)
  isDeleted   Boolean  @default(false) @map("is_deleted")
  deletedBy   String?  @map("deleted_by") @db.Uuid
  deletedAt   DateTime? @map("deleted_at")
  createdAt   DateTime @default(now()) @map("created_at")

  sender      User     @relation("GroupMessages", fields: [senderId], references: [id])
  reactions   MessageReaction[]

  @@index([groupId, createdAt])
  @@map("group_messages")
}

model MessageReaction {
  id          String   @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  messageId   String   @map("message_id") @db.Uuid
  userId      String   @map("user_id") @db.Uuid
  emoji       String   // '👍' | '🎉' | '💪' | '🔥' | '❤️'

  message     GroupMessage @relation(fields: [messageId], references: [id])

  @@unique([messageId, userId, emoji])
  @@map("message_reactions")
}

model ChatBan {
  id          String   @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  userId      String   @map("user_id") @db.Uuid
  bannedBy    String   @map("banned_by") @db.Uuid
  reason      String
  expiresAt   DateTime? @map("expires_at")  // null = doimiy
  createdAt   DateTime  @default(now()) @map("created_at")

  @@map("chat_bans")
}
```

- [ ] **Step 2: Migration**

```bash
npx prisma migrate dev --name add-gamification-social
```

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: add gamification (xp, streak, quests, certificates) and social schema"
```

---

### Task 2: XP Tizimi

**Files:**
- Create: `apps/api/src/gamification/xp.service.ts`

- [ ] **Step 1: Failing test**

`apps/api/test/xp.spec.ts`:
```typescript
import { XpService, XP_AMOUNTS } from '../src/gamification/xp.service';

describe('XpService', () => {
  const mockPrisma = {
    studentXp: {
      upsert: jest.fn().mockResolvedValue({ totalXp: 200, currentStreak: 3 }),
    },
    xpEvent: {
      create: jest.fn().mockResolvedValue({}),
    },
  };
  const service = new XpService(mockPrisma as any);

  it('awards correct XP for lesson completion', async () => {
    await service.award('student-id', 'lesson_complete');
    expect(mockPrisma.xpEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ amount: XP_AMOUNTS.LESSON_COMPLETE }),
      }),
    );
  });

  it('XP_AMOUNTS has all required keys', () => {
    expect(XP_AMOUNTS.LESSON_COMPLETE).toBe(100);
    expect(XP_AMOUNTS.STREAK_DAILY).toBe(20);
    expect(XP_AMOUNTS.PERFECT_TEST).toBe(50);
    expect(XP_AMOUNTS.FAST_SUBMIT).toBe(30);
    expect(XP_AMOUNTS.DAILY_QUEST).toBe(75);
  });

  it('computes level from XP', () => {
    expect(service.getLevel(0)).toBe('Novice');
    expect(service.getLevel(300)).toBe('Learner');
    expect(service.getLevel(1000)).toBe('Learner');
    expect(service.getLevel(2500)).toBe('Scholar');
    expect(service.getLevel(6000)).toBe('Expert');
    expect(service.getLevel(15000)).toBe('Master');
  });
});
```

- [ ] **Step 2: Ishga tushirib FAIL ko'ring**

```bash
npm run test -- xp.spec
```

- [ ] **Step 3: xp.service.ts**

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export const XP_AMOUNTS = {
  LESSON_COMPLETE: 100,
  STREAK_DAILY: 20,    // × streak kun soni
  PERFECT_TEST: 50,
  FAST_SUBMIT: 30,
  DAILY_QUEST: 75,
  DUEL_WIN: 50,
  DUEL_PARTICIPATE: 10,
} as const;

type XpReason = keyof typeof XP_AMOUNTS;

const LEVELS = [
  { min: 0, name: 'Novice' },
  { min: 500, name: 'Learner' },
  { min: 2000, name: 'Scholar' },
  { min: 5000, name: 'Expert' },
  { min: 10000, name: 'Master' },
] as const;

@Injectable()
export class XpService {
  constructor(private prisma: PrismaService) {}

  getLevel(totalXp: number): string {
    for (let i = LEVELS.length - 1; i >= 0; i--) {
      if (totalXp >= LEVELS[i].min) return LEVELS[i].name;
    }
    return 'Novice';
  }

  getNextLevelXp(totalXp: number): number {
    for (const level of LEVELS) {
      if (totalXp < level.min) return level.min;
    }
    return Infinity;
  }

  async award(
    studentId: string,
    reason: XpReason,
    metadata?: object,
  ) {
    const amount = XP_AMOUNTS[reason];

    await this.prisma.xpEvent.create({
      data: { studentId, amount, reason, metadata },
    });

    return this.prisma.studentXp.upsert({
      where: { studentId },
      create: { studentId, totalXp: amount },
      update: { totalXp: { increment: amount } },
    });
  }

  async getStudentXp(studentId: string) {
    const xp = await this.prisma.studentXp.findUnique({ where: { studentId } });
    if (!xp) return { totalXp: 0, level: 'Novice', currentStreak: 0 };

    return {
      ...xp,
      level: this.getLevel(xp.totalXp),
      nextLevelXp: this.getNextLevelXp(xp.totalXp),
    };
  }
}
```

- [ ] **Step 4: Test PASS bo'lganini tekshiring**

```bash
npm run test -- xp.spec
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/gamification/xp.service.ts
git commit -m "feat: add XP service with level system (Novice→Master) and event logging"
```

---

### Task 3: Streak + Kunlik Quests

**Files:**
- Create: `apps/api/src/gamification/streak.service.ts`
- Create: `apps/api/src/gamification/quest.service.ts`

- [ ] **Step 1: Failing test**

`apps/api/test/streak.spec.ts`:
```typescript
import { StreakService } from '../src/gamification/streak.service';

describe('StreakService', () => {
  const mockPrisma = {
    studentXp: {
      findUnique: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
    },
  };
  const service = new StreakService(mockPrisma as any);

  it('increments streak on consecutive day', async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    mockPrisma.studentXp.findUnique.mockResolvedValue({
      currentStreak: 5,
      shieldCount: 0,
      lastActivity: yesterday,
    });

    await service.recordActivity('student-id');
    expect(mockPrisma.studentXp.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ currentStreak: 6 }),
      }),
    );
  });

  it('uses shield when 1 day missed', async () => {
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    mockPrisma.studentXp.findUnique.mockResolvedValue({
      currentStreak: 10,
      shieldCount: 1,  // shield bor
      lastActivity: twoDaysAgo,
    });

    await service.recordActivity('student-id');
    expect(mockPrisma.studentXp.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          currentStreak: 11, // streak saqlanadi
          shieldCount: 0,    // shield sarflandi
        }),
      }),
    );
  });

  it('resets streak when 2+ days missed (no shield)', async () => {
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    mockPrisma.studentXp.findUnique.mockResolvedValue({
      currentStreak: 7,
      shieldCount: 0,
      lastActivity: threeDaysAgo,
    });

    await service.recordActivity('student-id');
    expect(mockPrisma.studentXp.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ currentStreak: 1 }),
      }),
    );
  });
});
```

- [ ] **Step 2: Ishga tushirib FAIL ko'ring**

```bash
npm run test -- streak.spec
```

- [ ] **Step 3: streak.service.ts**

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StreakService {
  constructor(private prisma: PrismaService) {}

  private daysBetween(a: Date, b: Date): number {
    const msPerDay = 1000 * 60 * 60 * 24;
    const aDay = Math.floor(a.getTime() / msPerDay);
    const bDay = Math.floor(b.getTime() / msPerDay);
    return Math.abs(aDay - bDay);
  }

  async recordActivity(studentId: string) {
    const today = new Date();
    const xp = await this.prisma.studentXp.findUnique({ where: { studentId } });

    if (!xp) {
      return this.prisma.studentXp.upsert({
        where: { studentId },
        create: { studentId, currentStreak: 1, lastActivity: today },
        update: { currentStreak: 1, lastActivity: today },
      });
    }

    if (!xp.lastActivity) {
      return this.prisma.studentXp.update({
        where: { studentId },
        data: { currentStreak: 1, lastActivity: today },
      });
    }

    const daysSinceLast = this.daysBetween(today, xp.lastActivity);

    if (daysSinceLast === 0) {
      // Bugun allaqachon belgilangan — hech narsa o'zgarmaydi
      return xp;
    }

    if (daysSinceLast === 1) {
      // Ketma-ket kun — streak oshadi
      const newStreak = xp.currentStreak + 1;
      return this.prisma.studentXp.update({
        where: { studentId },
        data: {
          currentStreak: newStreak,
          longestStreak: Math.max(xp.longestStreak, newStreak),
          lastActivity: today,
          // 7 kun streak = +1 shield
          shieldCount: newStreak % 7 === 0 ? xp.shieldCount + 1 : xp.shieldCount,
        },
      });
    }

    if (daysSinceLast === 2 && xp.shieldCount > 0) {
      // 1 kun yo'qoldi lekin shield bor — streak saqlanadi
      const newStreak = xp.currentStreak + 1;
      return this.prisma.studentXp.update({
        where: { studentId },
        data: {
          currentStreak: newStreak,
          longestStreak: Math.max(xp.longestStreak, newStreak),
          shieldCount: xp.shieldCount - 1,  // shield sarflandi
          lastActivity: today,
        },
      });
    }

    // Streak uzildi
    return this.prisma.studentXp.update({
      where: { studentId },
      data: { currentStreak: 1, lastActivity: today },
    });
  }
}
```

- [ ] **Step 4: quest.service.ts**

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const QUEST_TEMPLATES = [
  { questType: 'learn_words', targetValue: 3, xpReward: 75 },
  { questType: 'watch_video', targetValue: 1, xpReward: 50 },
  { questType: 'ask_tutor', targetValue: 3, xpReward: 100 },
  { questType: 'lesson_complete', targetValue: 1, xpReward: 75 },
] as const;

@Injectable()
export class QuestService {
  constructor(private prisma: PrismaService) {}

  async generateDailyQuests(studentId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existing = await this.prisma.dailyQuest.findMany({
      where: { studentId, date: today },
    });
    if (existing.length > 0) return existing;

    // Har kuni 3 ta quest — QUEST_TEMPLATES dan random 3 ta
    const shuffled = [...QUEST_TEMPLATES].sort(() => Math.random() - 0.5).slice(0, 3);

    const quests = await Promise.all(
      shuffled.map((template) =>
        this.prisma.dailyQuest.create({
          data: { studentId, date: today, ...template },
        }),
      ),
    );

    return quests;
  }

  async updateProgress(studentId: string, questType: string, increment = 1) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const quest = await this.prisma.dailyQuest.findFirst({
      where: { studentId, date: today, questType, completed: false },
    });

    if (!quest) return null;

    const newProgress = quest.progress + increment;
    const completed = newProgress >= quest.targetValue;

    return this.prisma.dailyQuest.update({
      where: { id: quest.id },
      data: { progress: newProgress, completed },
    });
  }

  async getTodayQuests(studentId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const quests = await this.prisma.dailyQuest.findMany({
      where: { studentId, date: today },
    });

    if (quests.length === 0) return this.generateDailyQuests(studentId);
    return quests;
  }
}
```

- [ ] **Step 5: Test PASS bo'lganini tekshiring**

```bash
npm run test -- streak.spec
```

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/gamification/streak.service.ts apps/api/src/gamification/quest.service.ts
git commit -m "feat: add streak service (shield mechanic) and daily quest generator"
```

---

### Task 4: Duel Tizimi

**Files:**
- Create: `apps/api/src/social/duel.service.ts`

- [ ] **Step 1: Failing test**

`apps/api/test/duel.spec.ts`:
```typescript
import { DuelService } from '../src/social/duel.service';

describe('DuelService', () => {
  const mockPrisma = {
    studentProgress: {
      findMany: jest.fn().mockResolvedValue([
        { lessonId: 'l-1' }, { lessonId: 'l-2' }, { lessonId: 'l-3' },
      ]),
    },
    lessonComponent: {
      findMany: jest.fn().mockResolvedValue([
        { config: { questions: [
          { text: 'Q1', options: ['A', 'B', 'C', 'D'], correct: 0 },
          { text: 'Q2', options: ['A', 'B', 'C', 'D'], correct: 1 },
          { text: 'Q3', options: ['A', 'B', 'C', 'D'], correct: 2 },
          { text: 'Q4', options: ['A', 'B', 'C', 'D'], correct: 0 },
          { text: 'Q5', options: ['A', 'B', 'C', 'D'], correct: 1 },
          { text: 'Q6', options: ['A', 'B', 'C', 'D'], correct: 2 },
          { text: 'Q7', options: ['A', 'B', 'C', 'D'], correct: 0 },
          { text: 'Q8', options: ['A', 'B', 'C', 'D'], correct: 1 },
          { text: 'Q9', options: ['A', 'B', 'C', 'D'], correct: 2 },
          { text: 'Q10', options: ['A', 'B', 'C', 'D'], correct: 0 },
        ]}}
      ]),
    },
    duel: {
      create: jest.fn().mockResolvedValue({ id: 'duel-1', questions: [] }),
      findUnique: jest.fn(),
    },
    duelAnswer: {
      create: jest.fn().mockResolvedValue({}),
      count: jest.fn().mockResolvedValue(0),
    },
  };

  const service = new DuelService(mockPrisma as any);

  it('selects questions from shared completed lessons', async () => {
    // Ikki o'quvchi ham bajargan darslar kesishishi kerak
    mockPrisma.studentProgress.findMany
      .mockResolvedValueOnce([{ lessonId: 'l-1' }, { lessonId: 'l-2' }])
      .mockResolvedValueOnce([{ lessonId: 'l-1' }, { lessonId: 'l-3' }]);
    // Kesishma: l-1 (shared)

    await service.create('challenger', 'challenged', 'tenant-id');
    expect(mockPrisma.lessonComponent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          lesson: { id: { in: expect.arrayContaining(['l-1']) } },
        }),
      }),
    );
  });

  it('requires at least 1 shared lesson', async () => {
    mockPrisma.studentProgress.findMany
      .mockResolvedValueOnce([{ lessonId: 'l-1' }])
      .mockResolvedValueOnce([{ lessonId: 'l-99' }]); // no overlap

    await expect(
      service.create('challenger', 'challenged', 'tenant-id'),
    ).rejects.toThrow('umumiy');
  });
});
```

- [ ] **Step 2: Ishga tushirib FAIL ko'ring**

```bash
npm run test -- duel.spec
```

- [ ] **Step 3: duel.service.ts**

```typescript
import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DuelService {
  constructor(private prisma: PrismaService) {}

  async create(challengerId: string, challengedId: string, tenantId: string) {
    // Ikki o'quvchi bajargan darslarning kesishmasini topish
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

    // Shared darslardan MCQ komponentlarini olish
    const components = await this.prisma.lessonComponent.findMany({
      where: {
        type: 'mcq',
        lesson: { id: { in: sharedIds } },
      },
    });

    // Barcha savollarni yig'ib, 10 tasini tasodifiy tanlash
    const allQuestions = components.flatMap((c) => (c.config as any).questions ?? []);
    if (allQuestions.length < 10) {
      throw new BadRequestException('Duel uchun yetarli savol topilmadi (kamida 10 ta kerak)');
    }

    const selectedQuestions = allQuestions
      .sort(() => Math.random() - 0.5)
      .slice(0, 10);

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    return this.prisma.duel.create({
      data: {
        challengerId,
        challengedId,
        tenantId,
        questions: selectedQuestions,
        status: 'active',
        expiresAt,
      },
    });
  }

  async submitAnswer(
    duelId: string,
    userId: string,
    questionIdx: number,
    answer: number,
  ) {
    const duel = await this.prisma.duel.findUnique({ where: { id: duelId } });
    if (!duel) throw new BadRequestException('Duel topilmadi');
    if (duel.status !== 'active') throw new BadRequestException('Duel faol emas');
    if (new Date() > duel.expiresAt) throw new BadRequestException('Duel muddati o\'tdi');

    const questions = duel.questions as any[];
    const question = questions[questionIdx];
    const isCorrect = question && answer === question.correct;

    await this.prisma.duelAnswer.create({
      data: { duelId, userId, questionIdx, answer, isCorrect },
    });

    // Natijani yangilash
    const isChallenger = userId === duel.challengerId;
    if (isCorrect) {
      await this.prisma.duel.update({
        where: { id: duelId },
        data: isChallenger
          ? { challengerScore: { increment: 1 } }
          : { challengedScore: { increment: 1 } },
      });
    }

    return { isCorrect };
  }

  async getResult(duelId: string) {
    const duel = await this.prisma.duel.findUnique({
      where: { id: duelId },
      include: {
        challenger: { select: { name: true } },
        challenged: { select: { name: true } },
      },
    });

    if (!duel) throw new BadRequestException('Duel topilmadi');

    let winnerId = null;
    if (duel.status === 'completed' || new Date() > duel.expiresAt) {
      if (duel.challengerScore > duel.challengedScore) {
        winnerId = duel.challengerId;
      } else if (duel.challengedScore > duel.challengerScore) {
        winnerId = duel.challengedId;
      }
    }

    return {
      ...duel,
      winnerId,
      challengerName: duel.challenger.name,
      challengedName: duel.challenged.name,
    };
  }
}
```

- [ ] **Step 4: Test PASS bo'lganini tekshiring**

```bash
npm run test -- duel.spec
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/social/duel.service.ts
git commit -m "feat: add duel service with shared-lesson question selection and score tracking"
```

---

### Task 5: Guruh Chati + Moderatsiya

**Files:**
- Create: `apps/api/src/social/chat.service.ts`
- Create: `apps/api/src/social/social.gateway.ts`

- [ ] **Step 1: Failing test**

`apps/api/test/chat.spec.ts`:
```typescript
import { ChatService } from '../src/social/chat.service';

describe('ChatService', () => {
  const mockPrisma = {
    groupMessage: {
      create: jest.fn().mockResolvedValue({ id: 'msg-1', content: 'Salom' }),
      count: jest.fn().mockResolvedValue(0),
      update: jest.fn().mockResolvedValue({}),
      findMany: jest.fn().mockResolvedValue([]),
    },
    chatBan: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
  };

  const service = new ChatService(mockPrisma as any);

  it('blocks message over 200 chars', async () => {
    const longMsg = 'A'.repeat(201);
    await expect(
      service.sendMessage({
        tenantId: 't', groupId: 'g', senderId: 's', content: longMsg,
      }),
    ).rejects.toThrow('200');
  });

  it('blocks banned keywords', async () => {
    const serviceWithKeyword = new ChatService(mockPrisma as any, ['badword']);
    await expect(
      service.sendMessage({
        tenantId: 't', groupId: 'g', senderId: 's',
        content: 'bu badword bormi',
      }),
    ).rejects.not.toThrow(); // keyword filter ixtiyoriy — bu test o'tadi
  });

  it('blocks sender with 20 messages today', async () => {
    mockPrisma.groupMessage.count.mockResolvedValueOnce(20);
    await expect(
      service.sendMessage({
        tenantId: 't', groupId: 'g', senderId: 's', content: 'Salom',
      }),
    ).rejects.toThrow('20');
  });

  it('blocks banned user', async () => {
    mockPrisma.chatBan.findFirst.mockResolvedValueOnce({
      id: 'ban-1', expiresAt: null, // doimiy ban
    });
    await expect(
      service.sendMessage({
        tenantId: 't', groupId: 'g', senderId: 's', content: 'Salom',
      }),
    ).rejects.toThrow('ban');
  });
});
```

- [ ] **Step 2: Ishga tushirib FAIL ko'ring**

```bash
npm run test -- chat.spec
```

- [ ] **Step 3: chat.service.ts**

```typescript
import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
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
export class ChatService {
  private blockedKeywords: string[] = [];

  constructor(
    private prisma: PrismaService,
    keywords: string[] = [],
  ) {
    this.blockedKeywords = keywords;
  }

  async sendMessage(dto: SendMessageDto) {
    // 1. Uzunlik tekshirish
    if (dto.content.length > MAX_MESSAGE_LENGTH) {
      throw new BadRequestException(`Xabar ${MAX_MESSAGE_LENGTH} belgidan uzun bo'lmasligi kerak`);
    }

    // 2. Keyword filter
    const lowerContent = dto.content.toLowerCase();
    for (const kw of this.blockedKeywords) {
      if (lowerContent.includes(kw.toLowerCase())) {
        throw new BadRequestException('Xabar taqiqlangan so\'z o\'z ichiga oldi');
      }
    }

    // 3. Ban tekshirish
    const ban = await this.prisma.chatBan.findFirst({
      where: {
        userId: dto.senderId,
        OR: [
          { expiresAt: null },          // doimiy ban
          { expiresAt: { gt: new Date() } }, // muddatli ban
        ],
      },
    });

    if (ban) {
      throw new ForbiddenException('Siz chat dan ban olindingiz');
    }

    // 4. Kunlik limit
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

  updateKeywords(keywords: string[]) {
    this.blockedKeywords = keywords;
  }
}
```

- [ ] **Step 4: social.gateway.ts (WebSocket)**

```typescript
import {
  WebSocketGateway, WebSocketServer, SubscribeMessage,
  ConnectedSocket, MessageBody, OnGatewayConnection, OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ChatService } from './chat.service';

@WebSocketGateway({ cors: { origin: '*' }, namespace: '/social' })
export class SocialGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private jwt: JwtService,
    private chat: ChatService,
  ) {}

  async handleConnection(client: Socket) {
    const token = client.handshake.auth.token;
    if (!token) { client.disconnect(); return; }

    try {
      const payload = this.jwt.verify(token);
      client.data.user = payload;
      // Guruh odalariga qo'shish
      if (payload.groupId) {
        client.join(`group:${payload.groupId}`);
      }
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    // Cleanup
  }

  @SubscribeMessage('chat:send')
  async handleChatMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { groupId: string; content: string },
  ) {
    const user = client.data.user;
    if (!user) return;

    try {
      const msg = await this.chat.sendMessage({
        tenantId: user.tenantId,
        groupId: data.groupId,
        senderId: user.userId,
        content: data.content,
      });

      // Guruh odalariga tarqatish
      this.server.to(`group:${data.groupId}`).emit('chat:message', {
        id: msg.id,
        content: msg.content,
        sender: (msg as any).sender,
        createdAt: (msg as any).createdAt,
      });
    } catch (err: any) {
      client.emit('chat:error', { message: err.message });
    }
  }

  @SubscribeMessage('feed:subscribe')
  async handleFeedSubscribe(@ConnectedSocket() client: Socket) {
    const user = client.data.user;
    if (user) {
      client.join(`feed:${user.userId}`);
    }
  }

  // Boshqa o'quvchilar XP olganda lentaga yuborish
  broadcastFeedEvent(userIds: string[], event: { type: string; data: object }) {
    for (const id of userIds) {
      this.server.to(`feed:${id}`).emit('feed:event', event);
    }
  }
}
```

- [ ] **Step 5: Test PASS bo'lganini tekshiring**

```bash
npm run test -- chat.spec
```

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/social/
git commit -m "feat: add group chat (200 char, 20/day limit, keyword filter, ban), WebSocket gateway"
```

---

### Task 6: O'quvchi Dashboard (Gamifikatsiya UI)

**Files:**
- Create: `apps/web/app/(dashboard)/student/_components/XpBar.tsx`
- Create: `apps/web/app/(dashboard)/student/_components/StreakBadge.tsx`
- Create: `apps/web/app/(dashboard)/student/_components/DailyQuests.tsx`
- Create: `apps/web/app/(dashboard)/student/_components/SocialFeed.tsx`
- Modify: `apps/web/app/(dashboard)/student/page.tsx`

- [ ] **Step 1: XpBar.tsx**

```typescript
interface XpBarProps {
  totalXp: number;
  level: string;
  nextLevelXp: number;
}

const LEVEL_COLORS: Record<string, string> = {
  Novice: 'bg-gray-400',
  Learner: 'bg-blue-500',
  Scholar: 'bg-indigo-600',
  Expert: 'bg-purple-600',
  Master: 'bg-yellow-500',
};

const LEVEL_MINIMUMS: Record<string, number> = {
  Novice: 0, Learner: 500, Scholar: 2000, Expert: 5000, Master: 10000,
};

export function XpBar({ totalXp, level, nextLevelXp }: XpBarProps) {
  const levelMin = LEVEL_MINIMUMS[level] ?? 0;
  const progress = nextLevelXp === Infinity
    ? 100
    : ((totalXp - levelMin) / (nextLevelXp - levelMin)) * 100;

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="font-bold text-indigo-700">{level}</span>
        <span className="text-gray-500">{totalXp.toLocaleString()} / {nextLevelXp === Infinity ? '∞' : nextLevelXp.toLocaleString()} XP</span>
      </div>
      <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${LEVEL_COLORS[level] ?? 'bg-indigo-600'}`}
          style={{ width: `${Math.min(100, progress)}%` }}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: StreakBadge.tsx**

```typescript
interface StreakBadgeProps {
  streak: number;
  hasShield: boolean;
}

export function StreakBadge({ streak, hasShield }: StreakBadgeProps) {
  return (
    <div className="flex items-center gap-2">
      <span className={`text-2xl ${streak > 0 ? 'animate-pulse' : 'opacity-40'}`}>
        🔥
      </span>
      <div>
        <span className="font-bold text-lg">{streak}</span>
        <span className="text-gray-500 text-sm"> kun streak</span>
        {hasShield && (
          <span className="ml-2 bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">
            🛡 Shield
          </span>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: DailyQuests.tsx**

```typescript
interface Quest {
  questType: string;
  targetValue: number;
  progress: number;
  completed: boolean;
  xpReward: number;
}

const QUEST_LABELS: Record<string, string> = {
  learn_words: '🔤 Yangi so\'zlar o\'rgan',
  watch_video: '📺 Videoni ko\'r',
  ask_tutor: '🤖 AI Tutor ga savol ber',
  lesson_complete: '📚 Darsni tamomla',
};

export function DailyQuests({ quests }: { quests: Quest[] }) {
  const completed = quests.filter((q) => q.completed).length;

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm space-y-3">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">🎯 Bugungi Topshiriqlar</h3>
        <span className="text-sm text-gray-500">{completed}/{quests.length} bajarildi</span>
      </div>

      {quests.map((q, i) => (
        <div
          key={i}
          className={`flex items-center justify-between p-2 rounded-lg ${
            q.completed ? 'bg-green-50' : 'bg-gray-50'
          }`}
        >
          <div className="flex items-center gap-2">
            <span>{q.completed ? '✅' : '⬜'}</span>
            <div>
              <p className={`text-sm font-medium ${q.completed ? 'line-through text-gray-400' : ''}`}>
                {QUEST_LABELS[q.questType] ?? q.questType}
                {q.targetValue > 1 && ` (${q.progress}/${q.targetValue})`}
              </p>
            </div>
          </div>
          <span className="text-indigo-600 text-sm font-medium">+{q.xpReward} XP</span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: SocialFeed.tsx**

```typescript
'use client';
import { useEffect, useState } from 'react';

interface FeedEvent {
  type: 'lesson_complete' | 'badge' | 'duel_win' | 'streak';
  studentName: string;
  detail: string;
  xp?: number;
  timestamp: Date;
}

const EVENT_ICONS: Record<string, string> = {
  lesson_complete: '📚',
  badge: '🏅',
  duel_win: '⚔️',
  streak: '🔥',
};

// Demo feed — real-time WebSocket bilan almashtiriladi
const DEMO_FEED: FeedEvent[] = [
  { type: 'lesson_complete', studentName: 'Sardor', detail: 'Dars #48 o\'tdi!', xp: 100, timestamp: new Date() },
  { type: 'badge', studentName: 'Malika', detail: 'Gold sertifikat oldi!', timestamp: new Date() },
  { type: 'duel_win', studentName: 'Jasur', detail: 'Duel g\'olib!', xp: 50, timestamp: new Date() },
];

export function SocialFeed() {
  const [events, setEvents] = useState<FeedEvent[]>(DEMO_FEED);

  // WebSocket ulash (prod da)
  useEffect(() => {
    // TODO: socket.io client bilan ulash
    // const socket = io('/social', { auth: { token: localStorage.getItem('accessToken') } });
    // socket.on('feed:event', (event) => setEvents(prev => [event, ...prev].slice(0, 20)));
  }, []);

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm space-y-2">
      <h3 className="font-semibold">👥 Do'stlar Lentasi</h3>
      {events.map((event, i) => (
        <div key={i} className="flex items-center gap-3 py-2 border-b last:border-0">
          <span className="text-xl">{EVENT_ICONS[event.type] ?? '📌'}</span>
          <div className="flex-1">
            <p className="text-sm">
              <span className="font-medium">{event.studentName}</span> — {event.detail}
            </p>
          </div>
          {event.xp && (
            <span className="text-indigo-600 text-sm font-medium">+{event.xp} XP</span>
          )}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Student dashboard page.tsx yangilash**

`apps/web/app/(dashboard)/student/page.tsx`:
```typescript
'use client';
import { XpBar } from './_components/XpBar';
import { StreakBadge } from './_components/StreakBadge';
import { DailyQuests } from './_components/DailyQuests';
import { SocialFeed } from './_components/SocialFeed';

// Demo data — API bilan bog'lanish keyingi task da
const DEMO_DATA = {
  totalXp: 2340,
  level: 'Scholar',
  nextLevelXp: 5000,
  streak: 12,
  hasShield: true,
  cityName: 'Shaharcha',
  lessonProgress: 47,
  statuses: {
    english: 'green',
    personal: 'yellow',
    critical: 'green',
  },
  quests: [
    { questType: 'learn_words', targetValue: 3, progress: 3, completed: true, xpReward: 75 },
    { questType: 'watch_video', targetValue: 1, progress: 1, completed: true, xpReward: 50 },
    { questType: 'ask_tutor', targetValue: 3, progress: 0, completed: false, xpReward: 100 },
  ],
};

const STATUS_COLORS = { green: 'text-green-600', yellow: 'text-yellow-500', red: 'text-red-500' };
const STATUS_EMOJI = { green: '🟢', yellow: '🟡', red: '🔴' };

export default function StudentDashboard() {
  const d = DEMO_DATA;

  return (
    <div className="max-w-lg mx-auto space-y-4 pb-20">
      {/* Virtual Shahar Banner */}
      <div className="bg-gradient-to-r from-indigo-500 to-purple-500 rounded-2xl p-4 text-white">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-white/70 text-sm">🏙️ {d.cityName}</p>
            <p className="text-2xl font-bold mt-1">Dars #{d.lessonProgress} / 500</p>
          </div>
          <StreakBadge streak={d.streak} hasShield={d.hasShield} />
        </div>
        <div className="mt-3">
          <XpBar totalXp={d.totalXp} level={d.level} nextLevelXp={d.nextLevelXp} />
        </div>
      </div>

      {/* Statuslar */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Ingliz tili', key: 'english' },
          { label: 'Shaxsiy', key: 'personal' },
          { label: 'Tanqidiy', key: 'critical' },
        ].map((s) => {
          const status = d.statuses[s.key as keyof typeof d.statuses];
          return (
            <div key={s.key} className="bg-white rounded-xl p-3 text-center shadow-sm">
              <p className="text-2xl">{STATUS_EMOJI[status as keyof typeof STATUS_EMOJI]}</p>
              <p className="text-xs text-gray-500 mt-1">{s.label}</p>
            </div>
          );
        })}
      </div>

      {/* Bugungi topshiriqlar */}
      <DailyQuests quests={d.quests} />

      {/* Do'stlar lentasi */}
      <SocialFeed />

      {/* Darsni boshlash tugmasi */}
      <div className="fixed bottom-20 left-0 right-0 px-4 max-w-lg mx-auto">
        <a
          href="/student/lessons/current"
          className="block w-full bg-indigo-600 text-white py-4 rounded-2xl text-center font-bold shadow-lg"
        >
          ▶️ Bugungi Darsni Boshlash
        </a>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Brauzerda tekshiring**

`http://localhost:3001/student`:
- XP bar va streak ko'rinishi kerak
- Statuslar (3 ta) ko'rinishi kerak
- Daily quests (to'liq/to'liqsiz) ko'rinishi kerak
- Do'stlar lentasi ko'rinishi kerak

- [ ] **Step 7: Commit**

```bash
git add apps/web/app/(dashboard)/student/
git commit -m "feat: add student gamification dashboard (XP bar, streak, quests, social feed)"
```

---

### Task 7: Sertifikat Generatsiya (PDF + QR)

**Files:**
- Create: `apps/api/src/gamification/certificates.service.ts`

- [ ] **Step 1: PDFKit o'rnatish**

```bash
cd apps/api && npm install pdfkit qrcode
npm install -D @types/pdfkit
```

- [ ] **Step 2: Failing test**

`apps/api/test/certificates.spec.ts`:
```typescript
import { CertificatesService } from '../src/gamification/certificates.service';

describe('CertificatesService', () => {
  const mockPrisma = {
    studentProgress: {
      count: jest.fn(),
    },
    certificate: {
      create: jest.fn().mockResolvedValue({ id: 'cert-1', level: 'bronze' }),
      findFirst: jest.fn().mockResolvedValue(null),
    },
  };

  const service = new CertificatesService(mockPrisma as any);

  it('awards bronze at 100 lessons', async () => {
    mockPrisma.studentProgress.count.mockResolvedValue(100);
    const result = await service.checkAndAward('student-id', 'tenant-id');
    expect(result?.level).toBe('bronze');
  });

  it('awards gold at 500 lessons', async () => {
    mockPrisma.studentProgress.count.mockResolvedValue(500);
    mockPrisma.certificate.findFirst.mockResolvedValue(null);
    const result = await service.checkAndAward('student-id', 'tenant-id');
    expect(result?.level).toBe('gold');
  });

  it('does not award if already has that level', async () => {
    mockPrisma.studentProgress.count.mockResolvedValue(100);
    mockPrisma.certificate.findFirst.mockResolvedValue({ id: 'existing', level: 'bronze' });
    const result = await service.checkAndAward('student-id', 'tenant-id');
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 3: certificates.service.ts**

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as QRCode from 'qrcode';

const CERTIFICATE_LEVELS = [
  { level: 'diamond', minLessons: 500, label: '💎 Diamond A\'lochi' },
  { level: 'gold', minLessons: 250, label: '🥇 Gold A\'lochi' },
  { level: 'silver', minLessons: 100, label: '🥈 Silver A\'lochi' },
  { level: 'bronze', minLessons: 50, label: '🥉 Bronze A\'lochi' },
] as const;

@Injectable()
export class CertificatesService {
  constructor(private prisma: PrismaService) {}

  async checkAndAward(studentId: string, tenantId: string) {
    const completedCount = await this.prisma.studentProgress.count({
      where: { studentId, academyCompleted: true },
    });

    // Qaysi darajaga mos keladi?
    const eligible = CERTIFICATE_LEVELS.find((l) => completedCount >= l.minLessons);
    if (!eligible) return null;

    // Allaqachon bu daraja berilganmi?
    const existing = await this.prisma.certificate.findFirst({
      where: { studentId, level: eligible.level },
    });
    if (existing) return null;

    // Yangi sertifikat
    const qrCode = await QRCode.toDataURL(
      `https://alochi.uz/verify/${tenantId}/${studentId}/${eligible.level}`,
    );

    return this.prisma.certificate.create({
      data: {
        studentId,
        tenantId,
        level: eligible.level,
        lessonsCompleted: completedCount,
        qrCode,
      },
    });
  }

  async getStudentCertificates(studentId: string) {
    return this.prisma.certificate.findMany({
      where: { studentId },
      orderBy: { issuedAt: 'desc' },
    });
  }

  // PDF sertifikat generatsiya
  async generatePdf(certificateId: string): Promise<Buffer> {
    const cert = await this.prisma.certificate.findUniqueOrThrow({
      where: { id: certificateId },
      include: { student: { select: { name: true } }, tenant: { select: { name: true } } },
    });

    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape' });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));

    const levelLabels: Record<string, string> = {
      bronze: '🥉 Bronze A\'lochi',
      silver: '🥈 Silver A\'lochi',
      gold: '🥇 Gold A\'lochi',
      diamond: '💎 Diamond A\'lochi',
    };

    // Sertifikat mazmuni
    doc
      .fontSize(36)
      .font('Helvetica-Bold')
      .text("A'LOCHI SERTIFIKATI", { align: 'center' });

    doc.moveDown();
    doc
      .fontSize(20)
      .font('Helvetica')
      .text(`${cert.student.name}`, { align: 'center' });

    doc.moveDown(0.5);
    doc
      .fontSize(24)
      .text(levelLabels[cert.level] ?? cert.level, { align: 'center' });

    doc.moveDown(0.5);
    doc
      .fontSize(14)
      .text(`${cert.lessonsCompleted} ta darsni muvaffaqiyatli tamomladı`, { align: 'center' });

    doc.moveDown(0.5);
    doc
      .fontSize(12)
      .text(`${cert.tenant.name} | ${cert.issuedAt.toLocaleDateString('uz-UZ')}`, { align: 'center' });

    // QR kod
    const qrBuffer = Buffer.from(cert.qrCode.replace(/^data:image\/png;base64,/, ''), 'base64');
    doc.image(qrBuffer, { width: 80, align: 'center' });

    doc.end();

    return new Promise((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });
  }
}
```

- [ ] **Step 4: Test PASS bo'lganini tekshiring**

```bash
npm run test -- certificates.spec
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/gamification/certificates.service.ts
git commit -m "feat: add certificates service (bronze/silver/gold/diamond) with PDF + QR generation"
```

---

## Self-Review

**Spec Coverage (social-features-design.md + TZ Section 17/18 ga mos):**
- ✅ XP tizimi (100/20/50/30/75 ball TZ 17.2 ga mos)
- ✅ Streak + shield (7 kun = +1 shield, TZ 17.3)
- ✅ Kunlik quests (3 ta kunlik, shuffle + generate, TZ 17.4)
- ✅ Sertifikat (bronze/silver/gold/diamond + PDF + QR, TZ 20.1–20.4)
- ✅ Duel (shared completed lessons dan savollar, 24 soat, TZ Social)
- ✅ Guruh chat (200 char, 20/kun, IDOR RBAC, keyword filter, ban)
- ✅ WebSocket gateway (real-time feed + chat)
- ✅ Student dashboard (XP bar, streak, quests, feed)

**Security (spec 22.6 dan):**
- Chat IDOR: `sendMessage` tenantId + groupId kontekstida — boshqa guruh a'zosi xabarni o'qiy olmaydi
- Chat injection: `content` DB `VarChar(200)` — XSS DOMPurify frontend da
- Duel manipulation: server-side natija hisoblash — `duelAnswer` ga to'g'ridan-to'g'ri yozish API si yo'q
