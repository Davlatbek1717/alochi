/**
 * Seed the full A'lochi 1-40 curriculum (44 lessons total) into one tenant.
 *
 *   • PDF STEPs 1-40 → orderNumbers 1, 2, 3, 4, 5, 6, ..., 11, then 13, 14, ... 22, then 24...
 *   • 4 standalone TAKRORLASH checkpoints inserted at orderNumbers 12, 23, 34, 44.
 *
 * Spec: docs/superpowers/specs/2026-05-10-alochi-40-lesson-curriculum-design.md
 *
 * Idempotent: rerun upserts each lesson by (tenantId, orderNumber) and
 * rebuilds its LessonComponent rows from scratch.
 *
 * Usage from repo root:
 *   pnpm --filter api exec ts-node -r tsconfig-paths/register \
 *     ../../prisma/seed-alochi-40.ts --tenant <slug>
 *
 * Defaults to tenant slug 'alochi' when --tenant is omitted.
 */
import { PrismaClient, LessonType } from '@prisma/client';

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

// ─── helper builders ────────────────────────────────────────────────────────

export function mcq(
  questions: Array<{ text: string; options: string[]; correct: number }>,
): ComponentSpec {
  return { type: 'mcq', config: { questions } };
}

export function wordOrder(
  sentences: Array<{ words: string[]; correct: string }>,
): ComponentSpec {
  return { type: 'word_order', config: { sentences } };
}

export function translate(
  sourceText: string,
  correctAnswer: string,
  acceptedAnswers: string[] = [],
  hint?: string,
): ComponentSpec {
  return {
    type: 'translate',
    config: {
      sourceText,
      correctAnswer,
      targetLanguage: 'en',
      acceptedAnswers: [
        correctAnswer.toLowerCase(),
        correctAnswer.toLowerCase().replace(/[.!?]+$/, ''),
        ...acceptedAnswers,
      ],
      ...(hint ? { hint } : {}),
    },
  };
}

export function listenPick(
  text: string,
  options: Array<{ id: string; label: string }>,
  correctOptionId: string,
): ComponentSpec {
  return { type: 'listen_pick', config: { text, options, correctOptionId } };
}

export function listenType(
  text: string,
  acceptedAnswers: string[] = [],
): ComponentSpec {
  return {
    type: 'listen_type',
    config: {
      text,
      acceptedAnswers: [
        text.toLowerCase(),
        text.toLowerCase().replace(/[.!?,]+/g, ''),
        ...acceptedAnswers,
      ],
    },
  };
}

export function matchPairs(
  pairs: Array<{ left: string; right: string }>,
): ComponentSpec {
  return { type: 'match_pairs', config: { pairs } };
}

export function fillBlank(
  sentence: string,
  blank: string,
  alternatives: string[],
): ComponentSpec {
  return {
    type: 'fill_blank',
    config: {
      sentence,
      blank,
      alternatives,
      acceptedAnswers: [blank.toLowerCase()],
    },
  };
}

export function spelling(word: string): ComponentSpec {
  return { type: 'spelling', config: { word, audioPlay: true } };
}

export function speakSentence(sentence: string, minScore = 70): ComponentSpec {
  return { type: 'speak_sentence', config: { sentence, minScore } };
}

export function speakWords(text: string, minScore = 70): ComponentSpec {
  return { type: 'speak_words', config: { text, minScore } };
}

/**
 * Three exercises for one new English vocab word: hear it, spell it, translate it,
 * speak it. The 4 distractors for listen_pick must be supplied by the caller so
 * they're plausible (related vocabulary from the same lesson or the prior step).
 */
export function vocabBlock(opts: {
  uz: string;
  en: string;
  distractors: string[]; // 3 EN words
}): ComponentSpec[] {
  return [
    listenPick(
      opts.en,
      [
        { id: 'a', label: opts.en },
        { id: 'b', label: opts.distractors[0] },
        { id: 'c', label: opts.distractors[1] },
        { id: 'd', label: opts.distractors[2] },
      ],
      'a',
    ),
    spelling(opts.en),
    translate(opts.uz, opts.en),
    speakSentence(opts.en, 65),
  ];
}

/**
 * Three exercises for one EN phrase paired with its UZ meaning: listen+type,
 * UZ→EN translate, speak-aloud.
 */
export function phraseBlock(uz: string, en: string): ComponentSpec[] {
  return [listenType(en), translate(uz, en), speakSentence(en, 70)];
}

/**
 * Three exercises for one topic sentence: word_order, translate, speak.
 * `words` should be the EN sentence already split into the tokens shown to
 * the student (case + punctuation included).
 */
export function topicSentenceBlock(opts: {
  uz: string;
  en: string;
  words: string[];
}): ComponentSpec[] {
  return [
    wordOrder([{ words: shuffleStable(opts.words), correct: opts.en }]),
    translate(opts.uz, opts.en),
    speakSentence(opts.en, 70),
  ];
}

/**
 * Deterministic shuffle so reseeds produce the same word order. Uses a
 * fixed seed derived from the sentence so each call is stable but
 * different sentences shuffle differently.
 */
export function shuffleStable<T>(arr: T[]): T[] {
  const out = [...arr];
  let seed = arr.join('|').length * 31 + 7;
  for (let i = out.length - 1; i > 0; i--) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    const j = seed % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ─── lesson definitions ─────────────────────────────────────────────────────

const LESSONS: LessonSpec[] = [
  // (filled in by Tasks 4-15)
];

// ─── main ───────────────────────────────────────────────────────────────────

async function main() {
  const tenantSlug = (() => {
    const idx = process.argv.indexOf('--tenant');
    if (idx !== -1 && process.argv[idx + 1]) return process.argv[idx + 1];
    return 'alochi';
  })();

  console.log(`--- Seeding A'lochi 40-step curriculum into tenant '${tenantSlug}' ---`);

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
