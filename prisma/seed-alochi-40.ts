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
  // ── STEP 1 — Xayrli tong ───────────────────────────────────────────────────
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

  // ── STEP 2 — Xayrli kun ────────────────────────────────────────────────────
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

  // ── STEP 3 — Xayrli tun, xayr ─────────────────────────────────────────────
  {
    orderNumber: 3,
    title: 'STEP 3 — Xayrli tun, xayr',
    type: LessonType.english,
    components: [
      ...phraseBlock('Xayrli tun', 'Good night'),
      ...phraseBlock('Yaxshi dam oling', 'Sleep well.'),
      ...phraseBlock('Xayr', 'Goodbye'),
      matchPairs([
        { left: 'Good afternoon', right: 'Xayrli kun' },
        { left: 'Good evening', right: 'Xayrli kech' },
        { left: 'Hello', right: 'Salom' },
        { left: 'Wake up', right: "Uyg'on" },
      ]),
    ],
  },

  // ── STEP 4 — Qalaysiz? ─────────────────────────────────────────────────────
  {
    orderNumber: 4,
    title: 'STEP 4 — Qalaysiz?',
    type: LessonType.english,
    components: [
      ...phraseBlock('Qalaysiz?', 'How are you?'),
      ...phraseBlock('Men yaxshiman', 'I am fine'),
      ...phraseBlock('Uyqum kelyapti', 'I am sleepy'),
      matchPairs([
        { left: 'Good afternoon', right: 'Xayrli kun' },
        { left: 'Good night', right: 'Xayrli tun' },
        { left: 'Sleep well', right: 'Yaxshi dam oling' },
        { left: 'Goodbye', right: 'Xayr' },
      ]),
    ],
  },

  // ── STEP 5 — Aqlli fikrlash boshlash (Personal Development) ────────────────
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

  // ── STEP 6 — Oila a'zolari (1) ────────────────────────────────────────────
  {
    orderNumber: 6,
    title: "STEP 6 — Oila a'zolari (1)",
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

  // ── STEP 7 — I (men) ───────────────────────────────────────────────────────
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

  // ── STEP 8 — Oila a'zolari (2) ────────────────────────────────────────────
  {
    orderNumber: 8,
    title: "STEP 8 — Oila a'zolari (2)",
    type: LessonType.english,
    components: [
      ...vocabBlock({ uz: 'buvajon', en: 'grandfather', distractors: ['grandmother', 'parents', 'uncle'] }),
      ...vocabBlock({ uz: 'buvijon', en: 'grandmother', distractors: ['grandfather', 'parents', 'uncle'] }),
      ...vocabBlock({ uz: 'ota-ona', en: 'parents', distractors: ['grandfather', 'grandmother', 'uncle'] }),
      ...vocabBlock({ uz: 'amaki', en: 'uncle', distractors: ['grandfather', 'grandmother', 'parents'] }),
      ...phraseBlock("Kuningiz qanday o'tyapti?", 'How is your day?'),
      ...phraseBlock('U yaxshi', 'It is good'),
      ...phraseBlock('Men xursandman', 'I am happy'),
      matchPairs([
        { left: 'mother', right: 'ona' },
        { left: 'father', right: 'ota' },
        { left: 'I am a pupil', right: "Men o'quvchiman" },
        { left: 'I am strong', right: 'Men kuchliman' },
        { left: 'Where are you?', right: 'Qaerdasan?' },
      ]),
    ],
  },

  // ── STEP 9 — She (qiz bola) ────────────────────────────────────────────────
  {
    orderNumber: 9,
    title: 'STEP 9 — She (qiz bola)',
    type: LessonType.english,
    components: [
      mcq([
        {
          text: '"U" (qiz bola) subjekti uchun "to be" fe\'lining qaysi shakli ishlatiladi?',
          options: ['am', 'is', 'are', 'be'],
          correct: 1,
        },
      ]),
      ...topicSentenceBlock({ uz: 'U shifokor', en: 'She is a doctor', words: ['She', 'is', 'a', 'doctor'] }),
      ...topicSentenceBlock({ uz: "U past bo'yli", en: 'She is short', words: ['She', 'is', 'short'] }),
      ...topicSentenceBlock({ uz: 'U 30 yoshda', en: 'She is 30 years old', words: ['She', 'is', '30', 'years', 'old'] }),
      ...topicSentenceBlock({ uz: 'U mening onam', en: 'She is my mother', words: ['She', 'is', 'my', 'mother'] }),
      ...phraseBlock("Sizni sog'indim", 'I missed you'),
      ...phraseBlock('Xush kelibsiz', 'Welcome'),
      ...phraseBlock("Keyinroq ko'rishguncha", 'See you later'),
      matchPairs([
        { left: 'grandfather', right: 'buvajon' },
        { left: 'grandmother', right: 'buvijon' },
        { left: 'parents', right: 'ota-ona' },
        { left: 'uncle', right: 'amaki' },
        { left: 'How is your day?', right: "Kuningiz qanday o'tyapti?" },
      ]),
    ],
  },
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
