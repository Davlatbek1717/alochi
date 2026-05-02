/**
 * Demo seed — wires up a full realistic dataset for every role's pages.
 *
 * Pre-conditions (enforced by guard at startup):
 *   • 1 Tenant with slug="demo"
 *   • 1 User  with role=superadmin
 *   • 10 Lessons + 100 LessonComponents  ← untouched
 *
 * All users get password "demo12345".
 * Dates are relative to TODAY = 2026-05-02.
 *
 * Run (from repo root):
 *   pnpm --filter api exec ts-node -r tsconfig-paths/register ../../prisma/seed-demo.ts
 *
 * Or directly (from prisma/):
 *   ../apps/api/node_modules/.bin/ts-node --project tsconfig.json \
 *     -r ../apps/api/node_modules/tsconfig-paths/register seed-demo.ts
 */

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// ─── Date helpers ─────────────────────────────────────────────────────────────

const TODAY = new Date('2026-05-02T12:00:00.000Z');

function daysAgo(n: number): Date {
  return new Date(TODAY.getTime() - n * 86_400_000);
}
function daysFromNow(n: number): Date {
  return new Date(TODAY.getTime() + n * 86_400_000);
}
/** Return a Date for a child who is `age` years old today. */
function birthDate(age: number): Date {
  return new Date(TODAY.getFullYear() - age, TODAY.getMonth(), TODAY.getDate());
}
/** Random integer in [min, max] (inclusive). */
function ri(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}
/** Pick a random element. */
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
/** First day of the current month as "YYYY-MM" string. */
function currentMonth(): string {
  return `${TODAY.getFullYear()}-${String(TODAY.getMonth() + 1).padStart(2, '0')}`;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== A\'lochi demo seed — START ===');

  // ── Guard ──
  const tenant = await prisma.tenant.findUnique({ where: { slug: 'demo' } });
  if (!tenant) {
    console.error('[ABORT] No tenant with slug="demo". Run clean-db.ts first.');
    process.exit(1);
  }
  console.log(`Tenant: "${tenant.name}" (${tenant.id})`);

  const superadmin = await prisma.user.findFirst({ where: { role: 'superadmin' } });
  if (!superadmin) {
    console.error('[ABORT] No superadmin user found.');
    process.exit(1);
  }

  // Fetch existing lessons — we reference their IDs for progress/errors/etc.
  const lessons = await prisma.lesson.findMany({ orderBy: { orderNumber: 'asc' } });
  if (lessons.length === 0) {
    console.error('[ABORT] No lessons found. Run seed-step-1.ts / seed-steps-2-10.ts first.');
    process.exit(1);
  }
  console.log(`Found ${lessons.length} lessons (untouched).`);

  // Hash password ONCE — bcrypt is slow (~100 ms/hash).
  const pwHash = await bcrypt.hash('demo12345', 10);
  console.log('Password hashed.');

  // ── 1. Branches ──────────────────────────────────────────────────────────────
  console.log('\n[1] Creating branches...');

  const branch1 = await prisma.branch.create({
    data: {
      tenantId: tenant.id,
      name: 'Toshkent filiali',
      workStartTime: '08:30',
      lateGraceMinutes: 10,
    },
  });
  const branch2 = await prisma.branch.create({
    data: {
      tenantId: tenant.id,
      name: 'Andijon filiali',
      workStartTime: '09:00',
      lateGraceMinutes: 5,
    },
  });
  console.log(`  Created: ${branch1.name}, ${branch2.name}`);

  // ── 2. Staff users ────────────────────────────────────────────────────────────
  console.log('\n[2] Creating staff users...');

  const staffData = [
    // Branch 1
    { login: 'filadmin1', name: 'Nodira Karimova',   role: 'filadmin' as const, branchId: branch1.id },
    { login: 'manager1',  name: 'Sherzod Umarov',    role: 'manager'  as const, branchId: branch1.id },
    { login: 'mentor1',   name: 'Alisher Toshev',    role: 'mentor'   as const, branchId: branch1.id },
    { login: 'mentor2',   name: 'Malika Yusupova',   role: 'mentor'   as const, branchId: branch1.id },
    { login: 'tester1',   name: 'Bobur Xolmatov',    role: 'tester'   as const, branchId: branch1.id },
    // Branch 2
    { login: 'filadmin2', name: 'Dilnoza Rашidova',  role: 'filadmin' as const, branchId: branch2.id },
    { login: 'manager2',  name: 'Jahongir Ergashev', role: 'manager'  as const, branchId: branch2.id },
    { login: 'mentor3',   name: 'Sarvinoz Mirzayeva',role: 'mentor'   as const, branchId: branch2.id },
    { login: 'mentor4',   name: 'Otabek Normatov',   role: 'mentor'   as const, branchId: branch2.id },
    { login: 'tester2',   name: 'Umida Qodiрova',    role: 'tester'   as const, branchId: branch2.id },
  ];

  const staffUsers: Record<string, { id: string; branchId: string | null; role: string }> = {};
  for (const s of staffData) {
    const u = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        branchId: s.branchId,
        role: s.role,
        name: s.name,
        login: s.login,
        passwordHash: pwHash,
        status: 'active',
      },
    });
    staffUsers[s.login] = { id: u.id, branchId: u.branchId, role: u.role };
    console.log(`  + ${s.role.padEnd(8)} ${s.login} (${s.name})`);
  }

  // Assign filadmins to their branches
  await prisma.branch.update({
    where: { id: branch1.id },
    data: { filadminId: staffUsers['filadmin1'].id },
  });
  await prisma.branch.update({
    where: { id: branch2.id },
    data: { filadminId: staffUsers['filadmin2'].id },
  });

  // ── 3. Groups (4 UUIDs, 2 per branch) ────────────────────────────────────────
  // There is no separate Group model — groupId is a free UUID on User.
  const groupIds = [
    '11111111-0000-0000-0000-000000000001', // branch1 group A
    '11111111-0000-0000-0000-000000000002', // branch1 group B
    '22222222-0000-0000-0000-000000000001', // branch2 group A
    '22222222-0000-0000-0000-000000000002', // branch2 group B
  ];

  // ── 4. Students (16) ──────────────────────────────────────────────────────────
  console.log('\n[3] Creating students...');

  // Realistic Uzbek student names
  const studentNames = [
    'Jasur Rahimov',    'Zulfiya Nazarova',  'Dilshod Ergashev', 'Munira Tosheva',
    'Sanjar Holiqov',   'Feruza Yusupova',   'Ulugbek Mirzayev', 'Nozima Abdullayeva',
    'Doniyor Hasanov',  'Shahlo Qodiрova',   'Mansur Tursunov',  'Lobar Ismoilova',
    'Bekzod Xolmatov',  'Hulkar Normatova',  'Akbar Yoʻldoshev', 'Iroda Rahimova',
  ];
  // Ages 9-13 for grades 3-7
  const studentAges = [10, 11, 9, 12, 13, 10, 11, 12, 9, 13, 10, 11, 12, 9, 13, 11];

  // Assignment: 4 groups of 4 students
  // branch1: students 1-8; branch2: students 9-16
  const branchForStudent = (idx: number) => idx < 8 ? branch1.id : branch2.id;
  const groupForStudent  = (idx: number): string => groupIds[Math.floor(idx / 4)];

  const students: { id: string; branchId: string; groupId: string }[] = [];
  for (let i = 0; i < 16; i++) {
    const login = `student${i + 1}`;
    const u = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        branchId: branchForStudent(i),
        groupId:  groupForStudent(i),
        role: 'student',
        name: studentNames[i],
        login,
        passwordHash: pwHash,
        status: 'active',
        birthDate: birthDate(studentAges[i]),
        telegramId: null,
      },
    });
    students.push({ id: u.id, branchId: u.branchId!, groupId: u.groupId! });
    console.log(`  + student${i + 1}: ${studentNames[i]} age ${studentAges[i]}`);
  }

  // ── 5. Attendance (last 14 days, per student) ─────────────────────────────────
  console.log('\n[4] Creating student attendance...');

  const ATTENDANCE_STATUSES = ['present', 'present', 'present', 'present', 'present',
                                'present', 'present', 'late', 'late', 'absent'];
  let attendanceCount = 0;
  for (const stu of students) {
    for (let d = 1; d <= 14; d++) {
      const date = daysAgo(d);
      // Skip weekends (Sat=6, Sun=0)
      if (date.getDay() === 0 || date.getDay() === 6) continue;
      await prisma.attendanceStudent.create({
        data: {
          tenantId: tenant.id,
          branchId: stu.branchId,
          studentId: stu.id,
          date,
          status: pick(ATTENDANCE_STATUSES),
        },
      });
      attendanceCount++;
    }
  }
  console.log(`  Created ${attendanceCount} attendance records.`);

  // ── 6. StudentProgress ────────────────────────────────────────────────────────
  console.log('\n[5] Creating student progress...');

  let progressCount = 0;
  for (const stu of students) {
    // Each student gets progress on 3-5 lessons (first N lessons)
    const lessonCount = ri(3, 5);
    for (let li = 0; li < lessonCount && li < lessons.length; li++) {
      const lesson = lessons[li];
      const homeCompleted    = li < lessonCount - 2;
      const academyCompleted = li < lessonCount - 3;
      const sessionCount     = homeCompleted ? ri(3, 6) : ri(1, 2);
      await prisma.studentProgress.create({
        data: {
          studentId: stu.id,
          lessonId: lesson.id,
          sessionCount,
          homeCompleted,
          academyCompleted,
          completedAt:    academyCompleted ? daysAgo(ri(1, 10)) : null,
          lastActivityAt: daysAgo(ri(0, 7)),
        },
      });
      progressCount++;
    }
  }
  console.log(`  Created ${progressCount} progress records.`);

  // ── 7. StudentStatus ──────────────────────────────────────────────────────────
  console.log('\n[6] Creating student statuses...');

  const STATUS_VALUES = ['yashil', 'sariq', 'qizil'];
  let statusCount = 0;
  for (const stu of students) {
    // Status for each of last 3 days
    for (let d = 0; d < 3; d++) {
      try {
        await prisma.studentStatus.create({
          data: {
            studentId: stu.id,
            date: daysAgo(d),
            englishStatus:  pick(STATUS_VALUES),
            personalStatus: pick(STATUS_VALUES),
            criticalStatus: pick(STATUS_VALUES),
            englishNote:    d === 0 ? 'Darsni yaxshi o\'zlashtiрdi' : null,
          },
        });
        statusCount++;
      } catch {
        // unique constraint on (studentId, date) — skip if already exists
      }
    }
  }
  console.log(`  Created ${statusCount} status records.`);

  // ── 8. StudentXp + XpEvents ───────────────────────────────────────────────────
  console.log('\n[7] Creating XP data...');

  let xpCount = 0;
  for (const stu of students) {
    const totalXp = ri(100, 2000);
    const streak  = ri(0, 14);
    await prisma.studentXp.create({
      data: {
        studentId: stu.id,
        totalXp,
        currentStreak: streak,
        longestStreak: streak + ri(0, 5),
        shieldCount: ri(0, 3),
        lastActivity: daysAgo(ri(0, 2)),
      },
    });
    // 2-4 XP events per student
    const evCount = ri(2, 4);
    for (let e = 0; e < evCount; e++) {
      await prisma.xpEvent.create({
        data: {
          studentId: stu.id,
          amount: pick([10, 20, 50, 100]),
          reason: pick(['lesson_complete', 'daily_quest', 'streak_bonus', 'duel_win']),
          createdAt: daysAgo(ri(0, 7)),
        },
      });
    }
    xpCount++;
  }
  console.log(`  Created ${xpCount} StudentXp rows + events.`);

  // ── 9. StudentBuilding ────────────────────────────────────────────────────────
  console.log('\n[8] Creating student buildings...');

  const BUILDING_TYPES = ['house', 'school', 'park', 'library', 'market'];
  let buildingCount = 0;
  for (const stu of students) {
    const numBuildings = ri(1, 3);
    const usedLessons = new Set<string>();
    for (let b = 0; b < numBuildings; b++) {
      const lesson = lessons[b];
      if (usedLessons.has(lesson.id)) continue;
      usedLessons.add(lesson.id);
      await prisma.studentBuilding.create({
        data: {
          studentId: stu.id,
          type: BUILDING_TYPES[b % BUILDING_TYPES.length],
          tier: 1,
          index: b,
          lessonId: lesson.id,
          unlockedAt: daysAgo(ri(1, 14)),
        },
      });
      buildingCount++;
    }
  }
  console.log(`  Created ${buildingCount} buildings.`);

  // ── 10. Letters + StudentLetters ──────────────────────────────────────────────
  console.log('\n[9] Creating letters...');

  // 26 English alphabet letters
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const rarities = ['common', 'common', 'common', 'uncommon', 'uncommon', 'rare'];

  const letterRows: { id: string; char: string }[] = [];
  for (let i = 0; i < alphabet.length; i++) {
    const char = alphabet[i];
    const letter = await prisma.letter.upsert({
      where: { char },
      update: {},
      create: {
        char,
        imageUrl: `https://via.placeholder.com/120?text=${char}`,
        rarity: rarities[i % rarities.length],
      },
    });
    letterRows.push({ id: letter.id, char: letter.char });
  }
  console.log(`  ${letterRows.length} letters upserted.`);

  // Each student collects 5-12 letters
  let letterEarnCount = 0;
  for (const stu of students) {
    const count = ri(5, 12);
    const shuffled = [...letterRows].sort(() => Math.random() - 0.5).slice(0, count);
    for (const ltr of shuffled) {
      try {
        await prisma.studentLetter.create({
          data: {
            studentId: stu.id,
            letterId:  ltr.id,
            earnedAt:  daysAgo(ri(0, 14)),
          },
        });
        letterEarnCount++;
      } catch {
        // unique — skip duplicate
      }
    }
  }
  console.log(`  Created ${letterEarnCount} StudentLetter records.`);

  // ── 11. DailyQuest ────────────────────────────────────────────────────────────
  console.log('\n[10] Creating daily quests...');

  const QUEST_TYPES = ['complete_lesson', 'earn_xp', 'answer_correct', 'login_streak'];
  let questCount = 0;
  for (const stu of students.slice(0, 8)) {
    for (const qt of QUEST_TYPES.slice(0, 2)) {
      try {
        await prisma.dailyQuest.create({
          data: {
            studentId:   stu.id,
            date:        TODAY,
            questType:   qt,
            targetValue: qt === 'earn_xp' ? 50 : 1,
            progress:    ri(0, 1),
            completed:   Math.random() > 0.5,
            xpReward:    pick([10, 20, 30]),
          },
        });
        questCount++;
      } catch {
        // unique (studentId, date, questType) — skip
      }
    }
  }
  console.log(`  Created ${questCount} daily quests.`);

  // ── 12. Exams ─────────────────────────────────────────────────────────────────
  console.log('\n[11] Creating exams...');

  const exam1 = await prisma.exam.create({
    data: {
      tenantId:     tenant.id,
      title:        "1-bo'lim — Salomlashish imtihoni",
      description:  "STEP 1-2 darslarini qamrab oladi",
      passThreshold: 70,
      timeLimitMinutes: 15,
      isPublished:  true,
    },
  });
  // 5 questions for exam1 — mix of MCQ and translate to show the new
  // polymorphic shape working alongside the legacy MCQ-only path.
  const exam1Questions = [
    {
      type: 'mcq',
      config: {
        question: '"Good morning" qanday tarjima qilinadi?',
        options: ['Xayrli tun', 'Xayrli tong', 'Xayr', 'Salom'],
        correctIndex: 1,
      },
    },
    {
      type: 'translate',
      config: {
        sourceText: 'Wake up',
        sourceLang: 'en',
        targetLang: 'uz',
        acceptedAnswers: ["Uyg'on", "Uygon"],
      },
    },
    {
      type: 'mcq',
      config: {
        question: "Qaysi jumla to'g'ri?",
        options: ['She go school', 'She goes to school', 'She going school', 'She goed school'],
        correctIndex: 1,
      },
    },
    {
      type: 'word_order',
      config: {
        targetSentence: 'I go to school every day',
        words: ['I', 'go', 'school', 'to', 'every', 'day'],
      },
    },
    {
      type: 'mcq',
      config: {
        question: '"Morning" so\'zining antonimi?',
        options: ['Night', 'Noon', 'Evening', 'Afternoon'],
        correctIndex: 0,
      },
    },
  ];
  for (let i = 0; i < exam1Questions.length; i++) {
    const q = exam1Questions[i];
    await prisma.examQuestion.create({
      data: {
        examId:     exam1.id,
        type:       q.type,
        config:     q.config as never,
        orderIndex: i,
      },
    });
  }

  const exam2 = await prisma.exam.create({
    data: {
      tenantId:     tenant.id,
      title:        'Vocabulary check — STEP 1-3',
      description:  'Lug\'at nazorat ishi',
      passThreshold: 60,
      timeLimitMinutes: 20,
      isPublished:  true,
    },
  });
  // 8 questions for exam2 — all MCQ to keep validation simple here.
  const exam2Questions: Array<{ type: string; config: Record<string, unknown> }> = [
    { type: 'mcq', config: { question: '"School" so\'zining tarjimasi?', options: ['Uy', 'Maktab', 'Bozor', "Ko'cha"], correctIndex: 1 } },
    { type: 'mcq', config: { question: '"Teacher" kimni bildiradi?', options: ["O'quvchi", 'Ota', "O'qituvchi", "Do'st"], correctIndex: 2 } },
    { type: 'mcq', config: { question: '"Book" so\'zining ko\'pligi?', options: ['Bookies', 'Books', 'Bookes', 'Bookses'], correctIndex: 1 } },
    { type: 'mcq', config: { question: '"Happy" antonimi?', options: ['Glad', 'Sad', 'Tired', 'Busy'], correctIndex: 1 } },
    { type: 'mcq', config: { question: 'She ___ a student.', options: ['am', 'is', 'are', 'be'], correctIndex: 1 } },
    { type: 'mcq', config: { question: 'They ___ friends.', options: ['is', 'am', 'are', 'be'], correctIndex: 2 } },
    { type: 'mcq', config: { question: '"Big" sinonimi?', options: ['Small', 'Large', 'Tiny', 'Short'], correctIndex: 1 } },
    { type: 'mcq', config: { question: '"Beautiful" so\'zi qanday talaffuz?', options: ['byoo-tee-ful', 'bee-oo-tful', 'byoo-ti-ful', 'byot-ful'], correctIndex: 2 } },
  ];
  for (let i = 0; i < exam2Questions.length; i++) {
    const q = exam2Questions[i];
    await prisma.examQuestion.create({
      data: {
        examId:     exam2.id,
        type:       q.type,
        config:     q.config as never,
        orderIndex: i,
      },
    });
  }

  const exam3 = await prisma.exam.create({
    data: {
      tenantId:     tenant.id,
      title:        "Yakuniy imtihon",
      description:  "Barcha darslarni yakunlovchi imtihon",
      passThreshold: 75,
      isPublished:  false,
    },
  });
  // 3 draft questions
  const exam3Questions: Array<{ type: string; config: Record<string, unknown> }> = [
    { type: 'mcq', config: { question: 'Birinchi savol (qoralama)', options: ['A', 'B', 'C', 'D'], correctIndex: 0 } },
    { type: 'mcq', config: { question: 'Ikkinchi savol (qoralama)', options: ['A', 'B', 'C', 'D'], correctIndex: 1 } },
    { type: 'mcq', config: { question: 'Uchinchi savol (qoralama)', options: ['A', 'B', 'C', 'D'], correctIndex: 2 } },
  ];
  for (let i = 0; i < exam3Questions.length; i++) {
    const q = exam3Questions[i];
    await prisma.examQuestion.create({
      data: {
        examId:     exam3.id,
        type:       q.type,
        config:     q.config as never,
        orderIndex: i,
      },
    });
  }
  console.log(`  Created 3 exams (2 published, 1 draft).`);

  // ── 13. ExamPermissions ───────────────────────────────────────────────────────
  console.log('\n[12] Creating exam permissions...');

  const tester1Id = staffUsers['tester1'].id;
  const tester2Id = staffUsers['tester2'].id;

  const examPerms = [
    // lesson-anchored (active)
    { studentId: students[0].id, lessonId: lessons[0].id, examId: null, grantedBy: tester1Id,
      status: 'active' as const, score: null, passed: null },
    { studentId: students[1].id, lessonId: lessons[0].id, examId: null, grantedBy: tester1Id,
      status: 'done' as const, score: 85, passed: true },
    { studentId: students[2].id, lessonId: lessons[1].id, examId: null, grantedBy: tester2Id,
      status: 'done' as const, score: 55, passed: false },
    // catalogue-anchored
    { studentId: students[3].id,  lessonId: null, examId: exam1.id, grantedBy: tester1Id,
      status: 'active' as const, score: null, passed: null },
    { studentId: students[4].id,  lessonId: null, examId: exam1.id, grantedBy: tester1Id,
      status: 'done' as const, score: 90, passed: true },
    { studentId: students[5].id,  lessonId: null, examId: exam2.id, grantedBy: tester2Id,
      status: 'done' as const, score: 40, passed: false },
  ];

  let permCount = 0;
  for (const p of examPerms) {
    try {
      await prisma.examPermission.create({
        data: {
          studentId:   p.studentId,
          lessonId:    p.lessonId ?? undefined,
          examId:      p.examId   ?? undefined,
          grantedBy:   p.grantedBy,
          status:      p.status,
          score:       p.score   ?? undefined,
          passed:      p.passed  ?? undefined,
          completedAt: p.status === 'done' ? daysAgo(ri(1, 5)) : undefined,
        },
      });
      permCount++;
    } catch (err) {
      console.warn('  [WARN] ExamPermission skip:', (err as Error).message.slice(0, 80));
    }
  }
  console.log(`  Created ${permCount} exam permissions.`);

  // ── 14. ExamQueueEntry ────────────────────────────────────────────────────────
  console.log('\n[13] Creating exam queue entries...');

  const queueEntries = [
    { studentId: students[6].id,  branchId: branch1.id, lessonId: lessons[0].id, status: 'waiting' },
    { studentId: students[7].id,  branchId: branch1.id, lessonId: lessons[1].id, status: 'waiting' },
    { studentId: students[8].id,  branchId: branch2.id, lessonId: lessons[0].id, status: 'in_exam',
      startedAt: daysAgo(0) },
  ];
  let queueCount = 0;
  for (const q of queueEntries) {
    await prisma.examQueueEntry.create({
      data: {
        tenantId:  tenant.id,
        branchId:  q.branchId,
        studentId: q.studentId,
        lessonId:  q.lessonId,
        status:    q.status,
        startedAt: (q as { startedAt?: Date }).startedAt,
      },
    });
    queueCount++;
  }
  console.log(`  Created ${queueCount} queue entries.`);

  // ── 15. Payments ──────────────────────────────────────────────────────────────
  console.log('\n[14] Creating payments...');

  // One payment setting for the tenant
  await prisma.paymentSetting.upsert({
    where: { tenantId: tenant.id },
    update: {},
    create: {
      tenantId:      tenant.id,
      paymentStartDay: 1,
      paymentEndDay:   10,
    },
  });

  const month = currentMonth();
  let paidCount = 0;
  // ~80% of students paid
  for (let i = 0; i < students.length; i++) {
    if (i % 5 === 4) continue; // skip every 5th → ~80% paid
    const stu = students[i];
    try {
      await prisma.payment.create({
        data: {
          tenantId:   tenant.id,
          studentId:  stu.id,
          month,
          amount:     400_000,
          paidAt:     daysAgo(ri(1, 10)),
          recordedBy: staffUsers['filadmin1'].id,
          unblockAt:  daysFromNow(20),
        },
      });
      paidCount++;
    } catch {
      // unique (studentId, month)
    }
  }
  console.log(`  Created ${paidCount} payments (month ${month}).`);

  // ── 16. Tasks ─────────────────────────────────────────────────────────────────
  console.log('\n[15] Creating tasks...');

  const fa1 = staffUsers['filadmin1'].id;
  const fa2 = staffUsers['filadmin2'].id;
  const mg1 = staffUsers['manager1'].id;
  const mg2 = staffUsers['manager2'].id;
  const mt1 = staffUsers['mentor1'].id;
  const mt2 = staffUsers['mentor2'].id;

  const taskSpecs = [
    { title: 'Oy hisobotini tayyorlash',          from: fa1, to: mg1,          branch: branch1.id, status: 'sent' },
    { title: 'O\'quvchilar davomatini tekshirish', from: mg1, to: mt1,          branch: branch1.id, status: 'in_progress' },
    { title: 'Yangi talabalar bilan tanishing',   from: mg1, to: mt2,          branch: branch1.id, status: 'done' },
    { title: 'Kurs materiallarini yangilash',     from: fa2, to: mg2,          branch: branch2.id, status: 'seen' },
    { title: 'Dars rejasini topshirish',          from: mg2, to: staffUsers['mentor3'].id, branch: branch2.id, status: 'sent' },
    { title: 'O\'quvchi natijalarini tahlil qilish', from: mg2, to: staffUsers['mentor4'].id, branch: branch2.id, status: 'confirmed' },
    { title: 'Imtihon jadvalini tuzish',          from: fa1, to: staffUsers['tester1'].id,  branch: branch1.id, status: 'in_progress' },
    { title: 'Texnik muammoni bartaraf etish',    from: fa2, to: staffUsers['tester2'].id,  branch: branch2.id, status: 'done' },
    { title: 'Ota-onalarga xabar yuborish',       from: mg1, to: mt1,          branch: branch1.id, status: 'sent' },
    { title: 'Haftalik yig\'ilish o\'tkazish',   from: fa1, to: mg1,          branch: branch1.id, status: 'done' },
  ];

  let taskCount = 0;
  for (const t of taskSpecs) {
    await prisma.task.create({
      data: {
        tenantId:   tenant.id,
        branchId:   t.branch,
        createdBy:  t.from,
        assignedTo: t.to,
        title:      t.title,
        status:     t.status as 'sent' | 'seen' | 'in_progress' | 'done' | 'confirmed',
        deadline:   daysFromNow(ri(3, 14)),
        kpiBall:    pick([2, 3, 5]),
      },
    });
    taskCount++;
  }
  console.log(`  Created ${taskCount} tasks.`);

  // ── 17. KpiScore ──────────────────────────────────────────────────────────────
  console.log('\n[16] Creating KPI scores...');

  const kpiTargets = [
    staffUsers['mentor1'], staffUsers['mentor2'],
    staffUsers['mentor3'], staffUsers['mentor4'],
    staffUsers['tester1'], staffUsers['tester2'],
  ];
  let kpiCount = 0;
  for (const u of kpiTargets) {
    await prisma.kpiScore.create({
      data: {
        tenantId: tenant.id,
        userId:   u.id,
        date:     TODAY,
        score:    ri(60, 100),
        reason:   'Oylik KPI baholash',
      },
    });
    kpiCount++;
  }
  console.log(`  Created ${kpiCount} KPI scores.`);

  // ── 18. KpiOverrideLog ────────────────────────────────────────────────────────
  console.log('\n[17] Creating KPI override logs...');

  await prisma.kpiOverrideLog.create({
    data: {
      studentId: students[0].id,
      lessonId:  lessons[0].id,
      oldN:      3,
      newN:      5,
      changedBy: mg1,
      reason:    'O\'quvchi kuchli — takrorlash ko\'paytirildi',
    },
  });
  await prisma.kpiOverrideLog.create({
    data: {
      studentId: students[2].id,
      lessonId:  lessons[1].id,
      oldN:      3,
      newN:      2,
      changedBy: mg2,
      reason:    'Grammer kuchli — kamaytirildi',
    },
  });
  console.log('  Created 2 KPI override logs.');

  // ── 19. Tournament + Registrations ───────────────────────────────────────────
  console.log('\n[18] Creating tournament...');

  const tournament = await prisma.tournament.create({
    data: {
      tenantId: tenant.id,
      title:    "Bahor turniri 2026",
      type:     '1v1',
      status:   'active',
      startsAt: daysAgo(3),
      endsAt:   daysFromNow(4),
    },
  });
  let regCount = 0;
  for (const stu of students.slice(0, 6)) {
    try {
      await prisma.tournamentRegistration.create({
        data: {
          tournamentId: tournament.id,
          studentId:    stu.id,
        },
      });
      regCount++;
    } catch {
      // unique — skip
    }
  }
  console.log(`  Tournament created with ${regCount} registrations.`);

  // ── 20. ManagerReward ─────────────────────────────────────────────────────────
  console.log('\n[19] Creating manager rewards...');

  const rewardSpecs = [
    { managerId: mg1, studentId: students[0].id, branchId: branch1.id, type: 'kitob', title: 'Mukofot kitob: "Atomic Habits"' },
    { managerId: mg1, studentId: students[1].id, branchId: branch1.id, type: 'sovg\'a', title: 'Yutqazgani uchun sovg\'a' },
    { managerId: mg2, studentId: students[8].id, branchId: branch2.id, type: 'diplom', title: 'Oyning eng yaxshi o\'quvchisi' },
  ];
  for (const r of rewardSpecs) {
    await prisma.managerReward.create({
      data: {
        tenantId:   tenant.id,
        branchId:   r.branchId,
        managerId:  r.managerId,
        studentId:  r.studentId,
        type:       r.type,
        title:      r.title,
        description: 'Demo mukofot yozuvi',
        givenAt:    daysAgo(ri(1, 7)),
      },
    });
  }
  console.log('  Created 3 manager rewards.');

  // ── 21. ManagerSession ────────────────────────────────────────────────────────
  console.log('\n[20] Creating manager sessions...');

  const sessionPairs = [
    [mg1, students[0].id], [mg1, students[1].id], [mg1, students[2].id],
    [mg2, students[8].id], [mg2, students[9].id], [mg2, students[10].id],
    [mg1, students[3].id], [mg2, students[11].id],
  ] as [string, string][];

  let sessionCount = 0;
  for (const [mId, sId] of sessionPairs) {
    const isPast = Math.random() > 0.4;
    await prisma.managerSession.create({
      data: {
        managerId:   mId,
        studentId:   sId,
        scheduledAt: isPast ? daysAgo(ri(1, 7)) : daysFromNow(ri(1, 5)),
        completedAt: isPast ? daysAgo(ri(0, 3)) : null,
        notes:       isPast ? 'Suhbat yaxshi o\'tdi, progress ko\'rildi' : null,
      },
    });
    sessionCount++;
  }
  console.log(`  Created ${sessionCount} manager sessions.`);

  // ── 22. PromotionReport ───────────────────────────────────────────────────────
  console.log('\n[21] Creating promotion reports...');

  const promotionData = [
    { filadminId: fa1, branchId: branch1.id, school: '47-maktab',   reached: 30 },
    { filadminId: fa1, branchId: branch1.id, school: '12-maktab',   reached: 45 },
    { filadminId: fa2, branchId: branch2.id, school: 'Andijon litsеy', reached: 25 },
  ];
  for (const p of promotionData) {
    await prisma.promotionReport.create({
      data: {
        filadminId:      p.filadminId,
        branchId:        p.branchId,
        schoolName:      p.school,
        studentsReached: p.reached,
        visitDate:       daysAgo(ri(5, 20)),
        notes:           'Maktab rahbariyati bilan muloqot qilindi',
      },
    });
  }
  console.log('  Created 3 promotion reports.');

  // ── 23. ChurnScore ────────────────────────────────────────────────────────────
  console.log('\n[22] Creating churn scores...');

  let churnCount = 0;
  for (const stu of students.slice(0, 8)) {
    const score = ri(5, 90);
    await prisma.churnScore.create({
      data: {
        studentId: stu.id,
        tenantId:  tenant.id,
        score,
        signals: {
          missed_days:   ri(0, 5),
          xp_drop:       score > 50,
          payment_late:  score > 70,
        },
        alertSent: score > 75,
      },
    });
    churnCount++;
  }
  console.log(`  Created ${churnCount} churn scores.`);

  // ── 24. Warnings ─────────────────────────────────────────────────────────────
  console.log('\n[23] Creating warnings...');

  const warnData = [
    { studentId: students[2].id, givenBy: mt1, type: 'discipline' as const,   reason: 'Dars paytida telefon ishlatdi' },
    { studentId: students[5].id, givenBy: mt2, type: 'no_homework' as const,  reason: 'Uy vazifasini bajaarmadi' },
    { studentId: students[9].id, givenBy: staffUsers['mentor3'].id, type: 'not_prepared' as const, reason: 'Darsga tayyorlanmadi' },
  ];
  for (const w of warnData) {
    await prisma.warning.create({
      data: {
        tenantId:   tenant.id,
        studentId:  w.studentId,
        givenBy:    w.givenBy,
        type:       w.type,
        reasonType: w.type,
        reasonText: w.reason,
      },
    });
  }
  console.log('  Created 3 warnings.');

  // ── 25. ContactRequest ────────────────────────────────────────────────────────
  console.log('\n[24] Creating contact requests...');

  await prisma.contactRequest.createMany({
    data: [
      {
        centerName:  'Yunusobod o\'quv markazi',
        contactName: 'Hamid Tursunov',
        phone:       '+998901234567',
        email:       'hamid@example.com',
        centerSize:  'medium',
        message:     'Platformangiz haqida ko\'proq ma\'lumot olmoqchi edim',
        status:      'new',
      },
      {
        centerName:  'Smart Academy',
        contactName: 'Ziyoda Rahimova',
        phone:       '+998911234567',
        centerSize:  'small',
        status:      'contacted',
      },
      {
        centerName:  'Future Stars',
        contactName: 'Mirzo Umarov',
        phone:       '+998931234567',
        centerSize:  'large',
        status:      'demo_scheduled',
        notes:       'Demo 2026-05-10 da belgilangan',
      },
    ],
  });
  console.log('  Created 3 contact requests.');

  // ── 26. StaffVideoGuide ───────────────────────────────────────────────────────
  console.log('\n[25] Creating staff video guides...');

  await prisma.staffVideoGuide.createMany({
    data: [
      {
        tenantId: tenant.id,
        title:    'Filadmin: Filialini boshqarish',
        role:     'filadmin',
        videoUrl: 'https://www.youtube.com/watch?v=hZTkOcAjOCs',
        order:    1,
        createdBy: superadmin.id,
      },
      {
        tenantId: tenant.id,
        title:    'Mentor: Darslarni qanday o\'tkazish',
        role:     'mentor',
        videoUrl: 'https://www.youtube.com/watch?v=hZTkOcAjOCs',
        order:    1,
        createdBy: superadmin.id,
      },
      {
        tenantId: tenant.id,
        title:    'Tester: Imtihon jarayoni',
        role:     'tester',
        videoUrl: 'https://www.youtube.com/watch?v=hZTkOcAjOCs',
        order:    1,
        createdBy: superadmin.id,
      },
    ],
  });
  console.log('  Created 3 staff video guides.');

  // ── 27. NotificationTemplate ──────────────────────────────────────────────────
  console.log('\n[26] Creating notification templates...');

  const templates = [
    { key: 'payment_reminder',  body: 'Hurmatli {name}, {month} uchun to\'lov muddati yaqinlashmoqda.' },
    { key: 'lesson_unlocked',   body: '{name}, yangi dars ochildi: {lessonTitle}. Hozir o\'rganing!' },
    { key: 'streak_broken',     body: '{name}, streak uzildi. Bugun o\'qib streak qaytaring!' },
  ];
  for (const tmpl of templates) {
    await prisma.notificationTemplate.upsert({
      where: { tenantId_key: { tenantId: tenant.id, key: tmpl.key } },
      update: { body: tmpl.body },
      create: { tenantId: tenant.id, key: tmpl.key, body: tmpl.body },
    });
  }
  console.log(`  Created ${templates.length} notification templates.`);

  // ── 28. ChatKeyword ───────────────────────────────────────────────────────────
  console.log('\n[27] Creating chat keywords...');

  const keywords = ['yomon', 'ahmoq', 'stupid', 'idiot', 'bad', 'hate', 'ugly', 'fool'];
  let kwCount = 0;
  for (const word of keywords) {
    try {
      await prisma.chatKeyword.create({
        data: { tenantId: tenant.id, word },
      });
      kwCount++;
    } catch {
      // unique — skip duplicates
    }
  }
  console.log(`  Created ${kwCount} chat keywords.`);

  // ── 29. AdaptiveDifficultyConfig ──────────────────────────────────────────────
  console.log('\n[28] Creating adaptive difficulty config...');

  await prisma.adaptiveDifficultyConfig.upsert({
    where: { tenantId: tenant.id },
    update: {},
    create: {
      tenantId:      tenant.id,
      minN:          1,
      maxN:          10,
      hardThreshold: 0.40,
      easyThreshold: 0.15,
    },
  });
  console.log('  Created 1 adaptive difficulty config.');

  // ── 30. ErrorLog ──────────────────────────────────────────────────────────────
  console.log('\n[29] Creating error logs...');

  let errCount = 0;
  const errPairs = [
    [students[0].id, lessons[0].id, '"Wake up" tarjimasi nima?'],
    [students[1].id, lessons[0].id, '"Good morning" talaffuzi'],
    [students[2].id, lessons[1].id, 'She ___ to school'],
    [students[3].id, lessons[1].id, 'They ___ friends'],
    [students[4].id, lessons[2].id, 'Vocabulary test 1'],
    [students[5].id, lessons[2].id, 'Vocabulary test 2'],
    [students[6].id, lessons[0].id, '"Morning" antonimi'],
    [students[7].id, lessons[3].id, 'Grammar check'],
  ] as [string, string, string][];

  for (const [sid, lid, q] of errPairs) {
    try {
      await prisma.errorLog.create({
        data: {
          studentId:  sid,
          lessonId:   lid,
          question:   q,
          errorCount: ri(1, 5),
          notified:   Math.random() > 0.5,
          lastError:  daysAgo(ri(0, 7)),
        },
      });
      errCount++;
    } catch {
      // unique — skip
    }
  }
  console.log(`  Created ${errCount} error logs.`);

  // ── 31. TechIssue ─────────────────────────────────────────────────────────────
  console.log('\n[30] Creating tech issues...');

  await prisma.techIssue.createMany({
    data: [
      {
        tenantId:    tenant.id,
        branchId:    branch1.id,
        reportedBy:  staffUsers['tester1'].id,
        category:    'hardware',
        description: 'Kamera aniqlanmayapti',
        severity:    'high',
        status:      'open',
      },
      {
        tenantId:    tenant.id,
        branchId:    branch2.id,
        reportedBy:  staffUsers['tester2'].id,
        category:    'software',
        description: 'Audio qurilmasi ishlamayapti',
        severity:    'medium',
        status:      'resolved',
        resolution:  'Driver yangilandi',
        resolvedAt:  daysAgo(1),
      },
    ],
  });
  console.log('  Created 2 tech issues.');

  // ── 32. LessonVariant + StudentVariantAssignment ──────────────────────────────
  console.log('\n[31] Creating lesson variants...');

  const variants: { id: string; lessonId: string }[] = [];
  for (const lesson of lessons) {
    const v = await prisma.lessonVariant.create({
      data: {
        lessonId: lesson.id,
        variant:  'variant_a',
        isActive: true,
        config:   { description: 'Standard variant for A/B testing' },
      },
    });
    variants.push({ id: v.id, lessonId: lesson.id });
  }
  console.log(`  Created ${variants.length} lesson variants.`);

  // Assign ~half the students to variant_a of the first 3 lessons
  let varAssignCount = 0;
  const assignLessons = variants.slice(0, 3);
  for (const stu of students.slice(0, 8)) {
    for (const v of assignLessons) {
      try {
        await prisma.studentVariantAssignment.create({
          data: {
            studentId: stu.id,
            lessonId:  v.lessonId,
            variantId: v.id,
          },
        });
        varAssignCount++;
      } catch {
        // unique — skip
      }
    }
  }
  console.log(`  Created ${varAssignCount} student variant assignments.`);

  // ── 33. SpacedRepetitionItem ──────────────────────────────────────────────────
  console.log('\n[32] Creating spaced repetition items...');

  const SR_WORDS = ['morning', 'school', 'teacher', 'friend', 'happy', 'beautiful', 'run', 'eat', 'sleep', 'work'];
  let srCount = 0;
  for (const stu of students.slice(0, 5)) {
    const words = [...SR_WORDS].sort(() => Math.random() - 0.5).slice(0, ri(5, 8));
    for (const word of words) {
      try {
        await prisma.spacedRepetitionItem.create({
          data: {
            studentId:   stu.id,
            word,
            easeFactor:  2.0 + Math.random() * 1.0,
            interval:    ri(1, 7),
            repetitions: ri(1, 4),
            nextReview:  daysFromNow(ri(0, 5)),
          },
        });
        srCount++;
      } catch {
        // unique (studentId, word) — skip
      }
    }
  }
  console.log(`  Created ${srCount} spaced repetition items.`);

  // ── 34. Friendship ────────────────────────────────────────────────────────────
  console.log('\n[33] Creating friendships...');

  const friendPairs = [
    [students[0].id, students[1].id, 'accepted'],
    [students[0].id, students[2].id, 'accepted'],
    [students[1].id, students[3].id, 'pending'],
    [students[4].id, students[5].id, 'accepted'],
    [students[8].id, students[9].id, 'accepted'],
    [students[10].id, students[11].id, 'pending'],
  ] as [string, string, string][];

  let friendCount = 0;
  for (const [uid, fid, status] of friendPairs) {
    try {
      await prisma.friendship.create({
        data: {
          userId:   uid,
          friendId: fid,
          scope:    'branch',
          status,
        },
      });
      friendCount++;
    } catch {
      // unique — skip
    }
  }
  console.log(`  Created ${friendCount} friendships.`);

  // ── 35. Duel ─────────────────────────────────────────────────────────────────
  console.log('\n[34] Creating duels...');

  const duelQuestions = [
    { question: 'She ___ to school.', options: ['go','goes','going','gone'], correctIndex: 1 },
    { question: '"Happy" antonimi?',  options: ['Sad','Glad','Tired','Busy'],  correctIndex: 0 },
    { question: 'They ___ friends.',  options: ['is','am','are','be'],         correctIndex: 2 },
  ];

  const duelSpecs = [
    { challenger: students[0].id, challenged: students[1].id, status: 'completed' as const,
      cScore: 2, cdScore: 1, winnerId: students[0].id },
    { challenger: students[4].id, challenged: students[5].id, status: 'active' as const,
      cScore: 0, cdScore: 0, winnerId: null },
    { challenger: students[8].id, challenged: students[9].id, status: 'pending' as const,
      cScore: 0, cdScore: 0, winnerId: null },
  ];

  let duelCount = 0;
  for (const d of duelSpecs) {
    await prisma.duel.create({
      data: {
        challengerId:    d.challenger,
        challengedId:    d.challenged,
        tenantId:        tenant.id,
        questions:       duelQuestions,
        status:          d.status,
        challengerScore: d.cScore,
        challengedScore: d.cdScore,
        winnerId:        d.winnerId,
        expiresAt:       d.status === 'pending' ? daysFromNow(1) : daysAgo(0),
        createdAt:       daysAgo(ri(0, 3)),
      },
    });
    duelCount++;
  }
  console.log(`  Created ${duelCount} duels.`);

  // ── 36. Notifications ─────────────────────────────────────────────────────────
  console.log('\n[35] Creating notifications...');

  const notifTargets = [
    ...students.slice(0, 6).map((s) => ({ userId: s.id, type: 'lesson_unlocked', title: 'Yangi dars!', body: 'Yangi dars sizni kutmoqda' })),
    { userId: mg1, type: 'task_assigned', title: 'Yangi vazifa', body: 'Sizga yangi vazifa biriktirildi' },
    { userId: mt1, type: 'task_assigned', title: 'Yangi vazifa', body: 'O\'quvchilar davomati tekshirish' },
    { userId: staffUsers['tester1'].id, type: 'exam_queue', title: 'Imtihon navbati', body: '2 ta o\'quvchi imtihon navbatida' },
    { userId: fa1, type: 'report_ready', title: 'Hisobot tayyor', body: 'Oy hisoboti tayyorlanib bo\'ldi' },
  ];
  for (const n of notifTargets) {
    await prisma.notification.create({
      data: {
        userId:    n.userId,
        type:      n.type,
        title:     n.title,
        body:      n.body,
        isRead:    false,
        createdAt: daysAgo(ri(0, 3)),
      },
    });
  }
  console.log(`  Created ${notifTargets.length} notifications.`);

  // ── 37. SocialFeedEvent ───────────────────────────────────────────────────────
  console.log('\n[36] Creating social feed events...');

  const feedEventTypes = ['lesson_done', 'streak_milestone', 'duel_won', 'cert_earned', 'city_upgraded'] as const;
  let feedCount = 0;
  for (let i = 0; i < 10; i++) {
    const stu = students[i % students.length];
    await prisma.socialFeedEvent.create({
      data: {
        tenantId:  tenant.id,
        actorId:   stu.id,
        eventType: feedEventTypes[i % feedEventTypes.length],
        meta:      { xp: ri(10, 100), lessonTitle: lessons[i % lessons.length].title },
        createdAt: daysAgo(ri(0, 7)),
      },
    });
    feedCount++;
  }
  console.log(`  Created ${feedCount} social feed events.`);

  // ── 38. AnalyticsEvent ────────────────────────────────────────────────────────
  console.log('\n[37] Creating analytics events...');

  const analyticsTypes = ['session_start', 'session_end', 'lesson_complete'];
  let analyticsCount = 0;
  for (let i = 0; i < 25; i++) {
    const stu = students[i % students.length];
    const evType = analyticsTypes[i % analyticsTypes.length];
    await prisma.analyticsEvent.create({
      data: {
        tenantId:  tenant.id,
        eventType: evType,
        studentId: stu.id,
        branchId:  stu.branchId,
        data: {
          lessonId: lessons[i % lessons.length].id,
          duration: ri(120, 1800),
        },
        createdAt: daysAgo(ri(0, 7)),
      },
    });
    analyticsCount++;
  }
  console.log(`  Created ${analyticsCount} analytics events.`);

  // ── Summary ───────────────────────────────────────────────────────────────────
  console.log('\n=== SEED SUMMARY ===');

  const counts = await Promise.all([
    prisma.branch.count(),
    prisma.user.count(),
    prisma.studentXp.count(),
    prisma.exam.count(),
    prisma.examQuestion.count(),
    prisma.examPermission.count(),
    prisma.payment.count(),
    prisma.task.count(),
    prisma.kpiScore.count(),
    prisma.tournament.count(),
    prisma.tournamentRegistration.count(),
    prisma.warning.count(),
    prisma.churnScore.count(),
    prisma.contactRequest.count(),
    prisma.notification.count(),
    prisma.analyticsEvent.count(),
    prisma.letter.count(),
    prisma.studentLetter.count(),
    prisma.friendship.count(),
    prisma.duel.count(),
    prisma.lessonVariant.count(),
    prisma.studentVariantAssignment.count(),
    prisma.spacedRepetitionItem.count(),
    prisma.attendanceStudent.count(),
    prisma.studentProgress.count(),
    prisma.studentStatus.count(),
    prisma.studentBuilding.count(),
    prisma.managerReward.count(),
    prisma.managerSession.count(),
    prisma.promotionReport.count(),
    prisma.techIssue.count(),
    prisma.staffVideoGuide.count(),
    prisma.chatKeyword.count(),
    prisma.errorLog.count(),
    prisma.socialFeedEvent.count(),
    prisma.kpiOverrideLog.count(),
    prisma.notificationTemplate.count(),
    prisma.adaptiveDifficultyConfig.count(),
    prisma.examQueueEntry.count(),
    prisma.dailyQuest.count(),
    prisma.xpEvent.count(),
  ]);

  const labels = [
    'Branches', 'Users (total)', 'StudentXp', 'Exams', 'ExamQuestions',
    'ExamPermissions', 'Payments', 'Tasks', 'KpiScores', 'Tournaments',
    'TournamentRegistrations', 'Warnings', 'ChurnScores', 'ContactRequests',
    'Notifications', 'AnalyticsEvents', 'Letters', 'StudentLetters',
    'Friendships', 'Duels', 'LessonVariants', 'StudentVariantAssignments',
    'SpacedRepetitionItems', 'AttendanceStudents', 'StudentProgress',
    'StudentStatuses', 'StudentBuildings', 'ManagerRewards', 'ManagerSessions',
    'PromotionReports', 'TechIssues', 'StaffVideoGuides', 'ChatKeywords',
    'ErrorLogs', 'SocialFeedEvents', 'KpiOverrideLogs', 'NotificationTemplates',
    'AdaptiveDifficultyConfigs', 'ExamQueueEntries', 'DailyQuests', 'XpEvents',
  ];

  for (let i = 0; i < labels.length; i++) {
    console.log(`  ${labels[i].padEnd(30)} ${counts[i]}`);
  }

  console.log('\n=== A\'lochi demo seed — DONE ===');
  console.log('Login credentials: login=<role><n>  password=demo12345');
  console.log('  e.g. filadmin1 / demo12345   manager1 / demo12345   student1 / demo12345');
}

main()
  .catch((err) => {
    console.error('[ERROR]', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
