/**
 * Seed STEPs 41-80 of the A'lochi curriculum (44 new lessons total)
 * into the alochi tenant. Continues right after seed-alochi-40 — that
 * file populates orderNumbers 1-44, this one populates 45-88.
 *
 * Coverage:
 *   • PDF STEPs 41-51 → orderNumbers 45-55
 *   • TAKRORLASH 41-51 → orderNumber 56
 *   • PDF STEPs 52-61 → orderNumbers 57-66
 *   • TAKRORLASH 52-61 → orderNumber 67
 *   • PDF STEPs 62-71 → orderNumbers 68-77
 *   • TAKRORLASH 62-71 → orderNumber 78
 *   • PDF STEPs 72-80 → orderNumbers 79-87
 *   • TAKRORLASH 1-80 final → orderNumber 88
 *
 * Uses the helper builders exported from seed-alochi-40 — same shape, no
 * duplication. Idempotent: rerun upserts each lesson by
 * (tenantId, orderNumber) and rebuilds its LessonComponent rows from
 * scratch.
 *
 * Usage from repo root:
 *   pnpm --filter api exec ts-node -r tsconfig-paths/register \
 *     ../../prisma/seed-alochi-41-80.ts --tenant <slug>
 *
 * Defaults to tenant slug 'alochi' when --tenant is omitted.
 */
import { PrismaClient, LessonType } from '@prisma/client';
import {
  mcq,
  wordOrder,
  translate,
  listenType,
  matchPairs,
  fillBlank,
  speakSentence,
  speakWords,
  vocabBlock,
  phraseBlock,
  topicSentenceBlock,
} from './seed-alochi-40';

const prisma = new PrismaClient();

interface ComponentSpec {
  type: string;
  config: Record<string, unknown>;
}

interface LessonSpec {
  orderNumber: number;
  title: string;
  type: LessonType;
  aiTutorContext?: string;
  nRepetitions?: number;
  hasExam?: boolean;
  aiTutorEnabled?: boolean;
  youtubeUrl?: string;
  components: ComponentSpec[];
}

// ─── lesson definitions ─────────────────────────────────────────────────────

const LESSONS: LessonSpec[] = [
  // (filled in by the per-batch subagents)
];

// ─── main ───────────────────────────────────────────────────────────────────

async function main() {
  const tenantSlug = (() => {
    const idx = process.argv.indexOf('--tenant');
    if (idx !== -1 && process.argv[idx + 1]) return process.argv[idx + 1];
    return 'alochi';
  })();

  console.log(`--- Seeding A'lochi STEPs 41-80 into tenant '${tenantSlug}' ---`);

  const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
  if (!tenant) {
    console.error(`[ABORT] No tenant with slug '${tenantSlug}'.`);
    process.exit(1);
  }
  console.log(`Tenant: ${tenant.name} (${tenant.id})`);

  let created = 0;
  let updated = 0;
  let totalComponents = 0;

  for (const spec of LESSONS) {
    const existing = await prisma.lesson.findFirst({
      where: { tenantId: tenant.id, orderNumber: spec.orderNumber },
    });

    const lessonData = {
      tenantId: tenant.id,
      title: spec.title,
      type: spec.type,
      orderNumber: spec.orderNumber,
      youtubeUrl: spec.youtubeUrl ?? '',
      nRepetitions: spec.nRepetitions ?? 3,
      isPublished: true,
      hasExam: spec.hasExam ?? false,
      cameraEnabled: false,
      ...(spec.aiTutorContext !== undefined ? { aiTutorContext: spec.aiTutorContext } : {}),
      components: {
        mcq: spec.components.some((c) => c.type === 'mcq'),
        word_order: spec.components.some((c) => c.type === 'word_order'),
        vocabulary: false,
        ai_tutor: spec.aiTutorEnabled ?? false,
        camera: false,
      } as never,
    };

    let lesson;
    if (existing) {
      lesson = await prisma.lesson.update({ where: { id: existing.id }, data: lessonData });
      await prisma.lessonComponent.deleteMany({ where: { lessonId: lesson.id } });
      updated++;
    } else {
      lesson = await prisma.lesson.create({ data: lessonData });
      created++;
    }

    for (const c of spec.components) {
      await prisma.lessonComponent.create({
        data: { lessonId: lesson.id, type: c.type, config: c.config as never },
      });
    }
    totalComponents += spec.components.length;
    console.log(`  #${spec.orderNumber.toString().padStart(2)} ${spec.title}  +${spec.components.length} components`);
  }

  console.log(`\nDone. ${LESSONS.length} lessons (${created} created, ${updated} updated), ${totalComponents} components.`);
}

if (require.main === module) {
  main()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}

// Re-export helpers so an importer (or tests) can pull from here too.
export {
  mcq,
  wordOrder,
  translate,
  listenType,
  matchPairs,
  fillBlank,
  speakSentence,
  speakWords,
  vocabBlock,
  phraseBlock,
  topicSentenceBlock,
};
