# A'lochi 40-Step Curriculum Seed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single TypeScript seed script `prisma/seed-alochi-40.ts` that creates all 44 lessons (40 PDF STEPs + 4 TAKRORLASH checkpoints) in one tenant, with every lesson's components configured per the design spec.

**Architecture:** One self-contained script (~1500-2000 lines) following the existing `seed-steps-2-10.ts` pattern: typed `LessonSpec`/`ComponentSpec`, ~10 builder helpers, one big `LESSONS` array, idempotent `main()` that upserts each lesson and rebuilds its components in a transaction. The old `seed-step-1.ts` and `seed-steps-2-10.ts` are deleted at the end since the new script supersedes them.

**Tech Stack:** TypeScript, Prisma 5.22, ts-node, jest (for builder unit tests). No new runtime deps.

**Source documents (must be at hand while authoring):**
- Design spec: `docs/superpowers/specs/2026-05-10-alochi-40-lesson-curriculum-design.md`
- PDF text extract: `/tmp/alochi-book.txt` (run `pdftotext -layout 1-40_alochi.pdf` if missing)
- Existing pattern reference: `prisma/seed-steps-2-10.ts`

---

## Task 0: Pre-flight checks

**Files:**
- Read: `docs/superpowers/specs/2026-05-10-alochi-40-lesson-curriculum-design.md`
- Read: `/tmp/alochi-book.txt` (or regenerate)
- Read: `prisma/seed-steps-2-10.ts` (the pattern we copy from)

- [ ] **Step 1: Confirm spec is committed and readable**

Run: `git log --oneline -5 -- docs/superpowers/specs/2026-05-10-alochi-40-lesson-curriculum-design.md`

Expected: at least one commit visible.

- [ ] **Step 2: Re-extract PDF text if /tmp/alochi-book.txt is missing**

Run:
```bash
test -f /tmp/alochi-book.txt || \
  "/c/Program Files/Git/mingw64/bin/pdftotext.exe" -layout \
    "/c/Users/davla/Downloads/Telegram Desktop/1-40_alochi.pdf" /tmp/alochi-book.txt
wc -l /tmp/alochi-book.txt
```

Expected: ~1250 lines.

- [ ] **Step 3: Identify the target tenant**

Run:
```bash
ssh -i ~/.ssh/alochi_deploy root@164.68.109.208 \
  "cd /var/www/alochi && pnpm --filter api exec ts-node -r tsconfig-paths/register -e \
  'import {PrismaClient} from \"@prisma/client\"; new PrismaClient().tenant.findMany({select:{id:true,slug:true,name:true}}).then(t=>console.log(JSON.stringify(t,null,2)))'"
```

Expected: a list of tenants. Pick the slug to use (likely `alochi` or the live tenant). Confirm with the human if more than one is plausible.

---

## Task 1: Create the seed file skeleton

**Files:**
- Create: `prisma/seed-alochi-40.ts`

- [ ] **Step 1: Create the file with header, imports, helpers signature, and main scaffolding**

```typescript
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
// (filled in by Task 2)

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

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 2: Type-check it**

Run from repo root:
```bash
pnpm --filter api exec tsc --noEmit -p ../../prisma/tsconfig.json prisma/seed-alochi-40.ts
```

If `prisma/tsconfig.json` doesn't list seed-alochi-40 explicitly, it should still pick it up by glob. If you get a "type LessonType has no member" error, run `pnpm --filter api exec prisma generate` first.

Expected: no errors. (Some unused `LessonSpec` warnings are OK — fixed when builders are filled in.)

- [ ] **Step 3: Commit**

```bash
git add prisma/seed-alochi-40.ts
git commit -m "feat(seed): scaffolding for A'lochi 40-step curriculum seed"
```

---

## Task 2: Add the builder helpers (copied + extended from seed-steps-2-10.ts)

**Files:**
- Modify: `prisma/seed-alochi-40.ts` — add helpers between `// ─── helper builders ───` and `// ─── lesson definitions ───`

- [ ] **Step 1: Insert the 10 component builders**

Replace the `// (filled in by Task 2)` placeholder with this block (it is a verbatim copy of `seed-steps-2-10.ts:43-175` plus two small additions for personal-development MCQ and `mini_match` aliasing):

```typescript
function mcq(
  questions: Array<{ text: string; options: string[]; correct: number }>,
): ComponentSpec {
  return { type: 'mcq', config: { questions } };
}

function wordOrder(
  sentences: Array<{ words: string[]; correct: string }>,
): ComponentSpec {
  return { type: 'word_order', config: { sentences } };
}

function translate(
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

function listenPick(
  text: string,
  options: Array<{ id: string; label: string }>,
  correctOptionId: string,
): ComponentSpec {
  return { type: 'listen_pick', config: { text, options, correctOptionId } };
}

function listenType(
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

function matchPairs(
  pairs: Array<{ left: string; right: string }>,
): ComponentSpec {
  return { type: 'match_pairs', config: { pairs } };
}

function fillBlank(
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

function spelling(word: string): ComponentSpec {
  return { type: 'spelling', config: { word, audioPlay: true } };
}

function speakSentence(sentence: string, minScore = 70): ComponentSpec {
  return { type: 'speak_sentence', config: { sentence, minScore } };
}

function speakWords(text: string, minScore = 70): ComponentSpec {
  return { type: 'speak_words', config: { text, minScore } };
}
```

(`pickPicture` and `orderSentences` from the old script are intentionally NOT included — the design has no pictures, and all sentence-ordering needs are covered by `wordOrder`.)

- [ ] **Step 2: Add three composite helpers**

Append below the primitives:

```typescript
/**
 * Three exercises for one new English vocab word: hear it, spell it, translate it,
 * speak it. The 4 distractors for listen_pick must be supplied by the caller so
 * they're plausible (related vocabulary from the same lesson or the prior step).
 */
function vocabBlock(opts: {
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
function phraseBlock(uz: string, en: string): ComponentSpec[] {
  return [listenType(en), translate(uz, en), speakSentence(en, 70)];
}

/**
 * Three exercises for one topic sentence: word_order, translate, speak.
 * `words` should be the EN sentence already split into the tokens shown to
 * the student (case + punctuation included).
 */
function topicSentenceBlock(opts: {
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
function shuffleStable<T>(arr: T[]): T[] {
  const out = [...arr];
  let seed = arr.join('|').length * 31 + 7;
  for (let i = out.length - 1; i > 0; i--) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    const j = seed % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
```

- [ ] **Step 3: Type-check**

