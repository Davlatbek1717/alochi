/**
 * Seed a complete STEP 1 lesson — "Xayrli tong" — with one of every
 * exercise type the platform supports. Built from the A'lochi curriculum
 * PDF (1-40_alochi.pdf), STEP 1 page:
 *   Good morning!     → Xayrli tong!
 *   Wake up, Ali.     → Uyg'on, Ali.
 *   Morning, everyone → Xayrli tong, hammaga
 *
 * Idempotent: re-running upserts the lesson by orderNumber and rebuilds
 * the components from scratch so config tweaks land cleanly.
 *
 * Usage from repo root:
 *   pnpm exec ts-node -r tsconfig-paths/register prisma/seed-step-1.ts
 */
import { PrismaClient, LessonType } from '@prisma/client';

const prisma = new PrismaClient();

// Stable IDs so option-references inside configs stay valid across reseeds.
const ORDER_NUMBER = 1;

async function main() {
  console.log('--- Seeding STEP 1 — Xayrli tong ---');

  const tenant = await prisma.tenant.findFirst();
  if (!tenant) {
    console.error('[ABORT] No tenant exists. Run clean-db.ts or restore data first.');
    process.exit(1);
  }
  console.log(`Tenant: ${tenant.name} (${tenant.slug})`);

  // Upsert the Lesson row by (tenantId, orderNumber).
  // Prisma doesn't have a compound unique on these by default, so we do
  // findFirst → update | create.
  const existing = await prisma.lesson.findFirst({
    where: { tenantId: tenant.id, orderNumber: ORDER_NUMBER },
  });

  const lessonData = {
    tenantId: tenant.id,
    title: 'STEP 1 — Xayrli tong',
    type: LessonType.english,
    orderNumber: ORDER_NUMBER,
    // Public, embeddable kid-safe English-greetings video. The student-side
    // VideoPlayer parser accepts every common YouTube URL shape.
    youtubeUrl: 'https://www.youtube.com/watch?v=hZTkOcAjOCs',
    nRepetitions: 3,
    isPublished: true,
    hasExam: false,
    cameraEnabled: false,
    // Legacy components-flag JSON — controls which component sections show
    // in the lesson runner before the new per-component configurator picks
    // up the rest. mcq/word_order are also seeded as full LessonComponent
    // rows below; the boolean here is the dashboard-level toggle.
    components: {
      mcq: true,
      word_order: true,
      vocabulary: false,
      ai_tutor: true,
      camera: false,
    } as never,
  };

  let lesson;
  if (existing) {
    lesson = await prisma.lesson.update({
      where: { id: existing.id },
      data: lessonData,
    });
    // Wipe any previous components so the seed is deterministic.
    await prisma.lessonComponent.deleteMany({ where: { lessonId: lesson.id } });
    console.log(`Existing lesson updated: ${lesson.id}`);
  } else {
    lesson = await prisma.lesson.create({ data: lessonData });
    console.log(`New lesson created: ${lesson.id}`);
  }

  // Components are stored in `LessonComponent` with a stringly-typed
  // `type` and a free-form `config` JSON. We seed one of every supported
  // type so the running showcase covers every student-side renderer.
  const components: { type: string; config: Record<string, unknown> }[] = [
    // 1. MCQ — multiple choice
    {
      type: 'mcq',
      config: {
        questions: [
          {
            text: '"Xayrli tong" inglizchada qanday?',
            options: [
              'Good night',
              'Good morning',
              'Good evening',
              'Hello',
            ],
            correct: 1,
          },
          {
            text: '"Wake up" so\'zining ma\'nosi nima?',
            options: ['Yot', 'Yur', 'Uyg\'on', 'Yurish'],
            correct: 2,
          },
          {
            text: '"Morning, everyone" qanday tarjima qilinadi?',
            options: [
              'Salom, hammaga',
              'Xayr, hammaga',
              'Xayrli tong, hammaga',
              'Yaxshi tong',
            ],
            correct: 2,
          },
        ],
      },
    },

    // 2. Word order — drag words to form the sentence
    {
      type: 'word_order',
      config: {
        sentences: [
          {
            words: ['everyone', 'Good', 'morning'],
            correct: 'Good morning everyone',
          },
          {
            words: ['Ali', 'up', 'Wake'],
            correct: 'Wake up Ali',
          },
        ],
      },
    },

    // 3. Translate — type the English translation
    {
      type: 'translate',
      config: {
        sourceText: 'Xayrli tong!',
        correctAnswer: 'Good morning!',
        targetLanguage: 'en',
        acceptedAnswers: [
          'good morning',
          'Good morning',
          'good morning!',
        ],
        hint: '3 ta so\'zdan iborat — birinchi harf "G"',
      },
    },

    // 4. Listen & pick — audio plays, student picks the matching option
    {
      type: 'listen_pick',
      config: {
        text: 'Good morning',
        options: [
          { id: 'a', label: 'Xayrli tun' },
          { id: 'b', label: 'Xayrli tong' },
          { id: 'c', label: 'Xayrli kun' },
          { id: 'd', label: 'Xayr' },
        ],
        correctOptionId: 'b',
      },
    },

    // 5. Listen & type — audio plays, student types what they heard
    {
      type: 'listen_type',
      config: {
        text: 'Wake up Ali',
        acceptedAnswers: ['wake up Ali', 'Wake up, Ali', 'wake up ali'],
        context: 'Birni uyg\'otish: "Wake up, [ism]"',
      },
    },

    // 6. Match pairs — memory game, English ↔ Uzbek
    {
      type: 'match_pairs',
      config: {
        pairs: [
          { left: 'Good morning', right: 'Xayrli tong' },
          { left: 'Wake up', right: "Uyg'on" },
          { left: 'Morning', right: 'Tong' },
          { left: 'Everyone', right: 'Hammaga' },
        ],
      },
    },

    // 7. Pick picture — given the English word, pick the matching image
    {
      type: 'pick_picture',
      config: {
        word: 'Morning',
        options: [
          {
            id: 'sun',
            imageUrl:
              'https://placehold.co/400x400/fbbf24/0f172a?text=☀️+Morning',
          },
          {
            id: 'moon',
            imageUrl:
              'https://placehold.co/400x400/0f172a/fbbf24?text=🌙+Night',
          },
          {
            id: 'sleeping',
            imageUrl:
              'https://placehold.co/400x400/64748b/ffffff?text=😴+Sleep',
          },
          {
            id: 'wave',
            imageUrl:
              'https://placehold.co/400x400/1cb0f6/ffffff?text=👋+Hello',
          },
        ],
        correctOptionId: 'sun',
      },
    },

    // 8. Fill in the blank — tap-mode with alternatives word bank
    {
      type: 'fill_blank',
      config: {
        sentence: 'Good ___, everyone!',
        blank: 'morning',
        alternatives: ['morning', 'night', 'evening', 'afternoon'],
        acceptedAnswers: ['morning'],
      },
    },

    // 9. Spelling — listen and spell letter-by-letter
    {
      type: 'spelling',
      config: {
        word: 'morning',
        audioPlay: true,
      },
    },

    // 10. Order sentences — drag to put 3 sentences in order
    {
      type: 'order_sentences',
      config: {
        sentences: [
          'Wake up, Ali.',
          'Good morning, everyone!',
          'It is time for school.',
        ],
      },
    },

    // 11. Speak sentence — read the full sentence aloud
    {
      type: 'speak_sentence',
      config: {
        sentence: 'Good morning, everyone!',
        minScore: 70,
      },
    },

    // 12. Speak words — Monkeytype-style word-by-word read-aloud
    {
      type: 'speak_words',
      config: {
        text: 'Good morning everyone wake up Ali',
        minScore: 70,
      },
    },
  ];

  for (const c of components) {
    await prisma.lessonComponent.create({
      data: {
        lessonId: lesson.id,
        type: c.type,
        config: c.config as never,
      },
    });
    console.log(`  + ${c.type}`);
  }

  console.log(`\nDone. ${components.length} components seeded.`);
  console.log(
    `Open: http://localhost:3000/superadmin/lessons/${lesson.id} (admin view)`,
  );
  console.log(
    `Or:   http://localhost:3000/student/lessons/${lesson.id} (student view)`,
  );
}

main()
  .catch((err) => {
    console.error('[ERROR]', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
