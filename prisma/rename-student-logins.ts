/**
 * One-off helper: preview / apply firstname+lastname logins for every
 * student in the alochi tenant.
 *
 * Pass --apply to actually update the DB. Without it, only prints the
 * preview so you can spot collisions before committing.
 *
 * Usage:
 *   pnpm --filter api exec ts-node -r tsconfig-paths/register \
 *     ../../prisma/rename-student-logins.ts            # preview
 *   pnpm --filter api exec ts-node -r tsconfig-paths/register \
 *     ../../prisma/rename-student-logins.ts --apply    # apply
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Strip every shape of apostrophe used in transliterated Uzbek names.
const APOSTROPHES = /['ʼʻ‘’`´]/g;

function mkLogin(name: string): string {
  const parts = name
    .replace(APOSTROPHES, '')
    .toLowerCase()
    .split(/\s+/)
    .filter((s) => s.length > 0);
  return parts.slice(0, 2).join('');
}

async function main() {
  const apply = process.argv.includes('--apply');

  const students = await prisma.user.findMany({
    where: { role: 'student' },
    select: { id: true, name: true, login: true },
    orderBy: { name: 'asc' },
  });
  const others = await prisma.user.findMany({
    where: { role: { not: 'student' } },
    select: { login: true },
  });
  const otherLogins = new Set(others.map((u) => u.login));

  // Build target → {students who collide on it}
  const targetMap = new Map<string, { id: string; name: string }[]>();
  for (const s of students) {
    const target = mkLogin(s.name);
    const arr = targetMap.get(target) ?? [];
    arr.push(s);
    targetMap.set(target, arr);
  }

  console.log('=== PREVIEW ===');
  students.forEach((s, i) => {
    const newL = mkLogin(s.name);
    const flags: string[] = [];
    if (otherLogins.has(newL)) flags.push('CONFLICT-WITH-STAFF');
    if ((targetMap.get(newL)?.length ?? 0) > 1) flags.push('DUP-IN-STUDENTS');
    const flag = flags.length ? ' [' + flags.join(',') + ']' : '';
    console.log(
      String(i + 1).padStart(2) +
        '. ' +
        s.name.padEnd(35) +
        ' ' +
        s.login.padEnd(22) +
        ' -> ' +
        newL +
        flag,
    );
  });

  const dups = Array.from(targetMap.entries()).filter(([, v]) => v.length > 1);
  const staffConflicts = students.filter((s) => otherLogins.has(mkLogin(s.name)));

  console.log('\n=== SUMMARY ===');
  console.log('Total students:', students.length);
  console.log('Student-student collisions:', dups.length);
  for (const [login, list] of dups) {
    console.log('  ' + login + ' <- ' + list.map((s) => s.name).join(', '));
  }
  console.log('Conflicts with staff logins:', staffConflicts.length);
  for (const s of staffConflicts) {
    console.log('  ' + s.name + ' -> ' + mkLogin(s.name));
  }

  if (!apply) {
    console.log('\n(dry run — pass --apply to actually update the DB)');
    return;
  }

  // Apply: handle dups by appending a numeric suffix in stable name order.
  console.log('\n=== APPLYING ===');
  let updated = 0;
  let skippedSameLogin = 0;
  for (const [target, list] of targetMap.entries()) {
    if (list.length === 1) {
      const s = list[0];
      if (s.login === target) {
        skippedSameLogin++;
        continue;
      }
      // Skip if this exact target collides with a staff login.
      if (otherLogins.has(target)) {
        console.log('SKIP (staff conflict):', s.name, '->', target);
        continue;
      }
      await prisma.user.update({
        where: { id: s.id },
        data: { login: target },
      });
      updated++;
      continue;
    }
    // Duplicate target — number them in name-sorted order.
    list.sort((a, b) => a.name.localeCompare(b.name));
    for (let i = 0; i < list.length; i++) {
      const s = list[i];
      const candidate = i === 0 ? target : `${target}${i + 1}`;
      if (otherLogins.has(candidate)) {
        console.log('SKIP (staff conflict):', s.name, '->', candidate);
        continue;
      }
      if (s.login === candidate) {
        skippedSameLogin++;
        continue;
      }
      await prisma.user.update({
        where: { id: s.id },
        data: { login: candidate },
      });
      console.log('  dup:', s.name, '->', candidate);
      updated++;
    }
  }
  console.log(`Done. Updated ${updated}, unchanged (already matched) ${skippedSameLogin}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