Run: `pnpm --filter api exec tsc --noEmit prisma/seed-alochi-40.ts`

Expected: still passes (the LESSONS array is empty so nothing references the helpers yet).

- [ ] **Step 4: Commit**

```bash
git add prisma/seed-alochi-40.ts
git commit -m "feat(seed): builder helpers for the 40-step seed"
```

---

## Task 3: Unit-test the helpers

**Files:**
- Create: `apps/api/test/seed-alochi-40-builders.spec.ts`

The seed script itself can't be unit-tested cleanly (it owns `prisma`), but the pure builder functions can. We'll re-export the helpers from the seed file for the test, then write small assertions.

- [ ] **Step 1: Add named exports for the helpers in the seed file**

In `prisma/seed-alochi-40.ts`, change every `function name(` to `export function name(` for all the builders defined in Task 2 (mcq through speakWords plus vocabBlock, phraseBlock, topicSentenceBlock, shuffleStable).

- [ ] **Step 2: Write the test file**

```typescript
// apps/api/test/seed-alochi-40-builders.spec.ts
import {
  mcq,
  translate,
  listenType,
  vocabBlock,
  phraseBlock,
  topicSentenceBlock,
  shuffleStable,
} from '../../../prisma/seed-alochi-40';

describe('seed-alochi-40 builders', () => {
  it('translate lowercases and strips trailing punctuation in acceptedAnswers', () => {
    const c = translate('Salom', 'Hello.');
    expect(c.type).toBe('translate');
    const cfg = c.config as { acceptedAnswers: string[] };
    expect(cfg.acceptedAnswers).toContain('hello.');
    expect(cfg.acceptedAnswers).toContain('hello');
  });

  it('listenType strips ALL punctuation, not just trailing', () => {
    const c = listenType('Yes, of course!');
    const cfg = c.config as { acceptedAnswers: string[] };
    expect(cfg.acceptedAnswers).toContain('yes of course');
  });

  it('mcq config preserves the questions array verbatim', () => {
    const c = mcq([{ text: 'Q', options: ['a', 'b'], correct: 1 }]);
    expect(c.config).toEqual({
      questions: [{ text: 'Q', options: ['a', 'b'], correct: 1 }],
    });
  });

  it('vocabBlock returns 4 components in the order listen_pick → spelling → translate → speak_sentence', () => {
    const block = vocabBlock({
      uz: 'ona',
      en: 'mother',
      distractors: ['father', 'brother', 'sister'],
    });
    expect(block.map((c) => c.type)).toEqual([
      'listen_pick',
      'spelling',
      'translate',
      'speak_sentence',
    ]);
    const speak = block[3].config as { minScore: number };
    expect(speak.minScore).toBe(65); // single-word threshold
  });

  it('phraseBlock returns 3 components in the order listen_type → translate → speak_sentence', () => {
    const block = phraseBlock('Xayrli tong', 'Good morning');
    expect(block.map((c) => c.type)).toEqual([
      'listen_type',
      'translate',
      'speak_sentence',
    ]);
    const speak = block[2].config as { minScore: number };
    expect(speak.minScore).toBe(70); // sentence threshold
  });

  it('topicSentenceBlock shuffles words deterministically', () => {
    const a = topicSentenceBlock({
      uz: 'Men o\'quvchiman',
      en: 'I am a pupil',
      words: ['I', 'am', 'a', 'pupil'],
    });
    const b = topicSentenceBlock({
      uz: 'Men o\'quvchiman',
      en: 'I am a pupil',
      words: ['I', 'am', 'a', 'pupil'],
    });
    const wordOrderA = a[0].config as { sentences: Array<{ words: string[] }> };
    const wordOrderB = b[0].config as { sentences: Array<{ words: string[] }> };
    expect(wordOrderA.sentences[0].words).toEqual(wordOrderB.sentences[0].words);
  });

  it('shuffleStable produces the same output for the same input', () => {
    expect(shuffleStable(['a', 'b', 'c', 'd'])).toEqual(shuffleStable(['a', 'b', 'c', 'd']));
  });
});
```

- [ ] **Step 3: Run the tests**

Run: `cd apps/api && pnpm jest seed-alochi-40-builders.spec --no-coverage`

Expected: 7 tests passing. If any fail, fix the helper or the test in place — the failure points to a real shape mismatch.

- [ ] **Step 4: Commit**

```bash
git add apps/api/test/seed-alochi-40-builders.spec.ts prisma/seed-alochi-40.ts
git commit -m "test: unit tests for 40-step seed builders"
```

---

## Task 4: Author lessons 1-4 (Greetings, Archetype A)

**Files:**
- Modify: `prisma/seed-alochi-40.ts` — append four entries to the `LESSONS` array.

The PDF content for these is at `/tmp/alochi-book.txt` lines 1-77. Each lesson is one of `english` type, `nRepetitions: 3`, no video, no AI tutor.

- [ ] **Step 1: Add lesson 1 (STEP 1 — Xayrli tong)**

PDF content (STEP 1):
```
Good morning!      → Xayrli tong!
Wake up, Ali.      → Uyg'on, Ali.
Morning, everyone  → Xayrli tong, hammaga
```

Append to `LESSONS`:

```typescript
{
  orderNumber: 1,
  title: 'STEP 1 — Xayrli tong',
  type: LessonType.english,
  components: [
    ...phraseBlock('Xayrli tong!', 'Good morning!'),
    ...phraseBlock("Uyg'on, Ali.", 'Wake up, Ali.'),
    ...phraseBlock('Xayrli tong, hammaga', 'Morning, everyone'),
  ],
},
```

(STEP 1 has no `TAKRORLASH` mini-recap.)

- [ ] **Step 2: Add lesson 2 (STEP 2 — Xayrli kun)**

PDF content (STEP 2):
```
Good afternoon!  → Xayrli kun
Good evening!    → Xayrli kech
Hello, Namoz     → Salom, Namoz
TAKRORLASH: STEP 1
```

```typescript
{
  orderNumber: 2,
  title: 'STEP 2 — Xayrli kun',
  type: LessonType.english,
  components: [
    ...phraseBlock('Xayrli kun', 'Good afternoon'),
    ...phraseBlock('Xayrli kech', 'Good evening'),
    ...phraseBlock('Salom, Namoz', 'Hello, Namoz'),
    matchPairs([
      { left: 'Good morning', right: 'Xayrli tong' },
      { left: 'Wake up', right: "Uyg'on" },
      { left: 'Morning, everyone', right: 'Xayrli tong, hammaga' },
    ]),
  ],
},
```

