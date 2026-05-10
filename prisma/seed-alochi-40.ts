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

  // ── STEP 10 — Qo'rqmaslik kuchining siri ──────────────────────────────────
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

  // ── STEP 11 — About myself (Composition — Archetype D) ────────────────────
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

  // ── STEP 12 — Oila a'zolari (3) ───────────────────────────────────────────
  {
    orderNumber: 13,
    title: "STEP 12 — Oila a'zolari (3)",
    type: LessonType.english,
    components: [
      ...vocabBlock({ uz: 'amma; xola', en: 'aunt', distractors: ['uncle', 'cousin', 'nephew'] }),
      ...vocabBlock({ uz: 'amakivachcha', en: 'cousin', distractors: ['aunt', 'niece', 'nephew'] }),
      ...vocabBlock({ uz: "o'g'il jiyan", en: 'nephew', distractors: ['aunt', 'cousin', 'niece'] }),
      ...vocabBlock({ uz: 'qiz jiyan', en: 'niece', distractors: ['aunt', 'cousin', 'nephew'] }),
      ...vocabBlock({ uz: 'bobo-buvi', en: 'grandparents', distractors: ['cousin', 'nephew', 'niece'] }),
      ...phraseBlock("Keyinroq ko'rishguncha", 'See you later'),
      ...phraseBlock("Ertaga ko'rishguncha", 'See you tomorrow'),
      ...phraseBlock("Tezda orada ko'rishguncha", 'See you soon'),
      matchPairs([
        { left: 'aunt', right: 'amma; xola' },
        { left: 'cousin', right: 'amakivachcha' },
        { left: 'nephew', right: "o'g'il jiyan" },
        { left: 'niece', right: 'qiz jiyan' },
        { left: 'grandparents', right: 'bobo-buvi' },
      ]),
    ],
  },

  // ── STEP 13 — He (o'g'il bola) ────────────────────────────────────────────
  {
    orderNumber: 14,
    title: "STEP 13 — He (o'g'il bola)",
    type: LessonType.english,
    components: [
      mcq([
        {
          text: '"U" (o\'g\'il bola) subjekti uchun "to be" fe\'lining qaysi shakli ishlatiladi?',
          options: ['am', 'is', 'are', 'be'],
          correct: 1,
        },
      ]),
      ...topicSentenceBlock({ uz: "U o't o'chiruvchi", en: 'He is a firefighter', words: ['He', 'is', 'a', 'firefighter'] }),
      ...topicSentenceBlock({ uz: 'U Avstraliyadan', en: 'He is from Australia', words: ['He', 'is', 'from', 'Australia'] }),
      ...topicSentenceBlock({ uz: 'U kelishgan', en: 'He is well-built', words: ['He', 'is', 'well-built'] }),
      ...topicSentenceBlock({ uz: "U mening do'stim", en: 'He is my friend', words: ['He', 'is', 'my', 'friend'] }),
      ...phraseBlock('Raxmat', 'Thank you'),
      ...phraseBlock('Katta rahmat', 'Thanks a lot'),
      ...phraseBlock('Arzimaydi', 'You are welcome'),
      matchPairs([
        { left: 'He is a firefighter', right: "U o't o'chiruvchi" },
        { left: 'He is from Australia', right: 'U Avstraliyadan' },
        { left: 'He is well-built', right: 'U kelishgan' },
        { left: "He is my friend", right: "U mening do'stim" },
        { left: 'Thank you', right: 'Raxmat' },
      ]),
    ],
  },

  // ── STEP 14 — Uy qismlari (1) ─────────────────────────────────────────────
  {
    orderNumber: 15,
    title: 'STEP 14 — Uy qismlari (1)',
    type: LessonType.english,
    components: [
      ...vocabBlock({ uz: 'uy', en: 'house', distractors: ['door', 'window', 'wall'] }),
      ...vocabBlock({ uz: 'eshik', en: 'door', distractors: ['house', 'window', 'wall'] }),
      ...vocabBlock({ uz: 'deraza', en: 'window', distractors: ['house', 'door', 'wall'] }),
      ...vocabBlock({ uz: 'devor', en: 'wall', distractors: ['house', 'door', 'window'] }),
      ...phraseBlock('Kechirasiz', 'I am sorry'),
      ...phraseBlock('Hammasi joyida', 'That is okay'),
      ...phraseBlock("Muammo yo'q", 'No problem.'),
      matchPairs([
        { left: 'house', right: 'uy' },
        { left: 'door', right: 'eshik' },
        { left: 'window', right: 'deraza' },
        { left: 'wall', right: 'devor' },
        { left: 'I am sorry', right: 'Kechirasiz' },
      ]),
    ],
  },

  // ── STEP 15 — O'zini solishtirmaslik (Personal Dev) ───────────────────────
  {
    orderNumber: 16,
    title: "STEP 15 — O'zini solishtirmaslik",
    type: LessonType.personal_development,
    nRepetitions: 1,
    aiTutorEnabled: true,
    aiTutorContext: [
      "Sen Aloqushsan, do'stona o'zbek bola. O'zbek tilida suhbatlash.",
      "",
      "Bola hozir ushbu mavzuni o'qidi: \"O'zingni boshqalar bilan solishtirmaslik\"",
      "",
      "Asosiy g'oya: O'zingni boshqalar bilan emas, kechagi o'zing bilan solishtir. O'z o'zi bilan raqobatlashish — doimiy rivojlanishdir.",
      "",
      "Boladan 3 ta savol so'ra (ketma-ket, javobiga qarab):",
      "1) \"Bu darsdan nima o'rganding?\"",
      "2) \"Kechagi o'zingdan qanday yaxshi bo'lding bugun?\"",
      "3) \"O'zingga qanday gap aytmoqchisan?\"",
      "",
      "Har javobini hurmat qil, kichik maslahat ber. Maksimal 2-3 jumla.",
    ].join('\n'),
    components: [
      mcq([
        {
          text: [
            "📖 SHAXSIY RIVOJLANISH — O'zingni boshqalar bilan solishtirmaslik",
            "",
            "Hech o'zingizni boshqalar bilan solishtirganmisiz? Masalan: \"U mendan yaxshi o'qiydi\", \"U ko'proq 'like' oladi\", \"Men unchalik zo'r emasman...\" — deb?",
            "",
            "Lekin aslida bu noto'g'ri! Chunki har bir bola o'zining yo'lida yuradi. Kimdir yugurib ketadi, kimdir asta yuradi...",
            "",
            "O'zingni solishtirish kerak bo'lsa, kechagi o'zing bilan solishtir. O'z o'zi bilan raqobatlashish doimiy RIVOJLANISHDIR! Kecha dangasa edimmi? Bugun harakat qildimmi? Kecha adashdimmi? Bugun tuzatdimmi?",
            "",
            "YODINGDA TUT: sening kuching — boshqa hech kimda yo'q! Sening ovozing, fikring, orzularing — bu yagona.",
            "",
            "Shuning uchun o'zinga shunchaki bir gapni ayt: \"Men o'z yo'limdaman. Bugun men kechagi o'zimdan zo'r bolaman!\"",
            "",
            "👨‍👩‍👧 Oila a'zolaringizga shu mavzuda treyning o'tib bering va ko'proq oynaga qarab mashq qiling!",
            "",
            "❓ Sinfdoshing sendan ko'proq baho oldi. Sen nima qilishing kerak?",
          ].join('\n'),
          options: [
            '"Men hech narsaga yaramayman" deb xafa bo\'lish',
            "Sinfdoshim bilan emas, kechagi o'zim bilan solishtirib, bugun nima yaxshilanganimni so'rash",
            "Sinfdoshimga g'azablanish",
            "O'qishni tashlab qo'yish",
          ],
          correct: 1,
        },
      ]),
    ],
  },

  // ── STEP 16 — It (predmet, hayvon) ────────────────────────────────────────
  {
    orderNumber: 17,
    title: 'STEP 16 — It (predmet, hayvon)',
    type: LessonType.english,
    components: [
      mcq([
        {
          text: 'Predmet va hayvonlar uchun qaysi olmosh ishlatiladi?',
          options: ['I', 'he', 'it', 'they'],
          correct: 2,
        },
      ]),
      ...topicSentenceBlock({ uz: 'U mening partam', en: 'It is my desk', words: ['It', 'is', 'my', 'desk'] }),
      ...topicSentenceBlock({ uz: 'U uy hayvoni', en: 'It is a pet', words: ['It', 'is', 'a', 'pet'] }),
      ...topicSentenceBlock({ uz: 'U politsiya mashinasi', en: 'It is a police car', words: ['It', 'is', 'a', 'police', 'car'] }),
      ...topicSentenceBlock({ uz: 'U juda katta', en: 'It is very big', words: ['It', 'is', 'very', 'big'] }),
      ...phraseBlock('Ha albatta', 'Yes, of course'),
      ...phraseBlock('Men roziman', 'I agree'),
      ...phraseBlock('Siz haqsiz', 'You are right'),
      matchPairs([
        { left: 'It is my desk', right: 'U mening partam' },
        { left: 'It is a pet', right: 'U uy hayvoni' },
        { left: 'It is a police car', right: 'U politsiya mashinasi' },
        { left: 'It is very big', right: 'U juda katta' },
        { left: 'Yes, of course', right: 'Ha albatta' },
      ]),
    ],
  },

  // ── STEP 17 — Uy qismlari (2) ─────────────────────────────────────────────
  {
    orderNumber: 18,
    title: 'STEP 17 — Uy qismlari (2)',
    type: LessonType.english,
    components: [
      ...vocabBlock({ uz: 'tom', en: 'roof', distractors: ['chimney', 'bedroom', 'bathroom'] }),
      ...vocabBlock({ uz: "mo'ri", en: 'chimney', distractors: ['roof', 'bedroom', 'bathroom'] }),
      ...vocabBlock({ uz: 'yotoqxona', en: 'bedroom', distractors: ['roof', 'chimney', 'bathroom'] }),
      ...vocabBlock({ uz: 'yuvinish xonasi', en: 'bathroom', distractors: ['roof', 'chimney', 'bedroom'] }),
      ...phraseBlock('Kirsam maylimi?', 'May I come in?'),
      ...phraseBlock('Kiring, iltimos', 'Come in, please.'),
      ...phraseBlock("O'tiring, iltimos", 'Sit down, please.'),
      matchPairs([
        { left: 'roof', right: 'tom' },
        { left: 'chimney', right: "mo'ri" },
        { left: 'bedroom', right: 'yotoqxona' },
        { left: 'bathroom', right: 'yuvinish xonasi' },
        { left: 'May I come in?', right: 'Kirsam maylimi?' },
      ]),
    ],
  },

  // ── STEP 18 — We (biz) ────────────────────────────────────────────────────
  {
    orderNumber: 19,
    title: 'STEP 18 — We (biz)',
    type: LessonType.english,
    components: [
      mcq([
        {
          text: '"Biz" subjekti uchun "to be" fe\'lining qaysi shakli ishlatiladi?',
          options: ['am', 'are', 'is', 'be'],
          correct: 1,
        },
      ]),
      ...topicSentenceBlock({ uz: 'Biz Yaponiyadanmiz', en: 'We are from Japan', words: ['We', 'are', 'from', 'Japan'] }),
      ...topicSentenceBlock({ uz: "Biz futbol o'yinchilarimiz", en: 'We are football players', words: ['We', 'are', 'football', 'players'] }),
      ...topicSentenceBlock({ uz: 'Biz 25 yoshdamiz', en: 'We are 25 years old', words: ['We', 'are', '25', 'years', 'old'] }),
      ...topicSentenceBlock({ uz: 'Biz aqllimiz', en: 'We are clever', words: ['We', 'are', 'clever'] }),
      ...phraseBlock('Chiqsam maylimi?', 'May I go out?'),
      ...phraseBlock('Tashqariga chiqing, iltimos', 'Go out, please.'),
      ...phraseBlock('Meni kutib turing', 'Wait for me.'),
      matchPairs([
        { left: 'We are from Japan', right: 'Biz Yaponiyadanmiz' },
        { left: 'We are football players', right: "Biz futbol o'yinchilarimiz" },
        { left: 'We are 25 years old', right: 'Biz 25 yoshdamiz' },
        { left: 'We are clever', right: 'Biz aqllimiz' },
        { left: 'May I go out?', right: 'Chiqsam maylimi?' },
      ]),
    ],
  },

  // ── STEP 19 — Xonalar ─────────────────────────────────────────────────────
  {
    orderNumber: 20,
    title: 'STEP 19 — Xonalar',
    type: LessonType.english,
    components: [
      ...vocabBlock({ uz: 'mehmon xona', en: 'living room', distractors: ['dining room', 'kitchen', 'garden'] }),
      ...vocabBlock({ uz: 'ovqatlanish xonasi', en: 'dining room', distractors: ['living room', 'kitchen', 'garden'] }),
      ...vocabBlock({ uz: 'oshxona', en: 'kitchen', distractors: ['living room', 'dining room', 'garden'] }),
      ...vocabBlock({ uz: "bog'", en: 'garden', distractors: ['living room', 'dining room', 'kitchen'] }),
      ...phraseBlock('Kechirasiz', 'Excuse me.'),
      ...phraseBlock('Menga quloq soling', 'Listen to me.'),
      ...phraseBlock('Menga qarang', 'Look at me.'),
      matchPairs([
        { left: 'living room', right: 'mehmon xona' },
        { left: 'dining room', right: 'ovqatlanish xonasi' },
        { left: 'kitchen', right: 'oshxona' },
        { left: 'garden', right: "bog'" },
        { left: 'Excuse me.', right: 'Kechirasiz' },
      ]),
    ],
  },

  // ── STEP 20 — Xatolardan qo'rqmaslik (Personal Dev) ───────────────────────
  {
    orderNumber: 21,
    title: "STEP 20 — Xatolardan qo'rqmaslik",
    type: LessonType.personal_development,
    nRepetitions: 1,
    aiTutorEnabled: true,
    aiTutorContext: [
      "Sen Aloqushsan, do'stona o'zbek bola. O'zbek tilida suhbatlash.",
      "",
      "Bola hozir ushbu mavzuni o'qidi: \"Xatolardan qo'rqmaslik\"",
      "",
      "Asosiy g'oya: Xato qilish yomon emas — harakat qilmaslik yomon. Har bir xato — yangi dars.",
      "",
      "Boladan 3 ta savol so'ra (ketma-ket, javobiga qarab):",
      "1) \"Bu darsdan nima o'rganding?\"",
      "2) \"Oxirgi qilgan xatongdan nima o'rganding?\"",
      "3) \"Keyingi safar xato qilsang, o'zingdan nima so'rayssan?\"",
      "",
      "Har javobini hurmat qil, kichik maslahat ber. Maksimal 2-3 jumla.",
    ].join('\n'),
    components: [
      mcq([
        {
          text: [
            "📖 SHAXSIY RIVOJLANISH — Xatolardan qo'rqmaslik",
            "",
            "Do'stlar, xatoni kim qilmaydi? Hamma qiladi! Hatto eng zo'rlar ham. Faqat farqi shundaki — ular xatodan qo'rqmaydi, undan o'rganadi.",
            "",
            "Ba'zida xatolar bizni uyaltiradi, ichimizdan: \"Odamlar nima deydi?\" degan ovoz chiqadi. Lekin esla: xato qilish — bu yomon emas, harakat qilmaslik — mana bu yomon!",
            "",
            "Qachonki sen adashsang, bu sen harakat qilganingni bildiradi. Demak, sen o'rganayapsan, o'sayapsan. Har bir xato — bu yangi dars!",
            "",
            "Bir mashhur gap bor: \"Eng yaxshi ustozlar — bu xatolar\"",
            "",
            "Shuning uchun do'stim, xatodan qochma. Uni tan ol va o'zingdan so'ra: \"Bu safar nima o'rgandim?\"",
            "",
            "👨‍👩‍👧 Oila a'zolaringizga shu mavzuda treyning o'tib bering va ko'proq oynaga qarab mashq qiling!",
            "",
            "❓ Yangi o'rgangan ish paytida xato qilding. Eng yaxshi javob nima?",
          ].join('\n'),
          options: [
            "Yashirib qo'yish, hech kim bilmasin",
            '"Bu safar nima o\'rgandim?" deb o\'zingdan so\'rash',
            "Boshqa hech qachon urinib ko'rmaslik",
            "Xato qilganim uchun o'zimni ayblayman",
          ],
          correct: 1,
        },
      ]),
    ],
  },

  // ── STEP 21 — About my family (Composition — Archetype D) ─────────────────
  {
    orderNumber: 22,
    title: 'STEP 21 — About my family',
    type: LessonType.english,
    aiTutorEnabled: true,
    aiTutorContext: [
      "You are a friendly English coach for a young Uzbek learner.",
      "The student just composed an 'About my family' paragraph.",
      "Ask 3 short follow-up questions in English, one at a time, to extend the topic.",
      "Be encouraging. Keep responses to 1-2 sentences.",
      "English only — they are practising English.",
    ].join('\n'),
    components: [
      fillBlank('Hello! I have a ___ family.', 'small', ['small', 'big', 'happy', 'large']),
      fillBlank('There are ___ people in my family.', '4', ['2', '3', '4', '5', '6']),
      fillBlank("My father's name is ___.", 'Anvar', ['Anvar', 'Aziz', 'Bobur', 'Jasur']),
      fillBlank("My mother's name is ___.", 'Nilufar', ['Nilufar', 'Malika', 'Zulfiya', 'Sarvinoz']),
      fillBlank("My sister's name is ___.", 'Aziza', ['Aziza', 'Kamola', 'Shahlo', 'Dilnoza']),
      fillBlank('I ___ my family.', 'love', ['love', 'like', 'miss', 'help']),
      speakWords(
        "Hello! I have a small family. There are 4 people in my family. My father's name is Anvar. My mother's name is Nilufar. My sister's name is Aziza. I love my family.",
        70,
      ),
    ],
  },

  // ── TAKRORLASH 1-11 — Checkpoint (Archetype F) ────────────────────────────
  {
    orderNumber: 12,
    title: 'TAKRORLASH 1-11',
    type: LessonType.english,
    hasExam: true,
    nRepetitions: 5,
    components: [
      // ── Vocab matched-pair recall (8 vocab in two rounds of 4) ──────────
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
      // ── Phrase translate (UZ → EN) for every greeting/functional phrase ─
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
      translate("Kuningiz qanday o'tyapti?", 'How is your day?'),
      translate('Men xursandman', 'I am happy'),
      translate("Sizni sog'indim", 'I missed you'),
      translate('Xush kelibsiz', 'Welcome'),
      translate("Keyinroq ko'rishguncha", 'See you later'),
      translate('Qaerdasan?', 'Where are you?'),
      translate('Men bu yerdaman', 'I am here'),
      translate('Bu yerga kel', 'Come here'),
      // ── Topic sentence drills (word_order for I- and she- patterns) ─────
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
  {
    orderNumber: 23,
    title: 'TAKRORLASH 12-21',
    type: LessonType.english,
    hasExam: true,
    nRepetitions: 5,
    components: [
      // ── Vocab match-pair recall (17 vocab in 3 rounds) ─────────────
      matchPairs([
        { left: 'aunt', right: 'amma' },
        { left: 'cousin', right: 'amakivachcha' },
        { left: "nephew", right: "o'g'il jiyan" },
        { left: 'niece', right: 'qiz jiyan' },
        { left: 'grandparents', right: 'bobo-buvi' },
      ]),
      matchPairs([
        { left: 'house', right: 'uy' },
        { left: 'door', right: 'eshik' },
        { left: 'window', right: 'deraza' },
        { left: 'wall', right: 'devor' },
        { left: 'roof', right: 'tom' },
        { left: 'chimney', right: "mo'ri" },
      ]),
      matchPairs([
        { left: 'bedroom', right: 'yotoqxona' },
        { left: 'bathroom', right: 'yuvinish xonasi' },
        { left: 'living room', right: 'mehmon xona' },
        { left: 'dining room', right: 'ovqatlanish xonasi' },
        { left: 'kitchen', right: 'oshxona' },
        { left: 'garden', right: "bog'" },
      ]),
      // ── Phrase translates (UZ → EN) ───────────────────────────────
      translate("Keyinroq ko'rishguncha", 'See you later'),
      translate("Ertaga ko'rishguncha", 'See you tomorrow'),
      translate("Tezda orada ko'rishguncha", 'See you soon'),
      translate('Raxmat', 'Thank you'),
      translate('Katta rahmat', 'Thanks a lot'),
      translate('Arzimaydi', 'You are welcome'),
      translate('Kechirasiz', 'I am sorry'),
      translate('Hammasi joyida', 'That is okay'),
      translate("Muammo yo'q", 'No problem'),
      translate('Ha albatta', 'Yes of course'),
      translate('Men roziman', 'I agree'),
      translate('Siz haqsiz', 'You are right'),
      translate('Kirsam maylimi?', 'May I come in?'),
      translate('Kiring, iltimos', 'Come in, please'),
      translate("O'tiring, iltimos", 'Sit down, please'),
      translate('Chiqsam maylimi?', 'May I go out?'),
      translate('Tashqariga chiqing, iltimos', 'Go out, please'),
      translate('Meni kutib turing', 'Wait for me'),
      translate('Menga quloq soling', 'Listen to me'),
      translate('Menga qarang', 'Look at me'),
      // ── Topic sentence drills (he, it, we) ────────────────────────
      wordOrder([
        { words: ['firefighter', 'a', 'is', 'He'], correct: 'He is a firefighter' },
        { words: ['Australia', 'from', 'is', 'He'], correct: 'He is from Australia' },
        { words: ['well-built', 'is', 'He'], correct: 'He is well-built' },
        { words: ['friend', 'my', 'is', 'He'], correct: 'He is my friend' },
      ]),
      wordOrder([
        { words: ['desk', 'my', 'is', 'It'], correct: 'It is my desk' },
        { words: ['pet', 'a', 'is', 'It'], correct: 'It is a pet' },
        { words: ['car', 'police', 'a', 'is', 'It'], correct: 'It is a police car' },
        { words: ['big', 'very', 'is', 'It'], correct: 'It is very big' },
      ]),
      wordOrder([
        { words: ['Japan', 'from', 'are', 'We'], correct: 'We are from Japan' },
        { words: ['players', 'football', 'are', 'We'], correct: 'We are football players' },
        { words: ['old', 'years', '25', 'are', 'We'], correct: 'We are 25 years old' },
        { words: ['clever', 'are', 'We'], correct: 'We are clever' },
      ]),
      // ── Speak-aloud key phrases ──────────────────────────────────
      speakSentence('See you later', 70),
      speakSentence('Thank you', 70),
      speakSentence('I am sorry', 70),
      speakSentence('Yes, of course', 70),
      speakSentence('Excuse me', 70),
      speakSentence('May I come in?', 70),
      speakSentence('Wait for me', 70),
      // ── 'About my family' composition recall ────────────────────
      speakWords(
        "Hello! I have a small family. There are 4 people in my family. My father's name is Ali. My mother's name is Dilnoza. I love my family.",
        70,
      ),
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
