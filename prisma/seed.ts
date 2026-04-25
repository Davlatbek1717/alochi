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
  await prisma.lesson.upsert({
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

  // StudentXp for student1
  await prisma.studentXp.upsert({
    where: { studentId: student1.id },
    update: {},
    create: {
      studentId: student1.id,
      totalXp: 150,
      currentStreak: 3,
      shieldCount: 1,
      lastActivity: new Date(),
    },
  });

  console.log('✅ Seed bajarildi: 6 rol, 2 dars, 1 MCQ, 1 XP yozuvi');
}

main().finally(() => prisma.$disconnect());