- [ ] **Step 3: Add lessons 3 and 4 by the same pattern**

Lesson 3 (STEP 3 — Xayrli tun, xayr): phrases `Good night/Xayrli tun`, `Sleep well/Yaxshi dam oling`, `Goodbye/Xayr` + matchPairs of 4 from STEP 1-2.

Lesson 4 (STEP 4 — Qalaysiz?): phrases `How are you?/Qalaysiz?`, `I am fine/Men yaxshiman`, `I am sleepy/Uyqum kelyapti` + matchPairs of 4 from STEP 2-3.

- [ ] **Step 4: Type-check and dry-run**

Run:
```bash
pnpm --filter api exec tsc --noEmit prisma/seed-alochi-40.ts
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add prisma/seed-alochi-40.ts
git commit -m "feat(seed): lessons 1-4 (greetings, STEPs 1-4)"
```

---

## Task 5: Author lesson 5 (Personal Dev — Aqlli fikrlash, Archetype E)

**Files:**
- Modify: `prisma/seed-alochi-40.ts`

PDF content: STEP 5, full essay at `/tmp/alochi-book.txt` lines 78-112.

- [ ] **Step 1: Append lesson 5 to LESSONS**

```typescript
{
  orderNumber: 5,
  title: "STEP 5 — Aqlli fikrlash boshlash",
  type: LessonType.personal_development,
  nRepetitions: 1,
  aiTutorEnabled: true,
  aiTutorContext: [
    "Sen Aloqushsan, do'stona o'zbek bola. O'zbek tilida suhbatlash.",
    "",
    "Bola hozir ushbu mavzuni o'qidi: \"Qanday qilib aqlli fikrlashni boshlash mumkin?\"",
    "Asosiy uch g'oya:",
    "1) Har doim savol ber: 'Nega bu ishni qilayapman?', 'Yaxshiroq yo'li bormi?'",
    "2) Shoshilmaslik — telefonni qo'lga olishdan oldin 'Bu meni aqlli va boy qiladimi?' deb so'ra.",
    "3) Har kuni bitta kichik o'zgarish qil — kitobdan, ota-onadan, o'zingdan.",
    "",
    "Boladan 3 ta savol so'ra (ketma-ket, javobiga qarab):",
    "1) \"Sen bu darsdan nima o'rganding?\"",
    "2) \"O'zingda qanday kichik o'zgartirish qilmoqchisan?\"",
    "3) \"Bu fikrni kimga yetkazmoqchisan?\"",
    "",
    "Har javobini hurmat qil, kichik maslahat ber. Maksimal 2-3 jumla javob ber.",
  ].join('\n'),
  components: [
    mcq([
      {
        // The MCQ text carries the full essay so the student reads it
        // in-place. After the essay we close with the comprehension /
        // scenario question. Keep paragraphs short — single \n between
        // them — so the renderer wraps cleanly on mobile.
        text: [
          "📖 SHAXSIY RIVOJLANISH — Qanday qilib aqlli fikrlashni boshlash mumkin?",
          "",
          "Hech o'ylab ko'rganmisiz, nega ba'zi bolalar har doim to'g'ri qaror qiladi? Ular shunchaki aqlliroq emas — ular umuman boshqacha fikrlaydi!",
          "",
          "Aqlli fikrlashni boshlash uchun birinchi qadam — har doim savol berish! Masalan: \"Nega bu ishni qilayapman?\", \"Buni qilsam nima bo'ladi?\", \"Yaxshiroq yo'li bormi?\" Bu savollar sizni kreativ fikrlashga majbur qiladi.",
          "",
          "Ikkinchi qadam — shoshilmaslik. Har bir gap yoki ishni darrov qabul qilish emas, avval biroz o'ylab ko'rish kerak. Telefon o'ynashdan oldin, \"Bu meni aqlli va boy qiladimi?\" deb o'zingdan so'ra.",
          "",
          "Uchinchisi va eng muhimi — har kuni kichik o'zgarish qil. Kitobdan bitta yangi fikr ol, telefondan bitta yangilik o'rgan, ota-onangdan bitta maslahat yoki o'zingdan biror nima yarat.",
          "",
          "Aqlli odam bo'lish — bu tug'ma qobiliyat emas. Bu — o'rganiladigan odat! Shunday ekan fikrla do'stim, fikrla...",
          "",
          "👨‍👩‍👧 Oila a'zolaringizga shu mavzuda treyning o'tib bering va ko'proq oynaga qarab mashq qiling!",
          "",
          "❓ Telefonni qo'lga olishdan oldin o'zingdan nima so'rashing kerak?",
        ].join('\n'),
        options: [
          'Hozir nima yangiliklar?',
          'Bu meni aqlli va boy qiladimi?',
          "Do'stlarim nima qilyapti?",
          "Eng ko'p like olgan video qaysi?",
        ],
        correct: 1,
      },
    ]),
  ],
},
```

(The `ai_tutor` exercise itself runs because `aiTutorEnabled: true` flips the lesson-level flag — no separate component is needed for it.)

- [ ] **Step 2: Type-check and commit**

```bash
pnpm --filter api exec tsc --noEmit prisma/seed-alochi-40.ts
git add prisma/seed-alochi-40.ts
git commit -m "feat(seed): lesson 5 (personal dev — aqlli fikrlash)"
```

---

## Task 6: Author lessons 6-9 (mix: vocab/topic-sentence, Archetypes B and C)

**Files:**
- Modify: `prisma/seed-alochi-40.ts`

PDF content lines 113-210. Four lessons:

- Lesson 6 (STEP 6, Archetype B): vocab `mother/ona`, `father/ota`, `brother/aka,uka`, `sister/opa,singil` + phrases `My name is .../Mening ismim ...`, `I am Anvar/Men Anvarman`, `Nice to meet you/Tanishganimdan xursandman`. TAKRORLASH 4-5.
- Lesson 7 (STEP 7, Archetype C): topic sentences `I am a pupil/Men o'quvchiman`, `I am from Uzbekistan/Men O'zbekistondanman`, `I am 10 years old/Men 10 yoshdaman`, `I am strong/Men kuchliman` + phrases `Where are you?/Qaerdasan?`, `I am here/Men bu yerdaman`, `Come here/Bu yerga kel`. TAKRORLASH 5-6.
- Lesson 8 (STEP 8, Archetype B): vocab `grandfather/buvajon`, `grandmother/buvijon`, `parents/ota-ona`, `uncle/amaki,tog'a` + phrases `How is your day?/Kuningiz qanday o'tyapti?`, `It is good/U yaxshi`, `I am happy/Men xursandman`. TAKRORLASH 6-7.
- Lesson 9 (STEP 9, Archetype C): topic sentences `She is a doctor/U shifokor`, `She is short/U past bo'yli`, `She is 30 years old/U 30 yoshda`, `She is my mother/U mening onam` + phrases `I missed you/Sizni sog'indim`, `Welcome/Xush kelibsiz`, `See you later/Keyinroq ko'rishguncha`. TAKRORLASH 7-8.

