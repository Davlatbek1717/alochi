import { PrismaClient, UserRole } from '@prisma/client';
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

  console.log('✅ Seed bajarildi');
}

main().finally(() => prisma.$disconnect());
