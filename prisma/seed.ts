import { PrismaClient, UserRole, LessonType } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
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

  // Lesson 1
  const lesson1 = await prisma.lesson.upsert({
    where: { id: '00000000-0000-0000-0000-000000000101' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000101',
      tenantId: testTenant.id,
      title: 'Present Simple — Asoslar',
      type: LessonType.english,
      orderNumber: 1,
      youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      nRepetitions: 3,
      maxNOverride: 10,
      isPublished: true,
    },
  });

  // Lesson 2
  const _lesson2 = await prisma.lesson.upsert({
    where: { id: '00000000-0000-0000-0000-000000000102' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000102',
      tenantId: testTenant.id,
      title: 'Past Simple — Amaliyot',
      type: LessonType.english,
      orderNumber: 2,
      youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      nRepetitions: 5,
      maxNOverride: 15,
      isPublished: true,
    },
  });

  // MCQ component for lesson1
  await prisma.lessonComponent.upsert({
    where: { id: '00000000-0000-0000-0000-000000000201' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000201',
      lessonId: lesson1.id,
      type: 'mcq',
      config: {
        question: 'She ___ to school every day.',
        options: ['go', 'goes', 'going', 'gone'],
        correctIndex: 1,
      },
    },
  });

  // Lessons 3–5
  await prisma.lesson.upsert({
    where: { id: '00000000-0000-0000-0000-000000000103' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000103',
      tenantId: testTenant.id,
      title: 'Present Continuous — Ish davomida',
      type: LessonType.english,
      orderNumber: 3,
      youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      nRepetitions: 3,
      maxNOverride: 10,
      isPublished: true,
    },
  });

  await prisma.lesson.upsert({
    where: { id: '00000000-0000-0000-0000-000000000104' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000104',
      tenantId: testTenant.id,
      title: 'Future Simple — Kelajak zamonasi',
      type: LessonType.english,
      orderNumber: 4,
      youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      nRepetitions: 4,
      maxNOverride: 12,
      isPublished: true,
    },
  });

  await prisma.lesson.upsert({
    where: { id: '00000000-0000-0000-0000-000000000105' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000105',
      tenantId: testTenant.id,
      title: 'Present Perfect — Tajriba va yutuqlar',
      type: LessonType.english,
      orderNumber: 5,
      youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      nRepetitions: 5,
      maxNOverride: 15,
      isPublished: true,
    },
  });

  // StudentXp for student1
  await prisma.studentXp.upsert({
    where: { studentId: student1.id },
    update: {},
    create: {
      studentId: student1.id,
      totalXp: 150,
      currentStreak: 3,
      longestStreak: 3,
      shieldCount: 1,
      lastActivity: new Date(),
    },
  });

  // Group Challenge (demo groups A vs B)
  const groupAId = '00000000-0000-0000-0001-000000000001';
  const groupBId = '00000000-0000-0000-0001-000000000002';
  await prisma.groupChallenge.upsert({
    where: { id: '00000000-0000-0000-0002-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0002-000000000001',
      tenantId: testTenant.id,
      groupAId,
      groupBId,
      startDate: new Date(),
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      status: 'active',
      groupAXp: 120,
      groupBXp: 80,
    },
  });

  // Active Duel: student1 vs student2
  const student2Id = '00000000-0000-0000-0000-000000000016';
  await prisma.duel.upsert({
    where: { id: '00000000-0000-0000-0003-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0003-000000000001',
      challengerId: student1.id,
      challengedId: student2Id,
      tenantId: testTenant.id,
      questions: [
        { question: 'She ___ English every day.', options: ['study', 'studies', 'studying', 'studied'], correctIndex: 1 },
        { question: 'They ___ to school now.', options: ['go', 'goes', 'are going', 'went'], correctIndex: 2 },
      ],
      status: 'active',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });

  console.log('✅ Seed bajarildi: 7 foydalanuvchi (6 rol), 5 dars, 1 MCQ, 1 XP, 1 guruh challenge, 1 faol duel');
}

main().finally(() => prisma.$disconnect());