- [ ] **Step 1: Add lesson 6 (vocab pattern)**

```typescript
{
  orderNumber: 6,
  title: 'STEP 6 — Oila a\'zolari (1)',
  type: LessonType.english,
  components: [
    ...vocabBlock({ uz: 'ona', en: 'mother', distractors: ['father', 'brother', 'sister'] }),
    ...vocabBlock({ uz: 'ota', en: 'father', distractors: ['mother', 'brother', 'sister'] }),
    ...vocabBlock({ uz: 'aka', en: 'brother', distractors: ['mother', 'father', 'sister'] }),
    ...vocabBlock({ uz: 'opa', en: 'sister', distractors: ['mother', 'father', 'brother'] }),
    ...phraseBlock('Mening ismim ...', 'My name is ...'),
    ...phraseBlock('Men Anvarman', 'I am Anvar'),
    ...phraseBlock('Tanishganimdan xursandman', 'Nice to meet you'),
    matchPairs([
      { left: 'How are you?', right: 'Qalaysiz?' },
      { left: 'I am fine', right: 'Men yaxshiman' },
      { left: 'I am sleepy', right: 'Uyqum kelyapti' },
      { left: 'Good night', right: 'Xayrli tun' },
      { left: 'Goodbye', right: 'Xayr' },
    ]),
  ],
},
```

- [ ] **Step 2: Add lesson 7 (topic sentence pattern)**

```typescript
{
  orderNumber: 7,
  title: 'STEP 7 — I (men)',
  type: LessonType.english,
  components: [
    mcq([
      {
        text: '"Men" subjekti uchun "to be" fe\'lining qaysi shakli ishlatiladi?',
        options: ['am', 'is', 'are', 'be'],
        correct: 0,
      },
    ]),
    ...topicSentenceBlock({ uz: "Men o'quvchiman", en: 'I am a pupil', words: ['I', 'am', 'a', 'pupil'] }),
    ...topicSentenceBlock({ uz: "Men O'zbekistondanman", en: 'I am from Uzbekistan', words: ['I', 'am', 'from', 'Uzbekistan'] }),
    ...topicSentenceBlock({ uz: 'Men 10 yoshdaman', en: 'I am 10 years old', words: ['I', 'am', '10', 'years', 'old'] }),
    ...topicSentenceBlock({ uz: 'Men kuchliman', en: 'I am strong', words: ['I', 'am', 'strong'] }),
    ...phraseBlock('Qaerdasan?', 'Where are you?'),
    ...phraseBlock('Men bu yerdaman', 'I am here'),
    ...phraseBlock('Bu yerga kel', 'Come here'),
    matchPairs([
      { left: 'mother', right: 'ona' },
      { left: 'father', right: 'ota' },
      { left: 'brother', right: 'aka' },
      { left: 'sister', right: 'opa' },
      { left: 'My name is ...', right: 'Mening ismim ...' },
    ]),
  ],
},
```

- [ ] **Step 3: Add lessons 8 and 9 following the same patterns**

(Lesson 8 = vocab block + matchPairs from STEP 6-7; lesson 9 = topic-sentence block + matchPairs from STEP 7-8. Mirror the shape of lessons 6 and 7 exactly.)

- [ ] **Step 4: Type-check and commit**

```bash
pnpm --filter api exec tsc --noEmit prisma/seed-alochi-40.ts
git add prisma/seed-alochi-40.ts
git commit -m "feat(seed): lessons 6-9 (vocab + topic-sentence STEPs 6-9)"
```

---

## Task 7: Author lesson 10 (Personal Dev — Qo'rqmaslik)

Same recipe as Task 5. PDF content lines 211-242.

- [ ] **Step 1: Append lesson 10**

```typescript
{
  orderNumber: 10,
  title: "STEP 10 — Qo'rqmaslik kuchining siri",
  type: LessonType.personal_development,
  nRepetitions: 1,
  aiTutorEnabled: true,
  aiTutorContext: [
    "Sen Aloqushsan, do'stona o'zbek bola. O'zbek tilida suhbatlash.",
    "",
    "Bola hozir ushbu mavzuni o'qidi: \"Qo'rqmaslik — kuchli bo'lishning siri\"",
    "",
    "Asosiy g'oya: Qo'rqib turganda baribir urinib ko'rish — aynan shu kuch beradi.",
    "Har bir kuchli inson avval qo'rqqan, lekin to'xtamagan.",
    "",
    "Boladan 3 ta savol so'ra:",
    "1) \"Sen bu darsdan nima o'rganding?\"",
    "2) \"Hozir nimadan qo'rqayapsan? Qaysi kichik qadamni qo'yishing mumkin?\"",
    "3) \"Bu fikrni kimga yetkazmoqchisan?\"",
    "",
    "Har javobini hurmat qil, kichik maslahat ber. Maksimal 2-3 jumla.",
  ].join('\n'),
  components: [
    mcq([
      {
        text: [
          "📖 SHAXSIY RIVOJLANISH — Qo'rqmaslik — kuchli bo'lishning siri",
          "",
          "Do'stlar, men ilgari odamlar oldida gapirishdan juda qo'rqardim. Yuragim tez urardi, ovozim qaltirardi, ichim titrardi. Lekin bir gapni o'rgandim: qo'rqmaslik — bu hech narsadan qo'rqmaslik emas, balki qo'rqib turganda qadam tashlashdir!",
          "",
          "Qachonki sen qo'rqib turgan bo'lsang, lekin baribir urinib ko'rsang — aynan shunda sen kuchliroq bo'lasan. Masalan, birinchi marta yozishni o'rganganingda qanday edi? Hozir esa bemalol yoza olasan, to'g'rimi?",
          "",
          "Har bir kuchli inson — avval qo'rqqan, lekin to'xtamagan. Shuning uchun agar yangi narsani o'rganishdan, savol berishdan yoki xatoga yo'l qo'yishdan qo'rqayotgan bo'lsang, YODINGDA TUT: sening kuching — qo'rqib turib ham sinab ko'rishingda.",
          "",
          "Endi sening navbating — o'sha birinchi qadamni qo'y!",
          "",
          "👨‍👩‍👧 Oila a'zolaringizga shu mavzuda treyning o'tib bering va ko'proq oynaga qarab mashq qiling!",
          "",
          "❓ Kuchli inson kim?",
        ].join('\n'),
        options: [
          "Hech narsadan qo'rqmaydigan inson",
          "Qo'rqib turganda ham urinib ko'radigan inson",
          "Hech qachon adashmaydigan inson",
          "Hammadan kuchli ko'ringan inson",
        ],
        correct: 1,
      },
    ]),
  ],
},
```

- [ ] **Step 2: Type-check + commit**

```bash
pnpm --filter api exec tsc --noEmit prisma/seed-alochi-40.ts
git add prisma/seed-alochi-40.ts
git commit -m "feat(seed): lesson 10 (personal dev — qo'rqmaslik)"
```

---

## Task 8: Author lesson 11 (Composition — About myself, Archetype D)

PDF content lines 244-274. The PDF text is mangled by column overlap; the canonical template (decoded by re-reading the page) is:

```
Hello! My name is {your name}.
My family is small.
I am {age} years old.
I am from Bukhara.
I live in Gijduvan.
I am a pupil at school.
My favourite subject is English.
My favourite color is red.
My favourite car is BMW.
```

- [ ] **Step 1: Append lesson 11**

```typescript
{
  orderNumber: 11,
  title: 'STEP 11 — About myself',
  type: LessonType.english,
  aiTutorEnabled: true,
  aiTutorContext: [
    "You are a friendly English coach for a young Uzbek learner.",
    "The student just composed an 'About myself' paragraph.",
    "Ask 3 short follow-up questions in English, one at a time, to extend the topic.",
    "Be encouraging. Keep responses to 1-2 sentences.",
    "English only — they are practising English.",
  ].join('\n'),
  components: [
    fillBlank('Hello! My name is ___.', 'Anvar', ['Anvar', 'Aziza', 'Bekzod', 'Nodira']),
    fillBlank('My family is ___.', 'small', ['small', 'big', 'happy', 'kind']),
    fillBlank('I am ___ years old.', '10', ['8', '9', '10', '11', '12']),
    fillBlank('I am from ___.', 'Bukhara', ['Bukhara', 'Tashkent', 'Samarqand', 'Khiva']),
    fillBlank('I live in ___.', 'Gijduvan', ['Gijduvan', 'Bukhara', 'Tashkent', 'Andijan']),
    fillBlank('I am a ___ at school.', 'pupil', ['pupil', 'teacher', 'student']),
    fillBlank('My favourite subject is ___.', 'English', ['English', 'Math', 'Music', 'PE']),
    fillBlank('My favourite color is ___.', 'red', ['red', 'blue', 'green', 'yellow']),
    fillBlank('My favourite car is ___.', 'BMW', ['BMW', 'Cobalt', 'Tesla', 'Toyota']),
    speakWords(
      "Hello! My name is Anvar. My family is small. I am 10 years old. I am from Bukhara. I live in Gijduvan. I am a pupil at school. My favourite subject is English. My favourite color is red. My favourite car is BMW.",
      70,
    ),
  ],
},
```

- [ ] **Step 2: Type-check + commit**

```bash
pnpm --filter api exec tsc --noEmit prisma/seed-alochi-40.ts
git add prisma/seed-alochi-40.ts
git commit -m "feat(seed): lesson 11 (composition — about myself)"
```

---

## Task 9: Author lesson 12 (TAKRORLASH 1-11 checkpoint, Archetype F)

**Coverage requirement:** every vocab word, phrase, and topic sentence introduced in lessons 1-11 must appear at least once.

- [ ] **Step 1: Inventory the items in range 1-11**

Make a checklist on paper / scratchpad — refer to lessons 1-9 spec and PDF lines 1-274:
- Phrases (greetings + functional): ~25 entries
- Vocab words: 8 (mother, father, brother, sister, grandfather, grandmother, parents, uncle)
- Topic sentences (I- and she- patterns): 8

- [ ] **Step 2: Write the checkpoint lesson**

```typescript
{
  orderNumber: 12,
  title: 'TAKRORLASH 1-11',
  type: LessonType.english,
  hasExam: true,
  nRepetitions: 5,
  components: [
    // ── Vocab matched-pair recall (8 vocab in two rounds of 4) ─────────────
    matchPairs([
      { left: 'mother', right: 'ona' },
      { left: 'father', right: 'ota' },
      { left: 'brother', right: 'aka' },
      { left: 'sister', right: 'opa' },
    ]),
    matchPairs([
      { left: 'grandfather', right: 'buvajon' },
      { left: 'grandmother', right: 'buvijon' },
      { left: 'parents', right: 'ota-ona' },
      { left: 'uncle', right: 'amaki' },
    ]),
    // ── Phrase translate (UZ → EN) for every greeting/functional phrase ──
    translate('Xayrli tong!', 'Good morning!'),
    translate('Xayrli kun', 'Good afternoon'),
    translate('Xayrli kech', 'Good evening'),
    translate('Xayrli tun', 'Good night'),
    translate('Yaxshi dam oling', 'Sleep well'),
    translate('Xayr', 'Goodbye'),
    translate('Qalaysiz?', 'How are you?'),
    translate('Men yaxshiman', 'I am fine'),
    translate('Uyqum kelyapti', 'I am sleepy'),
    translate('Tanishganimdan xursandman', 'Nice to meet you'),
    translate('Kuningiz qanday?', 'How is your day?'),
    translate('Men xursandman', 'I am happy'),
    translate("Sizni sog'indim", 'I missed you'),
    translate('Xush kelibsiz', 'Welcome'),
    translate("Keyinroq ko'rishguncha", 'See you later'),
    translate('Qaerdasan?', 'Where are you?'),
    translate('Men bu yerdaman', 'I am here'),
    translate('Bu yerga kel', 'Come here'),
    // ── Topic sentence drills (word_order for I- and she- patterns) ───────
    wordOrder([
      { words: ['pupil', 'a', 'I', 'am'], correct: 'I am a pupil' },
      { words: ['Uzbekistan', 'from', 'I', 'am'], correct: 'I am from Uzbekistan' },
      { words: ['old', 'I', 'years', '10', 'am'], correct: 'I am 10 years old' },
      { words: ['strong', 'am', 'I'], correct: 'I am strong' },
    ]),
    wordOrder([
      { words: ['doctor', 'a', 'is', 'She'], correct: 'She is a doctor' },
      { words: ['short', 'is', 'She'], correct: 'She is short' },
      { words: ['old', 'years', '30', 'is', 'She'], correct: 'She is 30 years old' },
      { words: ['mother', 'is', 'my', 'She'], correct: 'She is my mother' },
    ]),
    // ── Speak-aloud the 6 most common functional phrases ────────────────
    speakSentence('Good morning!', 70),
    speakSentence('How are you?', 70),
    speakSentence('I am fine', 70),
    speakSentence('Nice to meet you', 70),
    speakSentence('Where are you?', 70),
    speakSentence('See you later', 70),
    // ── 'About myself' composition recall ────────────────────────────────
    speakWords(
      "Hello! My name is Anvar. I am 10 years old. I am from Bukhara. I am a pupil at school.",
      70,
    ),
  ],
},
```

- [ ] **Step 3: Type-check + commit**

```bash
pnpm --filter api exec tsc --noEmit prisma/seed-alochi-40.ts
git add prisma/seed-alochi-40.ts
git commit -m "feat(seed): TAKRORLASH 1-11 checkpoint (lesson 12)"
```

---

## Task 10: Author lessons 13-22 (PDF STEPs 12-21)

This is the second range. Patterns are already defined:
- Archetype A (greetings) — Task 4.
- Archetype B (vocab) — Task 6 step 1.
- Archetype C (topic sentence) — Task 6 step 2.
- Archetype D (composition) — Task 8.
- Archetype E (personal development) — Task 7. The PD lessons in this
  range are #16 (STEP 15 — "O'zini boshqalar bilan solishtirmaslik")
  and #21 (STEP 20 — "Xatolardan qo'rqmaslik"). Each gets one MCQ
  whose `text` carries the full essay (PDF lines 373-400 and 507-530
  respectively) followed by a scenario question.

PDF content lines 286-562. Lesson list (orderNumber → PDF STEP → archetype):

| #orderNumber | PDF STEP | Archetype | Topic |
|---|---|---|---|
| 13 | STEP 12 | B (vocab) | aunt, cousin, nephew, niece, grandparents + 'See you later/tomorrow/soon' |
| 14 | STEP 13 | C (he) | He is a firefighter / from Australia / well-built / my friend + Thank you/Thanks a lot/You are welcome |
| 15 | STEP 14 | B (vocab) | house, door, window, wall + I am sorry/That is okay/No problem |
| 16 | STEP 15 | E (PD) | "O'zini boshqalar bilan solishtirmaslik" |
| 17 | STEP 16 | C (it) | It is my desk / pet / police car / very big + Yes of course/I agree/You are right |
| 18 | STEP 17 | B (vocab) | roof, chimney, bedroom, bathroom + May I come in/Come in please/Sit down please |
| 19 | STEP 18 | C (we) | We are from Japan / football players / 25 years old / clever + May I go out/Go out please/Wait for me |
| 20 | STEP 19 | B (vocab) | living room, dining room, kitchen, garden + Excuse me/Listen to me/Look at me |
| 21 | STEP 20 | E (PD) | "Xatolardan qo'rqmaslik" |
| 22 | STEP 21 | D (composition) | About my family |

- [ ] **Step 1: Add lessons 13-22 in one batch**

For each, copy the relevant template from Tasks 4-8. Use distractors that are plausible (other vocab from the same lesson + previous lesson). For each grammar topic in C, add 1 MCQ (e.g. for STEP 16 about `it`: "Predmet va hayvonlar uchun qaysi olmosh?" with options I/he/it/they). For each B lesson, end with a `matchPairs` of 5-6 from the previous 1-2 STEPs.

Lesson 22 (composition "About my family") template (from PDF STEP 21):
```
Hello! I have a small family.
There are 4 people in my family.
My father's name is ___.
My mother's name is ___.
My sister's name is ___.
I love my family.
```

- [ ] **Step 2: Type-check + run a partial seed against a scratch tenant** (skip if no scratch DB)

Run:
```bash
pnpm --filter api exec ts-node -r tsconfig-paths/register \
  prisma/seed-alochi-40.ts --tenant <scratch-slug>
```

Expected: lessons 1-22 created/updated, no errors.

- [ ] **Step 3: Commit**

```bash
git add prisma/seed-alochi-40.ts
git commit -m "feat(seed): lessons 13-22 (PDF STEPs 12-21)"
```

---

## Task 11: Author lesson 23 (TAKRORLASH 12-21 checkpoint)

Same recipe as Task 9. Inventory items from PDF STEPs 12-21:
- Vocab: aunt, cousin, nephew, niece, grandparents (5 — STEP 12), house, door, window, wall (4 — STEP 14), roof, chimney, bedroom, bathroom (4 — STEP 17), living room, dining room, kitchen, garden (4 — STEP 19) → **17 vocab in 3 match-pair rounds of 4-6**.
- Topic sentence patterns: he, it, we (3 patterns × 4 sentences = 12 sentences) → **3 wordOrder components**.
- Functional phrases: See you later/tomorrow/soon, Thank you, Thanks a lot, You are welcome, I am sorry, That is okay, No problem, Yes of course, I agree, You are right, May I come in, Come in please, Sit down please, May I go out, Go out please, Wait for me, Excuse me, Listen to me, Look at me → **~19 translates**.

- [ ] **Step 1: Write lesson 23**

Mirror the structure of lesson 12 (Task 9), but with the inventory above. Aim for ~70 components.

- [ ] **Step 2: Type-check + commit**

```bash
pnpm --filter api exec tsc --noEmit prisma/seed-alochi-40.ts
git add prisma/seed-alochi-40.ts
git commit -m "feat(seed): TAKRORLASH 12-21 checkpoint (lesson 23)"
```

---

## Task 12: Author lessons 24-33 (PDF STEPs 22-31)

PD lessons in this range follow Task 7's pattern: #27 (STEP 25 —
"Vaqtni qadrlash", PDF lines 651-674) and #32 (STEP 30 — "Katta
orzu", PDF lines 815-836). Essay text in MCQ, AI tutor for reflection,
`nRepetitions: 1`.

| #orderNumber | PDF STEP | Archetype | Topic |
|---|---|---|---|
| 24 | STEP 22 | C (you) | You are a student / my friend / beautiful / from Russia + She is my mom/Mom is kind/I love mom |
| 25 | STEP 23 | B (vocab) | Numbers 1-12 + He is my dad/Dad is busy/Dad is at home |
| 26 | STEP 24 | C (they) | They are pilots / classmates / toys / from Spain + I have a brother/She is my sister/We are a family |
| 27 | STEP 25 | E (PD) | "Vaqtni qadrlash" |
| 28 | STEP 26 | B (vocab) | Numbers 13-19 + tens 20,30,40,50,60,70,80,90 + I am hungry/I want food/Eat some bread |
| 29 | STEP 27 | C (am) | "to be: am" — I am tall / 11 years old / from Bukhara / young + I am thirsty/Water please/Drink some water |
| 30 | STEP 28 | B (vocab) | Numbers 21-50 (in 5-step blocks) + I like it/I like tea/Do you like it? |
| 31 | STEP 29 | C (is) | "to be: is" — He is polite / She is 22 / It is a dog / She is a doctor + I do not like it/I hate this/No thank you |
| 32 | STEP 30 | E (PD) | "Katta orzu" |
| 33 | STEP 31 | D (composition) | My best friend |

For STEP 23, 26, 28 number lessons: each `vocabBlock` for a number, but you can group with an extra `matchPairs` of 6 numbers for variety.

For lesson 33 (My best friend) composition, follow the lesson 11 template adapted:
```
Hello! My name is {your name}.
I want to talk about my best friend.
My best friend's name is ___.
He/She is from Gijduvan.
He/She is a good boy/girl.
We take care of each other.
I trust my friend.
I am happy to have him/her.
```

- [ ] **Step 1: Add lessons 24-33**

Type-check incrementally as you go.

- [ ] **Step 2: Commit**

```bash
git add prisma/seed-alochi-40.ts
git commit -m "feat(seed): lessons 24-33 (PDF STEPs 22-31)"
```

---

## Task 13: Author lesson 34 (TAKRORLASH 22-31 checkpoint)

Inventory:
- Vocab: numbers 1-12, 13-19, 20-90 tens, 21-50 → many. Sample 30 representative numbers in 5 match-pair rounds of 6.
- Topic sentence patterns: you, they, am, is (4 patterns × 4 sentences = 16) → **4 wordOrder components**.
- Phrases: She is my mom, Mom is kind, I love mom, He is my dad, Dad is busy, Dad is at home, I have a brother, She is my sister, We are a family, I am hungry, I want food, Eat some bread, I am thirsty, Water please, Drink some water, I like it, I like tea, Do you like it?, I do not like it, I hate this, No thank you → ~21 translates.

- [ ] **Step 1: Write lesson 34**

Mirror lesson 23. Aim for ~75 components.

- [ ] **Step 2: Commit**

```bash
git add prisma/seed-alochi-40.ts
git commit -m "feat(seed): TAKRORLASH 22-31 checkpoint (lesson 34)"
```

---

## Task 14: Author lessons 35-43 (PDF STEPs 32-40)

PD lessons in this range follow Task 7's pattern: #38 (STEP 35 —
"Do'st tanlash", PDF lines 1026-1050) and #43 (STEP 40 — "Ota-ona
urishganida", PDF lines 1206-1232). Essay text in MCQ, AI tutor for
reflection, `nRepetitions: 1`.

| #orderNumber | PDF STEP | Archetype | Topic |
|---|---|---|---|
| 35 | STEP 32 | B (vocab) | Numbers 51-69 + My head hurts/I feel bad/I am sick |
| 36 | STEP 33 | C (are) | "to be: are" — We are doctors / You are famous / They are best friends / You are Uzbek + I am full/Call a doctor/Get well soon |
| 37 | STEP 34 | B (vocab) | Numbers 71-100 + Do it now/I am busy now/Start the lesson |
| 38 | STEP 35 | E (PD) | "Do'st tanlash" |
| 39 | STEP 36 | C (am/is 2) | "to be: am/is 2" — I am an artist / middle-aged / French / twelve / She is a seller / my aunt / Masha is my cow / Hafiza is a tailor + Not now/Do it later/Call me later |
| 40 | STEP 37 | B (vocab) | T-shirt, jeans, blouse, skirt, sweater, pants + Come here/Stay here/I am here |
| 41 | STEP 38 | C (are 2) | "to be: are 2" — We are from Poland / You are a nurse / Bakhodir and Jonibek are strong boys / They are very old + What is this/Where is it/Who is that |
| 42 | STEP 39 | B (vocab) | dress, cardigan, jacket, vest, coat, cap + Go there/It is there/Look over there |
| 43 | STEP 40 | E (PD) | "Ota-ona urishganida" |

Note STEP 37 and 39 each appear twice in the PDF — combine both pages of vocab into one lesson.

- [ ] **Step 1: Add lessons 35-43**

- [ ] **Step 2: Type-check + commit**

```bash
pnpm --filter api exec tsc --noEmit prisma/seed-alochi-40.ts
git add prisma/seed-alochi-40.ts
git commit -m "feat(seed): lessons 35-43 (PDF STEPs 32-40)"
```

---

## Task 15: Author lesson 44 (TAKRORLASH 1-40 checkpoint)

This is the largest review (the spec estimates ~150 components).

Strategy to manage size:
- Vocab: all ~30 unique vocab words in 5-6 match-pair rounds of 6.
- Phrases: pick 30 most common translates (skip duplicates from earlier reviews).
- Topic sentences: 1 wordOrder per pronoun (I, he, she, it, we, you, they, am, is, are, am/is2, are2) → 12 wordOrder components, each with 4 sentences = 48 sentence-orderings.
- Speak: 10 representative sentences (1 from each pronoun group + 2 from compositions).
- Compositions: 1 speakWords for each of the 3 composition lessons.

If the script ends up >180 components, drop the speak set first (mic-heavy fatigue).

- [ ] **Step 1: Write lesson 44**

Aim 120-150 components.

- [ ] **Step 2: Commit**

```bash
git add prisma/seed-alochi-40.ts
git commit -m "feat(seed): TAKRORLASH 1-40 checkpoint (lesson 44)"
```

---

## Task 16: Validation against a scratch tenant

**Files:** none changed. This is a smoke run.

- [ ] **Step 1: Identify or create a scratch tenant**

If no scratch tenant exists locally, create one with `pnpm --filter api exec ts-node -r tsconfig-paths/register prisma/clean-db.ts` followed by `pnpm --filter api exec ts-node prisma/seed.ts` (this gives slug `demo-markaz`).

- [ ] **Step 2: Run the new seed against the scratch tenant**

```bash
pnpm --filter api exec ts-node -r tsconfig-paths/register \
  prisma/seed-alochi-40.ts --tenant demo-markaz
```

Expected: 44 lines like `#01 STEP 1 — Xayrli tong  +9 components`. No errors. Final summary `Done. 44 lessons (44 created, 0 updated), N components.`

- [ ] **Step 3: Verify acceptance criteria via a one-liner**

```bash
pnpm --filter api exec ts-node -r tsconfig-paths/register -e \
  'import {PrismaClient} from "@prisma/client"; const p = new PrismaClient();
   p.tenant.findUnique({where:{slug:"demo-markaz"}}).then(t =>
     p.lesson.findMany({where:{tenantId: t!.id}, orderBy:{orderNumber:"asc"},
       select:{orderNumber:true,title:true,type:true,nRepetitions:true,hasExam:true,_count:{select:{components_data:true}}}})
   ).then(rows => console.table(rows.map(r => ({...r, components: r._count.components_data}))));'
```

Expected: 44 rows, orderNumbers 1-44, types match the §4 table in the spec, checkpoint lessons (12, 23, 34, 44) have `hasExam: true` and `nRepetitions: 5`, personal-development lessons (5, 10, 16, 21, 27, 32, 38, 43) have `nRepetitions: 1` and `type: 'personal_development'`.

- [ ] **Step 4: Idempotency check — re-run the seed**

```bash
pnpm --filter api exec ts-node -r tsconfig-paths/register \
  prisma/seed-alochi-40.ts --tenant demo-markaz
```

Expected: `Done. 44 lessons (0 created, 44 updated), N components.` (same N as before).

Then re-run the table query from Step 3 — counts must be identical to the first run.

- [ ] **Step 5: Open one lesson in the running web app and click through**

If a local dev server is up: navigate to `/superadmin/lessons` (logged in as the scratch tenant's superadmin), pick lesson 1, click "Mashqlar" — expect to see the seeded components.

- [ ] **Step 6: Commit any fixes that came out of validation**

If you tweaked builders or content during validation, commit them now under one followup:

```bash
git add prisma/seed-alochi-40.ts apps/api/test/seed-alochi-40-builders.spec.ts
git commit -m "fix(seed): adjustments from scratch-tenant validation"
```

---

## Task 17: Delete the superseded seed scripts

The new seed covers everything the old `seed-step-1.ts` and `seed-steps-2-10.ts` did and more.

- [ ] **Step 1: Confirm no other code references them**

```bash
grep -rn "seed-step-1\|seed-steps-2-10" --include="*.ts" --include="*.json" --include="*.md" .
```

Expected: only matches inside the two files themselves and possibly README docs. No imports from anywhere else.

- [ ] **Step 2: Delete the old files**

```bash
git rm prisma/seed-step-1.ts prisma/seed-steps-2-10.ts
```

- [ ] **Step 3: Update README references if any were found in Step 1**

(Likely none — but if `prisma/README.md` or top-level README mentions them, replace with the new script name.)

- [ ] **Step 4: Commit**

```bash
git commit -m "chore(seed): drop legacy step seeds, superseded by seed-alochi-40"
```

---

## Task 18: Production deploy

**Files:** none changed. This runs the seed against the live tenant.

- [ ] **Step 1: Push commits to GitHub**

```bash
git push
```

- [ ] **Step 2: Confirm the production tenant slug**

Run via SSH:
```bash
ssh -i ~/.ssh/alochi_deploy root@164.68.109.208 \
  "cd /var/www/alochi && pnpm --filter api exec ts-node -r tsconfig-paths/register -e \
  'import {PrismaClient} from \"@prisma/client\"; new PrismaClient().tenant.findMany({select:{slug:true,name:true}}).then(t=>console.log(t))'"
```

Note the slug to seed into. If unsure, ask the human before continuing.

- [ ] **Step 3: Pull, build, run seed, restart**

```bash
ssh -i ~/.ssh/alochi_deploy root@164.68.109.208 \
  "cd /var/www/alochi && git pull --ff-only && \
   pnpm --filter api exec ts-node -r tsconfig-paths/register prisma/seed-alochi-40.ts --tenant <slug> && \
   pm2 restart alochi-api alochi-web --update-env"
```

(Run the seed BEFORE the restart so the API caches a consistent set of lessons on the next boot.)

Expected: 44 lesson lines printed, summary line at the end, both pm2 processes back online.

- [ ] **Step 4: Smoke-test the live site**

```bash
curl -s -o /dev/null -w "Lessons API: %{http_code}\n" \
  https://alochi.biznesjon.uz/api/lessons
```

Expected: 401 (auth required for the lessons API — same as `/api/health` should still 200, but lessons require a token). The 401 confirms the API is up; in-app the superadmin can now see all 44 lessons in `/superadmin/lessons`.

- [ ] **Step 5: Tell the human what to verify in-browser**

> "Live deploy done — `9b3a34e` plus the new seed. Please log in as superadmin → `/superadmin/lessons` → confirm 44 lessons listed, orderNumbers 1-44 contiguous, lesson 5 type is `personal_development`, lesson 12 has the `hasExam` badge."

---

## Self-review checklist (run before handoff)

- [ ] Spec §4 table (44 lessons) is fully covered: every orderNumber 1–44 has an authoring task (Tasks 4-15).
- [ ] Spec §5 archetype shapes match what each task generates:
  - A (greetings): `phraseBlock` × 3-4 + matchPairs recap → ~12-18 components.
  - B (vocab): `vocabBlock` × 4-5 + `phraseBlock` × 3-4 + matchPairs → ~25-30 components.
  - C (topic): `mcq` × 1 + `topicSentenceBlock` × 4 + `phraseBlock` × 3 + matchPairs → ~22 components.
  - D (composition): `fillBlank` × 9 + `speakWords` × 1 + ai_tutor enabled → ~10-15 components + AI.
  - E (PD): `mcq` × 1 + ai_tutor enabled, `nRepetitions: 1`, full `aiTutorContext` set.
  - F (review): comprehensive sample, `hasExam: true`, `nRepetitions: 5`.
- [ ] No `"TODO"`, `"TBD"`, or "implement later" left in the plan.
- [ ] Method names are stable across tasks (`vocabBlock` vs `phraseBlock` vs `topicSentenceBlock`).
- [ ] Spec acceptance criteria (§10) all map to verification steps in Task 16:
  - 44 lessons listed → Task 16 Step 3.
  - Titles match → Task 16 Step 3 (column inspection).
  - Archetype shapes → Task 16 Step 3 component counts + spot-check.
  - PD type + tutor context → Task 16 Step 3 type column.
  - Review hasExam + nRepetitions → Task 16 Step 3.
  - Student can open lesson 1 and finish → Task 16 Step 5.
  - Idempotency → Task 16 Step 4.
