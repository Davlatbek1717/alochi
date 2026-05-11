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
      ...phraseBlock("Uyg'on, do'stim.", 'Wake up, friend.'),
      ...phraseBlock('Xayrli tong, hammaga', 'Morning, everyone'),
      // ── added: informal greetings ──────────────────────────────────────────
      ...phraseBlock('Salom', 'Hi'),
      ...phraseBlock('Salom', 'Hello'),
      ...phraseBlock('Hayo', 'Hey'),
      // ── added: critical-thinking MCQ ──────────────────────────────────────
      mcq([
        {
          text: "Ertalab birovni ko'rganda nima deyish kerak?",
          options: ['Hello', 'Good morning', 'Good night', 'Goodbye'],
          correct: 1,
        },
        {
          text: "'Wake up' tarjimasi qaysi?",
          options: ["Uxlash", "Uyg'on", 'Tushlik', 'Yotish'],
          correct: 1,
        },
        {
          text: "'Morning, everyone' kimga aytiladi?",
          options: ['Bittagina odamga', 'Hammaga', 'Hech kimga', 'Faqat ustozga'],
          correct: 1,
        },
      ]),
      // ── added: word-order practice ────────────────────────────────────────
      wordOrder([
        { words: ['morning', 'Good'], correct: 'Good morning' },
        { words: ['friend', 'up', 'Wake'], correct: 'Wake up friend' },
        { words: ['everyone', 'Morning'], correct: 'Morning everyone' },
      ]),
      // ── added: chained speaking ───────────────────────────────────────────
      speakWords('Good morning everyone! Wake up friend!', 70),
      // ── added: reverse match-pairs ────────────────────────────────────────
      matchPairs([
        { left: 'Xayrli tong', right: 'Good morning' },
        { left: "Uyg'on, do'stim", right: 'Wake up, friend' },
        { left: 'Xayrli tong, hammaga', right: 'Morning, everyone' },
        { left: 'Salom', right: 'Hi' },
      ]),
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
      ...phraseBlock("Salom, do'stim", 'Hello, friend'),
      matchPairs([
        { left: 'Good morning', right: 'Xayrli tong' },
        { left: 'Wake up', right: "Uyg'on" },
        { left: 'Morning, everyone', right: 'Xayrli tong, hammaga' },
      ]),
      // ── added: more phrases ───────────────────────────────────────────────
      ...phraseBlock("Salom, do'stim", 'Hello, my friend'),
      ...phraseBlock('Xush kelibsiz', 'Welcome'),
      ...phraseBlock('Yaxshi kechki ovqat tilayman', 'Have a good evening'),
      // ── added: critical-thinking MCQ ──────────────────────────────────────
      mcq([
        {
          text: "Tushdan keyin (12:00 dan keyin) qanday salomlashasiz?",
          options: ['Good morning', 'Good afternoon', 'Good night', 'Goodbye'],
          correct: 1,
        },
        {
          text: "Kechqurun (18:00 dan keyin) qanday salomlashasiz?",
          options: ['Good morning', 'Good afternoon', 'Good evening', 'Good night'],
          correct: 2,
        },
        {
          text: "'Hello' qanday vaqtda ishlatiladi?",
          options: ['Faqat ertalab', 'Faqat kechqurun', 'Istalgan vaqtda', 'Faqat tunda'],
          correct: 2,
        },
        {
          text: "Sizning ismingiz qanday so'rashadi?",
          options: ["What's your name?", "What's your age?", "Where are you from?", "How old are you?"],
          correct: 0,
        },
      ]),
      // ── added: word-order practice ────────────────────────────────────────
      wordOrder([
        { words: ['afternoon', 'Good'], correct: 'Good afternoon' },
        { words: ['evening', 'Good'], correct: 'Good evening' },
        { words: ['friend', 'Hello'], correct: 'Hello friend' },
      ]),
      // ── added: chained speaking ───────────────────────────────────────────
      speakWords('Good afternoon. Good evening. Hello.', 70),
      // ── added: cumulative match-pairs (STEPs 1-2) ─────────────────────────
      matchPairs([
        { left: 'Good morning', right: 'Xayrli tong' },
        { left: 'Good afternoon', right: 'Xayrli kun' },
        { left: 'Good evening', right: 'Xayrli kech' },
        { left: 'Hello', right: 'Salom' },
        { left: 'Welcome', right: 'Xush kelibsiz' },
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
      // ── added: farewell/extension phrases ────────────────────────────────
      ...phraseBlock("Xayr, omon bo'l", 'Goodbye, take care'),
      ...phraseBlock('Tushlaringiz shirin bo\'lsin', 'Sweet dreams'),
      ...phraseBlock("Sog' bo'l", 'Bye-bye'),
      // ── added: critical-thinking MCQ ──────────────────────────────────────
      mcq([
        {
          text: 'Yotishdan oldin oilangizga nima deysiz?',
          options: ['Good morning', 'Good night', 'Hello', 'Welcome'],
          correct: 1,
        },
        {
          text: "'Sleep well' qanday tarjima qilinadi?",
          options: ['Salomlashish', 'Yaxshi dam oling', 'Ertaga ko\'rishaman', 'Xayr'],
          correct: 1,
        },
        {
          text: "'Goodbye' qachon ishlatiladi?",
          options: ['Yotishdan oldin', 'Ketishdan oldin', 'Salomlashganda', 'Tushlik vaqti'],
          correct: 1,
        },
        {
          text: "'Have a good night' tarjimasi qaysi?",
          options: ['Xayrli kech', 'Xayrli tun bo\'lsin', 'Yaxshi tushliklar', 'Yotishdan oldin'],
          correct: 1,
        },
      ]),
      // ── added: word-order practice ────────────────────────────────────────
      wordOrder([
        { words: ['night', 'Good'], correct: 'Good night' },
        { words: ['well', 'Sleep'], correct: 'Sleep well' },
        { words: ['Goodbye'], correct: 'Goodbye' },
      ]),
      // ── added: chained speaking ───────────────────────────────────────────
      speakWords('Good night. Sleep well. Goodbye.', 70),
      // ── added: cumulative match-pairs (STEPs 1-3) ─────────────────────────
      matchPairs([
        { left: 'Good morning', right: 'Xayrli tong' },
        { left: 'Good night', right: 'Xayrli tun' },
        { left: 'Sleep well', right: 'Yaxshi dam oling' },
        { left: 'Goodbye', right: 'Xayr' },
        { left: 'Good evening', right: 'Xayrli kech' },
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
      // ── added: state/feeling phrases ─────────────────────────────────────
      ...phraseBlock('Charchadim', 'I am tired'),
      ...phraseBlock('Och qoldim', 'I am hungry'),
      ...phraseBlock('Yaxshiyam', 'Thanks!'),
      // ── added: critical-thinking MCQ ──────────────────────────────────────
      mcq([
        {
          text: "Kimnidir 'Qalaysiz?' deb so'rashganda nima javob beriladi?",
          options: ['I am morning', 'I am fine', 'Goodbye', 'Hello'],
          correct: 1,
        },
        {
          text: "'I am sleepy' qachon ishlatiladi?",
          options: ['Quvonganda', 'Charchaganda yoki uyqu kelganda', 'Salomlashganda', 'Xayr aytishda'],
          correct: 1,
        },
        {
          text: "'How are you?' kim bilan ishlatiladi?",
          options: ["Faqat o'qituvchi bilan", 'Faqat onam bilan', "Hammasi bilan, salomlashishdan keyin", 'Hech kim bilan'],
          correct: 2,
        },
        {
          text: "'I am fine, thank you' qaysi savolga javob?",
          options: ['Where are you?', 'Who are you?', 'How are you?', 'What is this?'],
          correct: 2,
        },
      ]),
      // ── added: word-order practice ────────────────────────────────────────
      wordOrder([
        { words: ['you', 'are', 'How'], correct: 'How are you' },
        { words: ['fine', 'am', 'I'], correct: 'I am fine' },
        { words: ['sleepy', 'am', 'I'], correct: 'I am sleepy' },
      ]),
      // ── added: chained speaking ───────────────────────────────────────────
      speakWords('How are you? I am fine, thank you.', 70),
      // ── added: cumulative match-pairs (STEPs 1-4) ─────────────────────────
      matchPairs([
        { left: 'How are you?', right: 'Qalaysiz?' },
        { left: 'I am fine', right: 'Men yaxshiman' },
        { left: 'I am sleepy', right: 'Uyqum kelyapti' },
        { left: 'I am tired', right: 'Charchadim' },
        { left: 'Good night', right: 'Xayrli tun' },
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
      mcq([{ text: "Aqlli fikrlashning birinchi qadami nima?", options: ["Tezroq harakat qilish", "Doim savol berish", "Boshqalarga ergashish", "O'ynashni boshlash"], correct: 1 }]),
      mcq([{ text: "Har kuni nima qilish eng muhim?", options: ["Ko'p o'ynash", "Bitta kichik o'zgarish qilish", "Hech narsa qilmaslik", "Boshqalarni kuzatish"], correct: 1 }]),
      mcq([{ text: "Aqlli odam bo'lish — bu nima?", options: ["Tug'ma qobiliyat", "O'rganiladigan odat", "Boylik bilan keladi", "Faqat ustozlarda bor"], correct: 1 }]),
      mcq([{ text: "Eng yaxshi savol qaysi?", options: ["'Hamma nima qilyapti?'", "'Yaxshiroq yo'li bormi?'", "'Bu osonroqmi?'", "'Boshqalar tasdiqlaydimi?'"], correct: 1 }]),
      mcq([{ text: "Sinfdosh xato qildi. Aqlli qaror qaysi?", options: ["Kulish", "O'zimga 'agar bu men bo'lsam, nima o'rganardim?' deb savol berish", "Hamma bilan g'iybat qilish", "Hech narsa o'rganmaslik"], correct: 1 }]),
      mcq([{ text: "Telefonda 3 soat o'tirgandan keyin nima qilish kerak?", options: ["Yana 3 soat davom etish", "O'zingga 'bu vaqt qaytmaydi' deb eslatish va foydali ishga o'tish", "Boshqa video tomosha qilish", "Darhol uxlash"], correct: 1 }]),
      mcq([{ text: "Yangi narsa o'rganishda eng zarur sifat:", options: ["Tezlik", "Qiziquvchanlik va savol berish", "Boshqalar maqtashi", "Hech qachon adashmaslik"], correct: 1 }]),
      mcq([{ text: "Kichik kundalik o'zgarish nimaga olib keladi?", options: ["Hech narsaga", "Vaqt o'tishi bilan katta yutuqlarga", "Faqat charchoqqa", "Boshqalarning g'azabiga"], correct: 1 }]),
      mcq([{ text: "Buyuk olimlar bolalikdan qanday bo'lishgan?", options: ["Hech narsadan qiziqmagan", "Doim savol bergan va izlagan", "Faqat o'qituvchidan o'rgangan", "Hech qanday sa'y-harakat qilmagan"], correct: 1 }]),
      mcq([{ text: "Ota-onangdan har kuni qaysi turdagi narsalarni o'rganish foydali?", options: ["Hech narsa", "Hayot tajribasi va maslahatlar", "Faqat pul olish", "Faqat baholar haqida gapirish"], correct: 1 }]),
      mcq([{ text: "Bekorchi vaqtda eng aqlli ish:", options: ["O'yin o'ynash", "Kitob o'qish yoki yangi narsa o'rganish", "Telefonni scroll qilish", "Hech narsa qilmaslik"], correct: 1 }]),
      mcq([{ text: "Boshqalardan oldin nima qilish kerak?", options: ["Tezroq qaror qabul qilish", "Avval o'ylab ko'rish", "Boshqalar bilan rozi bo'lish", "Hech narsa qilmaslik"], correct: 1 }]),
      mcq([{ text: "'Bu menga foyda keltiradimi?' degan savol qachon foydali?", options: ["Hech qachon", "Har bir tanlovdan oldin", "Faqat dars vaqtida", "Faqat ovqat paytida"], correct: 1 }]),
      mcq([{ text: "Aqlli fikrlashga qarshi narsa:", options: ["Savol berish", "Shoshilish va o'ylab ko'rmaslik", "Kitob o'qish", "Diqqat bilan eshitish"], correct: 1 }]),
      mcq([{ text: "Aqlli odamning eng katta sifati:", options: ["Hech qachon adashmaslik", "Doim o'rganishga tayyorlik", "Hammadan ko'p bilish", "Hammadan kuchli bo'lish"], correct: 1 }]),
      mcq([{ text: "Bugun bitta yangi fikrni qaerdan olish mumkin?", options: ["Hech qaerdan", "Kitob, ota-ona, video yoki o'z fikringdan", "Faqat televizordan", "Faqat tushda"], correct: 1 }]),
      mcq([{ text: "Hozirning eng to'g'ri qaroriga misol:", options: ["3 soat o'yin o'ynash", "Bitta foydali kitob bobini o'qish", "Ovqat yemay uxlash", "Doim ko'rsatma kutish"], correct: 1 }]),
      mcq([{ text: "Sen orzu qilgan kelajakka qanday yetib borasan?", options: ["Hozir hech narsa qilmasdan", "Hozirgi har bir kichik tanlovingdan", "Boshqalardan ko'chirib", "Tasodifan"], correct: 1 }]),
      mcq([{ text: "Qaysi holat aqlli fikrlashni ifodalaydi?", options: ["Darsni tushunmay, savol bermay o'tirish", "'Bu nima uchun kerak?' deb o'qituvchidan so'rash", "Barchaning aytganiga ko'r-ko'rona rioya qilish", "Hamma narsadan zerikish"], correct: 1 }]),
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
      ...phraseBlock("Sizning ismingiz nima?", "What is your name?"),
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
      ...topicSentenceBlock({ uz: "Men bu yerdanman", en: 'I am from here', words: ['I', 'am', 'from', 'here'] }),
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
      mcq([{ text: "Qo'rqmaslik degani nima?", options: ["Hech narsadan qo'rqmaslik", "Qo'rqib turganda ham qadam tashlash", "Jur'atli ko'rinish", "Boshqalarga qo'shimcha kuch ko'rsatish"], correct: 1 }]),
      mcq([{ text: "Birinchi marta sahnaga chiqishdan qo'rqyapsan. Eng to'g'ri qaror:", options: ["Sahnaga umuman chiqmaslik", "Qo'rqsam ham chiqib ko'rish", "Boshqa birovni yuborish", "Keyingi safarga qoldirishni so'rash"], correct: 1 }]),
      mcq([{ text: "Har bir kuchli inson avval nima qilgan?", options: ["Hech qachon qo'rqmagan", "Qo'rqqan, lekin to'xtamagan", "Yolg'iz ishlagan", "Hamma bilan kelishgan"], correct: 1 }]),
      mcq([{ text: "Yangi mavzuni o'qishdan qo'rqyapsan. Nima qilish kerak?", options: ["O'qishni tashlab qo'yish", "Boshqadan ko'chirib olish", "Avval bir oz urinib ko'rish", "O'qituvchiga aytmaslik"], correct: 2 }]),
      mcq([{ text: "Qo'rquv seni to'xtatganda sen nima qilishing kerak?", options: ["Hamma narsani tashlab ketish", "Qo'rquv o'tib ketishini kutish", "Shunga qaramay bir qadam tashlash", "Boshqalardan yordam so'ramaslik"], correct: 2 }]),
      mcq([{ text: "Ovoz chiqarib javob berishdan qo'rqyapsan. Eng yaxshi harakat:", options: ["Jim o'tirish", "Quyi ovozda bo'lsa ham urinib ko'rish", "Boshqa birovga aytish", "Sinfdan chiqib ketish"], correct: 1 }]),
      mcq([{ text: "Qo'rquv qachon kamayadi?", options: ["Hech qachon", "Harakat qilgan sari", "Faqat yoshi ulg'aysa", "Boshqalar qo'rqmasligini ko'rsang"], correct: 1 }]),
      mcq([{ text: "Nima uchun qo'rqish — bu yomonlik emas?", options: ["Chunki hamma qo'rqadi", "Chunki qo'rquv seni harakat qilishga undaydi", "Chunki qo'rquv yo'qoladi", "Chunki ustozlar ruxsat beradi"], correct: 1 }]),
      mcq([{ text: "Yozishni o'rganayotganingda noto'g'ri yozding. Bu nima degani?", options: ["Sen yomon o'quvchisan", "Sen harakat qilyapsan va o'rganayapsan", "Sen hech qachon o'rgana olmaysan", "Sen yozishni o'rganmasliging kerak"], correct: 1 }]),
      mcq([{ text: "Do'sting yangi sport o'rganayapti va qo'rqyapti. Sen unga nima deysang?", options: ["'Qo'rqsang qo'ya qol'", "'Qo'rqish odatiy, lekin bir urinib ko'r'", "'Sen hech qachon qila olmaysan'", "'Boshqa narsa qil'"], correct: 1 }]),
      mcq([{ text: "Kuch qayerdan keladi?", options: ["Qo'rqmaslikdan", "Qo'rqib turib baribir urinib ko'rishdan", "Kuchli ko'rinishdan", "Boshqalarga isbotlashdan"], correct: 1 }]),
      mcq([{ text: "O'qituvchi savol berdi, sen bilasang lekin qo'rqyapsan. Nima qilish kerak?", options: ["Jim o'tirish", "Qo'lingni ko'tarib javob berish", "Boshqa birovning javobini kutish", "Tashqariga chiqish"], correct: 1 }]),
      mcq([{ text: "Qo'rquvni yengish uchun birinchi qadam:", options: ["Qo'rquvni his qilmaslik", "Kichkina qadam tashlash", "Katta maqsad qo'yish", "Boshqalardan o'rganish"], correct: 1 }]),
      mcq([{ text: "Yangi do'st orttirmoqchisan lekin uyalyapsan. Aqlli qaror:", options: ["Hech qachon gaplashmaslik", "Birinchi 'Salom' deb murojaat qilish", "Boshqalar gaplashishini kutish", "O'z fikrlarini yashirish"], correct: 1 }]),
      mcq([{ text: "Nima uchun birinchi harakat qilib ko'rish muhim?", options: ["Chunki barchasi kutadi", "Chunki harakat qilmay turib natija bo'lmaydi", "Chunki shunday qilinadi", "Chunki boshqalar buni qilgan"], correct: 1 }]),
      mcq([{ text: "Qaysi fikr to'g'ri?", options: ["Kuchli odamlar hech qachon qo'rqmaydi", "Kuchli odamlar qo'rqsalar ham harakat qiladi", "Qo'rquv — zaiflikning belgisi", "Qo'rquv faqat bolalarda bo'ladi"], correct: 1 }]),
      mcq([{ text: "Yangi mavzuda xato qilding. Eng yaxshi munosabat:", options: ["Endi o'qimaslik", "Xatoni tan olib, yana urinib ko'rish", "Ustozga aytmaslik", "Boshqa birovni ayblash"], correct: 1 }]),
      mcq([{ text: "O'zingning qo'rquv hissini his qilsang, bu nimani bildiradi?", options: ["Sen zaifsan", "Sен oldinga yuryapsan va rivojlanyapsan", "Seni biror narsa to'xtatmoqda", "Shu yo'l sening emas"], correct: 1 }]),
      mcq([{ text: "Hozir sen qanday qadam qo'yishing mumkin?", options: ["Hech narsa qilmaslik", "Biroz kutiш", "O'sha qo'rqitayotgan ishni kichik qadam bilan boshlash", "Boshqalar nima deyishini so'rash"], correct: 2 }]),
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
      fillBlank('Hello! I am a ___.', 'student', ['student', 'teacher', 'driver', 'doctor']),
      fillBlank('My family is ___.', 'small', ['small', 'big', 'happy', 'kind']),
      fillBlank('I am ___ years old.', '10', ['8', '9', '10', '11', '12']),
      fillBlank('I am from ___.', 'my city', ['my city', 'here', 'my country', 'another city']),
      fillBlank('I live in ___.', 'my town', ['my town', 'my city', 'my village', 'another city']),
      fillBlank('I am a ___ at school.', 'pupil', ['pupil', 'teacher', 'student']),
      fillBlank('My favourite subject is ___.', 'English', ['English', 'Math', 'Music', 'PE']),
      fillBlank('My favourite color is ___.', 'red', ['red', 'blue', 'green', 'yellow']),
      fillBlank('My favourite vehicle is ___.', 'a car', ['a car', 'a bike', 'a bus', 'a truck']),
      // ── Translate UZ → EN for each template sentence ────────────────────────
      translate('Salom, men talaba.', 'Hello, I am a student'),
      translate('Oilam kichik.', 'My family is small'),
      translate('Men 10 yoshdaman.', 'I am 10 years old'),
      translate('Men shahardan.', 'I am from my city'),
      translate('Men sharimda yashayman.', 'I live in my town'),
      translate("Men maktab o'quvchisiman.", 'I am a pupil at school'),
      translate('Sevimli fanim ingliz tili.', 'My favourite subject is English'),
      translate('Sevimli rangim qizil.', 'My favourite color is red'),
      // ── Word-order assembly for 4 key lines ─────────────────────────────────
      wordOrder([
        { words: ['student', 'a', 'am', 'I'], correct: 'I am a student' },
        { words: ['old', 'years', '10', 'am', 'I'], correct: 'I am 10 years old' },
        { words: ['here', 'from', 'am', 'I'], correct: 'I am from here' },
        { words: ['English', 'is', 'subject', 'favourite', 'My'], correct: 'My favourite subject is English' },
      ]),
      // ── Speak individual key sentences ──────────────────────────────────────
      speakSentence('I am a student', 70),
      speakSentence('I am 10 years old', 70),
      speakSentence('I am from here', 70),
      speakSentence('My favourite subject is English', 70),
      // ── Comprehension MCQ about composition structure ────────────────────────
      mcq([
        { text: "Inglizcha kompozitsiya odatda qaysi so'z bilan boshlanadi?", options: ['Goodbye', 'Hello!', 'Welcome', 'Thank you'], correct: 1 },
        { text: '"My name is ..." iborasidan keyin nima yoziladi?', options: ['Sevimli rang', 'Yosh', 'Ism', 'Maktab'], correct: 2 },
        { text: "Yoshni ifodalashda qaysi tuzilma to'g'ri?", options: ['I have 10 years', 'I am 10 years old', 'I 10 years', 'My age is 10'], correct: 1 },
        { text: '"I am from ..." nimani anglatadi?', options: ["Yoshim", "Tug'ilgan joyim/qaerdanligim", 'Ismim', 'Sevimli ranglim'], correct: 1 },
      ]),
      speakWords(
        "Hello! I am a student. My family is small. I am 10 years old. I am from here. I live in my town. I am a pupil at school. My favourite subject is English. My favourite color is red. My favourite vehicle is a car.",
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
      ...topicSentenceBlock({ uz: 'U boshqa davlatdan', en: 'He is from another country', words: ['He', 'is', 'from', 'another', 'country'] }),
      ...topicSentenceBlock({ uz: 'U kelishgan', en: 'He is well-built', words: ['He', 'is', 'well-built'] }),
      ...topicSentenceBlock({ uz: "U mening do'stim", en: 'He is my friend', words: ['He', 'is', 'my', 'friend'] }),
      ...phraseBlock('Raxmat', 'Thank you'),
      ...phraseBlock('Katta rahmat', 'Thanks a lot'),
      ...phraseBlock('Arzimaydi', 'You are welcome'),
      matchPairs([
        { left: 'He is a firefighter', right: "U o't o'chiruvchi" },
        { left: 'He is from another country', right: 'U boshqa davlatdan' },
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
      mcq([{ text: "O'zingni kim bilan solishtirish to'g'ri?", options: ["Eng zo'r sinfdoshing bilan", "Kechagi o'zing bilan", "Mashhur odamlar bilan", "Tenqurlaringdan yaxshisi bilan"], correct: 1 }]),
      mcq([{ text: "Boshqalar bilan o'zingni solishtirish nima beradi?", options: ["Motivatsiya", "Taraqqiyot", "Ko'pincha iztirob va ruhiy tushkunlik", "Yangi do'stlar"], correct: 2 }]),
      mcq([{ text: "O'z yo'lingda yurish degani nima?", options: ["Hamma bilan bir xil bo'lish", "O'zingga xos sur'at va yo'nalishda rivojlanish", "Boshqalardan tez bo'lish", "Hammadan zo'r bo'lish"], correct: 1 }]),
      mcq([{ text: "Kechagi o'zing bilan solishtirishdan maqsad nima?", options: ["O'zingni yomonlash", "O'sishingni ko'rish va rivojlanishni davom ettirish", "Boshqalarga isbotlash", "Mukammal bo'lish"], correct: 1 }]),
      mcq([{ text: "Sinfdoshing senga nisbatan ko'proq baho oldi. Sog'lom fikr:", options: ["'Men hech narsaga yaramayman'", "'Kechagi o'zimdan yaxshilansam bo'ldi'", "'Nima bo'lganda ham tengman'", "'Men undan zo'rman'"], correct: 1 }]),
      mcq([{ text: "Har bir inson nimasi bilan yagona?", options: ["Tashqi ko'rinishi bilan", "Ovozi, fikri va orzulari bilan", "Baho va natijalari bilan", "Do'stlari bilan"], correct: 1 }]),
      mcq([{ text: "O'z o'zi bilan raqobatlashish nimani bildiradi?", options: ["Boshqalarni yutish", "Har kuni o'zini bir oz yaxshilash", "Hech kimga isbotlamaslik", "Natijaga e'tibor bermaslik"], correct: 1 }]),
      mcq([{ text: "Kecha dangasa eding, bugun dars qilding. Bu nima?", options: ["Kichik o'zgarish — bu taraqqiyot", "Hech narsa emas", "Boshqalardan past bo'lish", "Tasodifiy harakat"], correct: 0 }]),
      mcq([{ text: "Do'sting senga: 'Sen undan zaifsan' dedi. Eng sog'lom javob:", options: ["Yig'lash", "'Men o'z yo'limdaman, u menga o'xshamaydi'", "Do'sting bilan kelishish", "'Sen ham zaifsan'"], correct: 1 }]),
      mcq([{ text: "Ijtimoiy tarmoqda boshqalarning yutuqlarini ko'rganda nima qilish kerak?", options: ["Rashk qilish", "Ularning yutuqlaridan ilhomlanib, o'z rivojlanishga e'tibor berish", "Ularni yomonlash", "Telefonni o'chirish"], correct: 1 }]),
      mcq([{ text: "O'z ovozingni, fikringni, orzularingni qanday bilish mumkin?", options: ["Boshqalar aytsa bilinadi", "O'zingni tinglash va o'z fikringga e'tibor berish orqali", "Faqat ustozlar aytsa", "Ota-onalar belgilaydi"], correct: 1 }]),
      mcq([{ text: "Nima uchun boshqalar bilan o'zingni solishtirish noto'g'ri?", options: ["Chunki hamma bir xil", "Chunki har kimning o'z yo'li, o'z vaqti va imkoniyati bor", "Chunki solishtirib bo'lmaydi", "Chunki boshqalar ham shunday qiladi"], correct: 1 }]),
      mcq([{ text: "O'zingga aytadigan eng to'g'ri gap:", options: ["'Men hech qachon zo'r bo'la olmayman'", "'Men o'z yo'limdaman. Bugun kechagidan yaxshiman'", "'Men hammadan zo'rman'", "'Hamma menden zo'r'"], correct: 1 }]),
      mcq([{ text: "Rashk (hasad) his qilganda nima qilish foydali?", options: ["Uni yashirish", "O'sha energiyani o'z rivojlanishga yo'naltirish", "Boshqani yomonlash", "Hech narsa qilmaslik"], correct: 1 }]),
      mcq([{ text: "Kechagi xatongni bugun tuzatding. Bu nima degani?", options: ["Sen zaifsan", "Sen o'syapsan", "Sen omadlisan", "Sen kechadan yomonsan"], correct: 1 }]),
      mcq([{ text: "Uzoq muddatda kim g'olib chiqadi?", options: ["Eng tez yuguruvchi", "Har kuni o'zini biroz yaxshilagan", "Eng ko'p baho olgan", "Eng ko'p o'ynagan"], correct: 1 }]),
      mcq([{ text: "O'zingni boshqalar bilan solishtirishni to'xtatmoqchi bo'lsang, birinchi qadam:", options: ["Hamma ijtimoiy tarmoqlarni o'chirish", "Bugungi o'zingni kechagingdan qanday farqini topish", "Hech kim bilan gaplashmaslik", "Faqat muvaffaqiyatga e'tibor berish"], correct: 1 }]),
      mcq([{ text: "Har bir o'ziga xos inson boshqalardan farqlanishini his qilsa:", options: ["Bu muammo", "Bu uning kuchi va o'ziga xosligi", "Bu unga yordam bermaydi", "Bu boshqalar uchun yaxshi emas"], correct: 1 }]),
      mcq([{ text: "Qaysi savol o'sishga yordam beradi?", options: ["'Nega men undan zaifman?'", "'Kecha nima qildim, bugun qanday yaxshilandim?'", "'Hammadan qachon zo'r bo'laman?'", "'Nima uchun men omadlimas?'"], correct: 1 }]),
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
      ...topicSentenceBlock({ uz: 'Biz boshqa davlatdanmiz', en: 'We are from abroad', words: ['We', 'are', 'from', 'abroad'] }),
      ...topicSentenceBlock({ uz: "Biz futbol o'yinchilarimiz", en: 'We are football players', words: ['We', 'are', 'football', 'players'] }),
      ...topicSentenceBlock({ uz: 'Biz 25 yoshdamiz', en: 'We are 25 years old', words: ['We', 'are', '25', 'years', 'old'] }),
      ...topicSentenceBlock({ uz: 'Biz aqllimiz', en: 'We are clever', words: ['We', 'are', 'clever'] }),
      ...phraseBlock('Chiqsam maylimi?', 'May I go out?'),
      ...phraseBlock('Tashqariga chiqing, iltimos', 'Go out, please.'),
      ...phraseBlock('Meni kutib turing', 'Wait for me.'),
      matchPairs([
        { left: 'We are from abroad', right: 'Biz boshqa davlatdanmiz' },
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
      mcq([{ text: "Xato qilish nima degani?", options: ["Sen yomon insonsan", "Sen harakat qilyapsan va o'rganayapsan", "Sen hech qachon muvaffaqiyatli bo'la olmaysan", "Sen dangasasan"], correct: 1 }]),
      mcq([{ text: "Xatodan nima o'rganish mumkin?", options: ["Hech narsa", "Qanday qilib yaxshiroq harakat qilishni", "Faqat qiynalishni", "Boshqalarga aytishdan uyalishni"], correct: 1 }]),
      mcq([{ text: "Eng yaxshi ustoz kim deyilgan?", options: ["Ota-onalar", "Maktab o'qituvchilari", "Xatolar", "Kitoblar"], correct: 2 }]),
      mcq([{ text: "Xato qilgandan keyin o'zingdan so'rash kerak bo'lgan savol:", options: ["'Nega men bu qadar baxtsizman?'", "'Bu safar nima o'rgandim?'", "'Kim aybdor?'", "'Endi nima qilamman?'"], correct: 1 }]),
      mcq([{ text: "Harakat qilmaslik xato qilishdan yomonroq, chunki:", options: ["Harakat qilish vaqtni isrof qiladi", "Harakat qilmasdan o'sib bo'lmaydi", "Xatolar uyaltiradi", "Boshqalar kuladi"], correct: 1 }]),
      mcq([{ text: "Sinf oldida noto'g'ri javob berding. Nima qilish kerak?", options: ["Yig'lab chiqib ketish", "Xatoni tan olish va to'g'ri javobni o'rganish", "Hech narsaga e'tibor bermaslik", "O'qituvchini ayblash"], correct: 1 }]),
      mcq([{ text: "Nima uchun xatodan qochmaslik kerak?", options: ["Chunki hamma qiladi", "Chunki xato seni o'stiradi va o'rgatadi", "Chunki boshqalar ham qiladi", "Chunki xato muhim emas"], correct: 1 }]),
      mcq([{ text: "Mashhur odamlar ham xato qiladimi?", options: ["Yo'q, ular mukammal", "Ha, lekin ular undan o'rganadi", "Ha, lekin ular yashiradi", "Yo'q, ular doim to'g'ri qiladi"], correct: 1 }]),
      mcq([{ text: "Xatoni tan olishning foydasi nima?", options: ["Foydasi yo'q", "Xatoni tan olish — o'sishning boshlanishi", "Faqat boshqalarga ko'rsatish uchun", "O'zingni yomonlash uchun"], correct: 1 }]),
      mcq([{ text: "Xato qilishdan qo'rqib hech narsa qilmadingiz. Natijada nima bo'ladi?", options: ["Hech narsa yo'qotilmaydi", "Rivojlanmaysiz va o'rganmaysiz", "Vaqtingiz tejaldi", "Boshqalar maqtaydi"], correct: 1 }]),
      mcq([{ text: "Do'sting xato qildi va xijolat bo'lyapti. Sen unga nima deysang?", options: ["'Sen qanday bema'ni'", "'Xato qilish — o'rganishning bir qismi, davom et'", "'Men ham shunday qilardim'", "'Hech kimga aytma'"], correct: 1 }]),
      mcq([{ text: "Yangi mashq qilayotganda xato qilding. Bu nima degani?", options: ["Sen ushbu mashq uchun mos emassan", "Sen o'rganish jarayidasan", "Sen boshqa mashqni tanlashing kerak", "Sen tez-tez xato qilasan"], correct: 1 }]),
      mcq([{ text: "Xato qilingandan keyin qanday munosabat to'g'ri?", options: ["O'zingni qattiq ayblaш", "Xatoni tan olib, keyingi safar yaxshiroq qilishni maqsad qilish", "Hech narsani o'zgartirmaslik", "Boshqalarni ayblash"], correct: 1 }]),
      mcq([{ text: "Nima uchun 'odamlar nima deydi?' degan xavotir zararli?", options: ["Chunki odamlar doim yaxshi gapirishadi", "Chunki bu xavotir seni urinishdan to'xtatadi", "Chunki odamlar e'tibor bermaydi", "Chunki bu normal his"], correct: 1 }]),
      mcq([{ text: "Xato va muvaffaqiyat o'rtasidagi bog'liqlik:", options: ["Ular bir-biriga bog'liq emas", "Ko'p xato — ko'p muvaffaqiyat imkoniyati", "Xato muvaffaqiyatni kamaytiradi", "Muvaffaqiyat xatosiz keladi"], correct: 1 }]),
      mcq([{ text: "O'rganish jarayonida xato soni qanday bo'lishi tabiiy?", options: ["Nol bo'lishi kerak", "Ko'p bo'lishi tabiiy va muhim", "Faqat bir marta bo'lishi kerak", "Har doim kamayishi kerak"], correct: 1 }]),
      mcq([{ text: "Qaysi fikr sog'lom?", options: ["'Men xato qilsam — yomon inson'", "'Har bir xato — yangi dars'", "'Xato qilgan odam ojiz'", "'Xatolarni yashirish kerak'"], correct: 1 }]),
      mcq([{ text: "Kitob yozuvchi yozuvchi xatolarini qanday ko'radi?", options: ["Uyat sifatida", "Yaxshi kitob yozish yo'lidagi qadamlar sifatida", "Qobiliyatsizlik sifatida", "Vaqt isrofgarchiligi sifatida"], correct: 1 }]),
      mcq([{ text: "Hozir xato qilishdan qo'rqmaslikning eng yaxshi usuli:", options: ["Hech narsa qilmaslik", "Kichik, xavfsiz qadam bilan sinab ko'rish", "Katta harakat bilan bir vaqtda hammasini qilish", "Boshqalar qilishini kutish"], correct: 1 }]),
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
      fillBlank("My father's job is ___.", 'teacher', ['teacher', 'doctor', 'driver', 'farmer']),
      fillBlank("My mother's job is ___.", 'nurse', ['nurse', 'teacher', 'doctor', 'cook']),
      fillBlank("My sister is ___.", 'kind', ['kind', 'smart', 'funny', 'happy']),
      fillBlank('I ___ my family.', 'love', ['love', 'like', 'miss', 'help']),
      // ── Translate UZ → EN for each template sentence ────────────────────────
      translate('Mening kichik oilam bor.', 'I have a small family'),
      translate('Oilamda 4 kishi bor.', 'There are 4 people in my family'),
      translate("Otamning kasbi o'qituvchi.", "My father's job is teacher"),
      translate("Onamning kasbi hamshira.", "My mother's job is nurse"),
      translate("Opam mehribon.", 'My sister is kind'),
      translate("Men oilamni yaxshi ko'raman.", 'I love my family'),
      translate('Akamning kasbi haydovchi.', "My brother's job is driver"),
      translate('Mening 2 ta akam bor.', 'I have 2 brothers'),
      // ── Word-order assembly for 4 key lines ─────────────────────────────────
      wordOrder([
        { words: ['family', 'small', 'a', 'have', 'I'], correct: 'I have a small family' },
        { words: ['family', 'my', 'in', 'people', '4', 'are', 'There'], correct: 'There are 4 people in my family' },
        { words: ['teacher', 'is', 'job', "father's", 'My'], correct: "My father's job is teacher" },
        { words: ['family', 'my', 'love', 'I'], correct: 'I love my family' },
      ]),
      // ── Speak individual key sentences ──────────────────────────────────────
      speakSentence('I have a small family', 70),
      speakSentence("My father's job is teacher", 70),
      speakSentence('There are 4 people in my family', 70),
      speakSentence('I love my family', 70),
      // ── Comprehension MCQ about composition structure ────────────────────────
      mcq([
        { text: "Otamning kasbini ifodalashda qaysi tuzilma to'g'ri?", options: ["My father job is teacher", "My father's job is teacher", "teacher is my father job", "My father is teacher job"], correct: 1 },
        { text: '"There are 4 people in my family" — qancha kishilik oila?', options: ['3 kishilik', '4 kishilik', '5 kishilik', '6 kishilik'], correct: 1 },
        { text: '"I love my family" qachon aytiladi?', options: ['Salomlashganda', 'Oilangizga muhabbatingizni bildirganda', 'Ovqat oldida', 'Maktabda'], correct: 1 },
      ]),
      speakWords(
        "Hello! I have a small family. There are 4 people in my family. My father's job is teacher. My mother's job is nurse. My sister is kind. I love my family.",
        70,
      ),
    ],
  },

  // ── STEP 22 — You (sen, siz) ──────────────────────────────────────────────
  {
    orderNumber: 24,
    title: 'STEP 22 — You (sen, siz)',
    type: LessonType.english,
    components: [
      mcq([
        {
          text: "'Sen' yoki 'Siz' subjekti uchun 'to be'ning qaysi shakli ishlatiladi?",
          options: ['am', 'is', 'are', 'be'],
          correct: 2,
        },
      ]),
      ...topicSentenceBlock({ uz: "Sen talabasan", en: 'You are a student', words: ['You', 'are', 'a', 'student'] }),
      ...topicSentenceBlock({ uz: "Sen mening do'stimsan", en: 'You are my friend', words: ['You', 'are', 'my', 'friend'] }),
      ...topicSentenceBlock({ uz: 'Sen chiroylisan', en: 'You are beautiful', words: ['You', 'are', 'beautiful'] }),
      ...topicSentenceBlock({ uz: 'Siz boshqa davlatdansiz', en: 'You are from abroad', words: ['You', 'are', 'from', 'abroad'] }),
      ...phraseBlock('U mening onam', 'She is my mom'),
      ...phraseBlock('Onam mehribon', 'Mom is kind'),
      ...phraseBlock("Onamni yaxshi ko'raman", 'I love mom'),
      matchPairs([
        { left: 'living room', right: 'mehmon xona' },
        { left: 'kitchen', right: 'oshxona' },
        { left: 'garden', right: "bog'" },
        { left: 'Excuse me.', right: 'Kechirasiz' },
        { left: 'Look at me.', right: 'Menga qarang' },
      ]),
    ],
  },

  // ── STEP 23 — Sonlar 1-12 ─────────────────────────────────────────────────
  {
    orderNumber: 25,
    title: 'STEP 23 — Sonlar 1-12',
    type: LessonType.english,
    components: [
      ...vocabBlock({ uz: 'bir', en: 'one', distractors: ['two', 'three', 'four'] }),
      ...vocabBlock({ uz: 'olti', en: 'six', distractors: ['seven', 'eight', 'five'] }),
      ...vocabBlock({ uz: "o'n", en: 'ten', distractors: ['eleven', 'twelve', 'nine'] }),
      ...vocabBlock({ uz: "o'n ikki", en: 'twelve', distractors: ['ten', 'eleven', 'nine'] }),
      ...phraseBlock('U mening otam', 'He is my dad'),
      ...phraseBlock('Dadam band', 'Dad is busy'),
      ...phraseBlock('Dadam uyda', 'Dad is at home'),
      matchPairs([
        { left: 'one', right: 'bir' },
        { left: 'six', right: 'olti' },
        { left: 'ten', right: "o'n" },
        { left: 'twelve', right: "o'n ikki" },
        { left: 'You are a student', right: 'Sen talabasan' },
      ]),
    ],
  },

  // ── STEP 24 — They (ular) ─────────────────────────────────────────────────
  {
    orderNumber: 26,
    title: 'STEP 24 — They (ular)',
    type: LessonType.english,
    components: [
      mcq([
        {
          text: "'Ular' subjekti uchun 'to be'ning qaysi shakli ishlatiladi?",
          options: ['am', 'is', 'are', 'be'],
          correct: 2,
        },
      ]),
      ...topicSentenceBlock({ uz: 'Ular uchuvchilar', en: 'They are pilots', words: ['They', 'are', 'pilots'] }),
      ...topicSentenceBlock({ uz: 'Ular mening sinfdoshlarim', en: 'They are my classmates', words: ['They', 'are', 'my', 'classmates'] }),
      ...topicSentenceBlock({ uz: "Ular o'yinchoqlar", en: 'They are toys', words: ['They', 'are', 'toys'] }),
      ...topicSentenceBlock({ uz: 'Ular boshqa davlatdan', en: 'They are from abroad', words: ['They', 'are', 'from', 'abroad'] }),
      ...phraseBlock('Mening akam bor', 'I have a brother'),
      ...phraseBlock('U mening singlim', 'She is my sister'),
      ...phraseBlock('Biz oilamiz', 'We are a family'),
      matchPairs([
        { left: 'one', right: 'bir' },
        { left: 'six', right: 'olti' },
        { left: 'ten', right: "o'n" },
        { left: 'He is my dad', right: 'U mening otam' },
        { left: 'Dad is busy', right: 'Dadam band' },
      ]),
    ],
  },

  // ── STEP 25 — Vaqtni qadrlash (Personal Dev) ─────────────────────────────
  {
    orderNumber: 27,
    title: 'STEP 25 — Vaqtni qadrlash',
    type: LessonType.personal_development,
    nRepetitions: 1,
    aiTutorEnabled: true,
    aiTutorContext: [
      "Sen Aloqushsan, do'stona o'zbek bola. O'zbek tilida suhbatlash.",
      "",
      "Bola hozir ushbu mavzuni o'qidi: \"Vaqtni qadrlash\"",
      "",
      "Asosiy g'oya: Vaqt — eng qimmat narsa. Uni to'g'ri sarflagan kishi kelajagini quради.",
      "",
      "Boladan 3 ta savol so'ra (ketma-ket, javobiga qarab):",
      "1) \"Bu darsdan nima o'rganding?\"",
      "2) \"Kundalik vaqtingni qanday sarflayapsan?\"",
      "3) \"Bugun qilish mumkin bo'lgan bir foydali ish nima?\"",
      "",
      "Har javobini hurmat qil, kichik maslahat ber. Maksimal 2-3 jumla.",
    ].join('\n'),
    components: [
      mcq([
        {
          text: [
            "📖 SHAXSIY RIVOJLANISH — Vaqtni qadrlash",
            "",
            "Bilasanmi do'stim, dunyodagi eng qimmat narsa nima? Pul emas. Oltin emas. Bu — VAQT!",
            "",
            "Chunki pulni yana topish mumkin. Lekin vaqt ketdimi — qaytmaydi! Har kuni bizga 24 soat beriladi. Lekin kimdir bu vaqtni orzulariga yaqinlashishga sarflaydi, kimdir esa telefon, o'yin, bekorchilikka.",
            "",
            "Haqiqat shuki: hozir nima qilsang — kelajakdagi o'zingni shunga tayyorlayapsan. Bugun o'qisang, ertaga dono bo'lasan. Bugun harakat qilsang, ertaga g'alaba qilasan.",
            "",
            "O'zingga bir savol ber: \"Men vaqtdan foydalanayapmanmi yoki uni yo'qotyapmanmi?\"",
            "",
            "Har kuni bir kichik foydali narsa qil: kitob o'qi, til o'rgan, qariyalarga yaxshilik qil, ota-onanga yordam ber...",
            "",
            "Chunki o'tayotgan vaqt — bu sening kelajaging!",
            "",
            "👨‍👩‍👧 Oila a'zolaringizga shu mavzuda treyning o'tib bering va ko'proq oynaga qarab mashq qiling!",
            "",
            "❓ Bo'sh vaqtingda nima qilish eng yaxshisi?",
          ].join('\n'),
          options: [
            "Telefonda 4 soat o'tirish",
            "Bir kichik foydali narsa qilish — kitob, til, ko'maklash",
            "Eshikda hech nima qilmasdan turish",
          ],
          correct: 1,
        },
      ]),
      mcq([{ text: "Dunyodagi eng qimmat narsa nima?", options: ["Pul", "Oltin", "Vaqt", "Mashina"], correct: 2 }]),
      mcq([{ text: "Nima uchun vaqt puldan ham qimmatroq?", options: ["Pul ham qaytmaydi", "Vaqt ketsa qaytmaydi, pul esa topish mumkin", "Pul ko'proq ish qiladi", "Vaqt hamma uchun teng emas"], correct: 1 }]),
      mcq([{ text: "Har kuni bizga qancha vaqt beriladi?", options: ["12 soat", "16 soat", "24 soat", "8 soat"], correct: 2 }]),
      mcq([{ text: "Hozir o'qisang, ertaga nima bo'lasan?", options: ["Charchagan", "Dono", "Boyigan", "Hech narsa o'zgarmaydi"], correct: 1 }]),
      mcq([{ text: "Vaqtni yo'qotish nima degani?", options: ["Ko'p dam olish", "Kelajagingni yo'qotish", "Boshqalarga yordam berish", "Qiziqarli narsalar qilish"], correct: 1 }]),
      mcq([{ text: "Vaqtning eng katta o'g'risi qaysi?", options: ["Kitob o'qish", "Maqsadsiz telefon va o'yin", "Sport qilish", "Oilaga yordam berish"], correct: 1 }]),
      mcq([{ text: "Bir kunlik foydali kichik harakat nima beradi?", options: ["Faqat charchoq", "Hech narsa", "Doimiy o'sish va kelajak uchun investitsiya", "Faqat maqtov"], correct: 2 }]),
      mcq([{ text: "Telefondan oldin o'zingga qanday savol berish kerak?", options: ["'Do'stlarim nima deydi?'", "'Bu vaqtni qaytara olamanmi?'", "'Yangi video bormi?'", "'Hamma qilyaptimi?'"], correct: 1 }]),
      mcq([{ text: "Ertaga imtihon bor. Hozir nima qilish kerak?", options: ["O'yin o'ynamoq", "Biror seriyal tomosha qilmoq", "Tayyorlanmoq — vaqtdan unumli foydalanmoq", "Uxlab qolmoq"], correct: 2 }]),
      mcq([{ text: "Dadang uy ishlarini qilyapti. Vaqtingni qanday sarflash to'g'ri?", options: ["Telefonda o'tirmoq", "Unga yordam bermoq", "O'ynashni davom ettirmoq", "Ko'cha ketmoq"], correct: 1 }]),
      mcq([{ text: "O'tib ketgan vaqtdan nima qoladi?", options: ["Xotira va natija", "Hech narsa, u qaytmaydi", "Faqat afsus", "Yana bir imkoniyat"], correct: 1 }]),
      mcq([{ text: "Kelajakdagi o'zingni hozir qanday yaratasiz?", options: ["Hech narsa qilmasdan", "Tasodif bilan", "Bugungi tanlov va harakatlar bilan", "Boshqalarni kuzatib"], correct: 2 }]),
      mcq([{ text: "Vaqtni qadrlaydigan odam har kechasi nima qiladi?", options: ["Hech nima rejalashtirmaydi", "Ertangi kun uchun reja tuzib yotadi", "Faqat o'yin o'ynaydi", "Ijtimoiy tarmoqda vaqt o'tkazadi"], correct: 1 }]),
      mcq([{ text: "Bir bolaning bo'sh soati bor. U til o'rganishni tanladi. Bu nima?", options: ["Vaqtni behuda sarflash", "Vaqtdan to'g'ri foydalanish", "Majburiy ish", "Zerikish"], correct: 1 }]),
      mcq([{ text: "Qariyalarga yaxshilik qilish vaqtni qanday sarflash?", options: ["Behuda sarflash", "Eng yaxshi sarflash", "Keraksiz sarflash", "Zarar sarflash"], correct: 1 }]),
      mcq([{ text: "Vaqt qadrini bilmaslik nimani anglatadi?", options: ["O'zingning kelajagingga befarq qarash", "Ko'p dam olishni sevish", "Quvnoq bo'lishni xohlash", "Boshqalardan yordam kutish"], correct: 0 }]),
      mcq([{ text: "'Vaqt — eng qimmat sarmoya' degani nima?", options: ["Vaqtni sotsa bo'ladi", "Vaqtga qanday sarf qilsang, kelajagingni shunday qurasiz", "Vaqt pul bilan o'lchanadi", "Vaqtni bank karta bilan saqlash mumkin"], correct: 1 }]),
      mcq([{ text: "Hozir bitta foydali narsa o'rganish ertaga nima beradi?", options: ["Hech narsa", "Charchoq", "Yangi bilim va ko'nikma", "Faqat maqtov"], correct: 2 }]),
      mcq([{ text: "\"Men vaqtdan foydalanayapmanmi?\" degan savol nima uchun muhim?", options: ["Muhim emas", "O'zingni tekshirib, yo'nalishni to'g'rilash uchun", "Boshqalarga ko'rsatish uchun", "Faqat kattalar uchun"], correct: 1 }]),
    ],
  },

  // ── STEP 26 — Sonlar 13-90 (o'nliklar) ───────────────────────────────────
  {
    orderNumber: 28,
    title: "STEP 26 — Sonlar 13-90 (o'nliklar)",
    type: LessonType.english,
    components: [
      ...vocabBlock({ uz: "o'n uch", en: 'thirteen', distractors: ['fourteen', 'fifteen', 'sixteen'] }),
      ...vocabBlock({ uz: 'yigirma', en: 'twenty', distractors: ['thirty', 'forty', 'fifty'] }),
      ...vocabBlock({ uz: "ellik", en: 'fifty', distractors: ['forty', 'sixty', 'seventy'] }),
      ...vocabBlock({ uz: 'to\'qson', en: 'ninety', distractors: ['eighty', 'seventy', 'sixty'] }),
      ...phraseBlock('Men ochman', 'I am hungry'),
      ...phraseBlock('Ovqat xohlayman', 'I want food'),
      ...phraseBlock('Biroz non yeng', 'Eat some bread'),
      matchPairs([
        { left: 'thirteen', right: "o'n uch" },
        { left: 'twenty', right: 'yigirma' },
        { left: 'fifty', right: 'ellik' },
        { left: 'ninety', right: "to'qson" },
        { left: 'They are pilots', right: 'Ular uchuvchilar' },
      ]),
    ],
  },

  // ── STEP 27 — to be: am ───────────────────────────────────────────────────
  {
    orderNumber: 29,
    title: 'STEP 27 — to be: am',
    type: LessonType.english,
    components: [
      mcq([
        {
          text: "Faqat 'I' subjekti bilan ishlatiladigan 'to be' shakli qaysi?",
          options: ['is', 'are', 'am', 'be'],
          correct: 2,
        },
      ]),
      ...topicSentenceBlock({ uz: "Men uzun bo'yliman", en: 'I am tall', words: ['I', 'am', 'tall'] }),
      ...topicSentenceBlock({ uz: 'Men 11 yoshdaman', en: 'I am 11 years old', words: ['I', 'am', '11', 'years', 'old'] }),
      ...topicSentenceBlock({ uz: 'Men shahardanman', en: 'I am from a city', words: ['I', 'am', 'from', 'a', 'city'] }),
      ...topicSentenceBlock({ uz: 'Men yoshman', en: 'I am young', words: ['I', 'am', 'young'] }),
      ...phraseBlock('Men chanqadim', 'I am thirsty'),
      ...phraseBlock('Suv, iltimos', 'Water, please'),
      ...phraseBlock('Biroz suv iching', 'Drink some water'),
      matchPairs([
        { left: 'thirteen', right: "o'n uch" },
        { left: 'twenty', right: 'yigirma' },
        { left: 'I am hungry', right: 'Men ochman' },
        { left: 'I want food', right: 'Ovqat xohlayman' },
        { left: 'Eat some bread', right: 'Biroz non yeng' },
      ]),
    ],
  },

  // ── STEP 28 — Sonlar 21-50 ────────────────────────────────────────────────
  {
    orderNumber: 30,
    title: 'STEP 28 — Sonlar 21-50',
    type: LessonType.english,
    components: [
      ...vocabBlock({ uz: 'yigirma bir', en: 'twenty-one', distractors: ['twenty-five', 'thirty', 'forty'] }),
      ...vocabBlock({ uz: 'o\'ttiz', en: 'thirty', distractors: ['twenty', 'forty', 'fifty'] }),
      ...vocabBlock({ uz: 'qirq', en: 'forty', distractors: ['thirty', 'fifty', 'twenty'] }),
      ...vocabBlock({ uz: 'ellik', en: 'fifty', distractors: ['forty', 'thirty', 'sixty'] }),
      ...phraseBlock('Menga bu yoqadi', 'I like it'),
      ...phraseBlock('Men choyni yoqtiraman', 'I like tea'),
      ...phraseBlock('Sizga bu yoqadimi?', 'Do you like it?'),
      matchPairs([
        { left: 'twenty-one', right: 'yigirma bir' },
        { left: 'thirty', right: "o'ttiz" },
        { left: 'forty', right: 'qirq' },
        { left: 'fifty', right: 'ellik' },
        { left: 'I am tall', right: "Men uzun bo'yliman" },
      ]),
    ],
  },

  // ── STEP 29 — to be: is ───────────────────────────────────────────────────
  {
    orderNumber: 31,
    title: 'STEP 29 — to be: is',
    type: LessonType.english,
    components: [
      mcq([
        {
          text: "He, she, it subjektlari uchun 'to be'ning qaysi shakli ishlatiladi?",
          options: ['am', 'are', 'be', 'is'],
          correct: 3,
        },
      ]),
      ...topicSentenceBlock({ uz: 'U odobli', en: 'He is polite', words: ['He', 'is', 'polite'] }),
      ...topicSentenceBlock({ uz: 'U 22 yoshda', en: 'She is 22 years old', words: ['She', 'is', '22', 'years', 'old'] }),
      ...topicSentenceBlock({ uz: 'U it', en: 'It is a dog', words: ['It', 'is', 'a', 'dog'] }),
      ...topicSentenceBlock({ uz: 'U doktor', en: 'She is a doctor', words: ['She', 'is', 'a', 'doctor'] }),
      ...phraseBlock('Menga bu yoqmaydi', 'I do not like it'),
      ...phraseBlock("Men buni yomon ko'raman", 'I hate this'),
      ...phraseBlock("Yo'q, rahmat", 'No, thank you'),
      matchPairs([
        { left: 'twenty-one', right: 'yigirma bir' },
        { left: 'forty', right: 'qirq' },
        { left: 'I like it', right: 'Menga bu yoqadi' },
        { left: 'I like tea', right: 'Men choyni yoqtiraman' },
        { left: 'Do you like it?', right: 'Sizga bu yoqadimi?' },
      ]),
    ],
  },

  // ── STEP 30 — Katta orzu (Personal Dev) ──────────────────────────────────
  {
    orderNumber: 32,
    title: 'STEP 30 — Katta orzu',
    type: LessonType.personal_development,
    nRepetitions: 1,
    aiTutorEnabled: true,
    aiTutorContext: [
      "Sen Aloqushsan, do'stona o'zbek bola. O'zbek tilida suhbatlash.",
      "",
      "Bola hozir ushbu mavzuni o'qidi: \"Katta orzu qilishdan uyalmang\"",
      "",
      "Asosiy g'oya: Katta orzular — buyuk odamlar uchun. Hech qachon o'zingni kamsitma, orzungga ishon va harakat qil.",
      "",
      "Boladan 3 ta savol so'ra (ketma-ket, javobiga qarab):",
      "1) \"Bu darsdan nima o'rganding?\"",
      "2) \"Sening katta orzung nima?\"",
      "3) \"O'sha orzuga erishish uchun bugun nima qilish mumkin?\"",
      "",
      "Har javobini hurmat qil, kichik maslahat ber. Maksimal 2-3 jumla.",
    ].join('\n'),
    components: [
      mcq([
        {
          text: [
            "📖 SHAXSIY RIVOJLANISH — Katta orzu qilishdan uyalmang",
            "",
            "Do'stlar, ba'zida orzu qilganimizda boshqalar kuladi: \"Voy, sen shunaqa qila olasanmi?\", \"Bu juda katta orzu!\", \"Yerga tushing\" — deyishadi.",
            "",
            "Lekin bilasizmi? Hamma katta ishlar — katta orzudan boshlanadi! Astronavtlar, olimlar, sportchilar — hammasi avval orzu qilgan. Ular uyalmagan. Ishongan. Harakat qilgan.",
            "",
            "Agar sening ichingda katta orzu bo'lsa — bu seni ichkaridan chaqirayotgan ovoz! Unga quloq sol!",
            "",
            "Hech qachon \"Men kimman o'zi?\" deb o'zingni kamsitma. Aksincha: \"Nega men qila olmas ekanman?\" deb o'zingni ilhomlantir!",
            "",
            "Katta orzular — Buyuk odamlar uchun. Sen ham shulardan bo'lishing mumkin. Faqat ishon, orzu qil va harakat qil!",
            "",
            "👨‍👩‍👧 Oila a'zolaringizga shu mavzuda treyning o'tib bering va ko'proq oynaga qarab mashq qiling!",
            "",
            "❓ Sening katta orzung bor — masalan, mashhur olim bo'lish. Boshqalar kuladi. Sen nima qilasan?",
          ].join('\n'),
          options: [
            "Orzudan voz kechaman",
            "Boshqalarga quloq solmasdan o'z orzumga ishonib harakat qilaman",
            "Boshqalarga quloq solib, kichikroq orzu qilaman",
          ],
          correct: 1,
        },
      ]),
      mcq([{ text: "Hamma katta ishlar nimadan boshlanadi?", options: ["Tasodifdan", "Katta orzudan", "Pul yig'ishdan", "Boshqalardan ko'chirib"], correct: 1 }]),
      mcq([{ text: "Boshqalar orzungga kulayotganda nima qilish kerak?", options: ["Orzudan voz kechish", "Ishonib harakat qilishni davom ettirish", "Kichikroq orzu qilish", "Ularga rozi bo'lish"], correct: 1 }]),
      mcq([{ text: "\"Men kimman o'zi?\" degan fikr qachon paydo bo'ladi?", options: ["O'z qiymatini his qilganda", "O'zini kamsitganda va ishonchni yo'qotganda", "G'alaba qilganda", "Ko'p o'qiganda"], correct: 1 }]),
      mcq([{ text: "Astronavtlar, olimlar, sportchilar katta bo'lishdan oldin nima qilishgan?", options: ["Hech narsa orzu qilmagan", "Kichik orzular bilan cheklangan", "Avval orzu qilgan, ishongan va harakat qilgan", "Boshqalarning yordamini kutgan"], correct: 2 }]),
      mcq([{ text: "\"Nega men qila olmas ekanman?\" degan savol nima beradi?", options: ["Umidsizlik", "Ilhom va harakatga undash", "Qo'rquv", "Befarqlik"], correct: 1 }]),
      mcq([{ text: "Ichingdagi katta orzu — bu nima?", options: ["Faqat tush", "Seni ichkaridan chaqirayotgan ovoz", "Xayol va fantaziya", "Boshqalarning ta'siri"], correct: 1 }]),
      mcq([{ text: "Katta orzular kim uchun?", options: ["Faqat boy odamlar uchun", "Faqat kattalar uchun", "Buyuk odamlar uchun — va sen ham shulardan bo'lishing mumkin", "Faqat ustozlar uchun"], correct: 2 }]),
      mcq([{ text: "Orzu qilishdan uyalish nima olib keladi?", options: ["Tinchlik", "Katta muvaffaqiyat", "O'z imkoniyatlarini cheklash", "Ko'proq do'st topish"], correct: 2 }]),
      mcq([{ text: "Sinfdoshlaring orzungni eshitib kulishdi. Sen nima qilasan?", options: ["Orzuingni yashirasan", "Uyalib sukut saqlayman", "Orzuimga ishonib, harakatni davom ettiraman", "Ularga o'xshab kichik orzu qilaman"], correct: 2 }]),
      mcq([{ text: "\"Bu juda katta orzu!\" degan gapdagi xato nima?", options: ["Hech narsa xato emas", "Katta orzular mumkin emasligini taxmin qilish", "Orzu haqida gapirishning o'zi xato", "Savol berish xato"], correct: 1 }]),
      mcq([{ text: "Orzuga erishish uchun birinchi qadam nima?", options: ["Boshqalarning roziligini olish", "O'z orzungga ishonish", "Pul yig'ish", "Imtihon topshirish"], correct: 1 }]),
      mcq([{ text: "Ikki bola: biri katta orzu qiladi va harakat qiladi, biri orzu qilmaydi. Kim ko'proq erishadi?", options: ["Orzu qilmaydigan, chunki realroq", "Ikkalasi teng", "Katta orzu qilib harakat qilgan", "Tasodif hal qiladi"], correct: 2 }]),
      mcq([{ text: "Orzungni yashirish nima uchun zararli?", options: ["Zararli emas", "U o'smaydi va yonmaydi, harakatga undamaydi", "Boshqalar bilmasa yaxshi", "Yashirish quvvat beradi"], correct: 1 }]),
      mcq([{ text: "Katta orzuning dushmanlaridan biri:", options: ["Harakat", "Ishonch", "O'zni kamsitish", "Sabr"], correct: 2 }]),
      mcq([{ text: "\"Ishon, orzu qil va harakat qil\" iborasida eng muhim so'z qaysi?", options: ["Ishon", "Orzu", "Harakat", "Uchala ham teng muhim"], correct: 3 }]),
      mcq([{ text: "Orzusidan uyalmagan odamning kelajagi qanday?", options: ["Hech qanday", "Boshqalar kabi oddiy", "Orzusiga mos katta kelajak", "Har doim og'ir"], correct: 2 }]),
      mcq([{ text: "Mashhur olim bo'lish orzusi seningcha:", options: ["Juda katta va mumkin emas", "Faqat aqllilarga mos", "Ishlagan va harakat qilgan har kimga mumkin", "Faqat boy oilalarga mos"], correct: 2 }]),
      mcq([{ text: "Orzungga intilayotganda qiyinchilik bo'lsa nima qilish kerak?", options: ["Orzudan voz kechish", "Qiyinchilikni bahona deb bilmaslik va davom etish", "Boshqalarni ayblab o'tirish", "Vaqt kutish"], correct: 1 }]),
      mcq([{ text: "\"Hamma katta ishlar katta orzudan boshlanadi\" — bu gapdan qanday xulosa chiqarish mumkin?", options: ["Orzular befoyda", "Sening ham katta orzuing — katta kelajagingning boshlanishi", "Faqat taniqli odamlar orzu qila oladi", "Orzular faqat tushda bo'ladi"], correct: 1 }]),
    ],
  },

  // ── STEP 31 — My best friend (Composition — Archetype D) ─────────────────
  {
    orderNumber: 33,
    title: 'STEP 31 — My best friend',
    type: LessonType.english,
    aiTutorEnabled: true,
    aiTutorContext: [
      "You are a friendly English coach for a young Uzbek learner.",
      "The student just composed a 'My best friend' paragraph.",
      "Ask 3 short follow-up questions in English to extend the topic.",
      "Be encouraging. Keep responses to 1-2 sentences.",
      "English only — they are practising English.",
    ].join('\n'),
    components: [
      fillBlank("My best friend's character is ___.", 'kind', ['kind', 'smart', 'funny', 'brave']),
      fillBlank('He is from ___.', 'my city', ['my city', 'my town', 'another city', 'abroad']),
      fillBlank('He is a ___ boy.', 'good', ['good', 'kind', 'smart', 'funny']),
      fillBlank('We take care of each ___.', 'other', ['other', 'one', 'time']),
      fillBlank('I ___ my friend.', 'trust', ['trust', 'love', 'help', 'know']),
      fillBlank('I am ___ to have him.', 'happy', ['happy', 'glad', 'lucky', 'proud']),
      // ── Translate UZ → EN for each template sentence ────────────────────────
      translate("Eng yaqin do'stim yaxshi bola.", "My best friend is a good boy"),
      translate("U shahardан.", 'He is from my city'),
      translate("U yaxshi bola.", 'He is a good boy'),
      translate("Biz bir-birimizga g'amxo'rlik qilamiz.", 'We take care of each other'),
      translate("Men do'stimga ishonaman.", 'I trust my friend'),
      translate("U borligidan xursandman.", 'I am happy to have him'),
      translate("U mening eng yaxshi do'stim.", 'He is my best friend'),
      translate("U juda aqlli bola.", 'He is a very smart boy'),
      // ── Word-order assembly for 4 key lines ─────────────────────────────────
      wordOrder([
        { words: ['good', 'is', 'friend', 'best', 'My'], correct: 'My best friend is good' },
        { words: ['city', 'my', 'from', 'is', 'He'], correct: 'He is from my city' },
        { words: ['boy', 'good', 'a', 'is', 'He'], correct: 'He is a good boy' },
        { words: ['friend', 'my', 'trust', 'I'], correct: 'I trust my friend' },
      ]),
      // ── Speak individual key sentences ──────────────────────────────────────
      speakSentence("My best friend is a good boy", 70),
      speakSentence('He is a good boy', 70),
      speakSentence('He is from my city', 70),
      speakSentence('I trust my friend', 70),
      // ── Comprehension MCQ about composition structure ────────────────────────
      mcq([
        { text: '"My best friend is ..." — bu kim haqida?', options: ["O'zim", "Eng yaqin do'stim", 'Otam', 'Ustozim'], correct: 1 },
        { text: "Yaxshi do'stga \"good boy\" deyish nimani anglatadi?", options: ['Yomon bola', 'Yaxshi bola', 'Katta bola', 'Kichik bola'], correct: 1 },
        { text: '"We take care of each other" — kimga g\'amxo\'rlik?', options: ["Faqat o'zimga", 'Bir-birimizga', 'Hech kimga', 'Ota-onaga'], correct: 1 },
        { text: "Inglizchada do'st haqida gapirish qachon yaxshi?", options: ['Hech qachon', 'Tanish-bilishlar bilan suhbatlashganda', 'Faqat darsda', 'Faqat darsdan keyin'], correct: 1 },
      ]),
      speakWords(
        "I want to talk about my best friend. My best friend is a good boy. He is from my city. He is kind and smart. We take care of each other. I trust my friend. I am happy to have him.",
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
        { words: ['here', 'from', 'I', 'am'], correct: 'I am from here' },
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
        "Hello! I am a student. I am 10 years old. I am from here. I am a pupil at school.",
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
        { words: ['abroad', 'from', 'is', 'He'], correct: 'He is from abroad' },
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
        { words: ['abroad', 'from', 'are', 'We'], correct: 'We are from abroad' },
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
        "Hello! I have a small family. There are 4 people in my family. My father's job is teacher. My mother's job is nurse. I love my family.",
        70,
      ),
    ],
  },

  // ── STEP 32 — Sonlar 51-69 ────────────────────────────────────────────────
  {
    orderNumber: 35,
    title: 'STEP 32 — Sonlar 51-69',
    type: LessonType.english,
    components: [
      ...vocabBlock({ uz: 'ellik bir', en: 'fifty-one', distractors: ['fifty-five', 'sixty', 'sixty-nine'] }),
      ...vocabBlock({ uz: 'ellik besh', en: 'fifty-five', distractors: ['fifty-one', 'sixty', 'sixty-nine'] }),
      ...vocabBlock({ uz: 'oltmish', en: 'sixty', distractors: ['fifty-one', 'fifty-five', 'sixty-nine'] }),
      ...vocabBlock({ uz: 'oltmish to\'qqiz', en: 'sixty-nine', distractors: ['fifty-one', 'sixty', 'fifty-five'] }),
      ...phraseBlock('Boshim og\'riyapti', 'My head hurts.'),
      ...phraseBlock("O'zimni yomon his qilyapman", 'I feel bad.'),
      ...phraseBlock('Men kasalman', 'I am sick.'),
      matchPairs([
        { left: 'fifty-one', right: 'ellik bir' },
        { left: 'fifty-three', right: 'ellik uch' },
        { left: 'fifty-seven', right: 'ellik yetti' },
        { left: 'sixty-one', right: 'oltmish bir' },
        { left: 'sixty-five', right: 'oltmish besh' },
        { left: 'sixty-nine', right: 'oltmish to\'qqiz' },
      ]),
    ],
  },

  // ── STEP 33 — to be: are ─────────────────────────────────────────────────
  {
    orderNumber: 36,
    title: 'STEP 33 — to be: are',
    type: LessonType.english,
    components: [
      mcq([
        {
          text: "Ko'plik subjektlar ('we', 'you', 'they') uchun 'to be'ning qaysi shakli ishlatiladi?",
          options: ['am', 'is', 'are', 'be'],
          correct: 2,
        },
      ]),
      ...topicSentenceBlock({ uz: 'Biz doktorlarmiz', en: 'We are doctors', words: ['We', 'are', 'doctors'] }),
      ...topicSentenceBlock({ uz: 'Sizlar mashhursizlar', en: 'You are famous', words: ['You', 'are', 'famous'] }),
      ...topicSentenceBlock({ uz: "Ular mening eng yaxshi do'stlarim", en: 'They are my best friends', words: ['They', 'are', 'my', 'best', 'friends'] }),
      ...topicSentenceBlock({ uz: "Siz O'zbeksiz", en: 'You are Uzbek', words: ['You', 'are', 'Uzbek'] }),
      ...phraseBlock("Qornim to'ydi", 'I am full'),
      ...phraseBlock("Doktorga qo'ng'iroq qiling", 'Call a doctor.'),
      ...phraseBlock('Tezroq sog\'ayib keting', 'Get well soon.'),
      matchPairs([
        { left: 'We are doctors', right: 'Biz doktorlarmiz' },
        { left: 'You are famous', right: 'Sizlar mashhursizlar' },
        { left: 'You are Uzbek', right: "Siz O'zbeksiz" },
        { left: 'My head hurts.', right: "Boshim og'riyapti" },
        { left: 'I am sick.', right: 'Men kasalman' },
      ]),
    ],
  },

  // ── STEP 34 — Sonlar 71-100 ───────────────────────────────────────────────
  {
    orderNumber: 37,
    title: 'STEP 34 — Sonlar 71-100',
    type: LessonType.english,
    components: [
      ...vocabBlock({ uz: 'yetmish bir', en: 'seventy-one', distractors: ['eighty', 'ninety-nine', 'hundred'] }),
      ...vocabBlock({ uz: 'sakson', en: 'eighty', distractors: ['seventy-one', 'ninety-nine', 'hundred'] }),
      ...vocabBlock({ uz: 'to\'qson to\'qqiz', en: 'ninety-nine', distractors: ['seventy-one', 'eighty', 'hundred'] }),
      ...vocabBlock({ uz: 'yuz', en: 'hundred', distractors: ['seventy-one', 'eighty', 'ninety-nine'] }),
      ...phraseBlock('Buni hozir qil', 'Do it now.'),
      ...phraseBlock('Hozir bandman', 'I am busy now.'),
      ...phraseBlock('Darsni boshlang', 'Start the lesson.'),
      matchPairs([
        { left: 'seventy-one', right: 'yetmish bir' },
        { left: 'seventy-five', right: 'yetmish besh' },
        { left: 'eighty', right: 'sakson' },
        { left: 'eighty-two', right: 'sakson ikki' },
        { left: 'ninety-nine', right: "to'qson to'qqiz" },
        { left: 'hundred', right: 'yuz' },
      ]),
    ],
  },

  // ── STEP 35 — Do'st tanlash (Personal Dev) ───────────────────────────────
  {
    orderNumber: 38,
    title: "STEP 35 — Do'st tanlash",
    type: LessonType.personal_development,
    nRepetitions: 1,
    aiTutorEnabled: true,
    aiTutorContext: [
      "Sen Aloqushsan, do'stona o'zbek bola. O'zbek tilida suhbatlash.",
      "",
      "Bola hozir ushbu mavzuni o'qidi: \"Do'st tanlash qoidalari\"",
      "",
      "Asosiy g'oya: Kim bilan vaqt o'tkazsang, shu odamga o'xshab qolasan. Yaxshi do'st seni yuqoriga ko'taradi, yomon do'st — pastga tortadi.",
      "",
      "Boladan 3 ta savol so'ra (ketma-ket, javobiga qarab):",
      "1) \"Bu darsdan nima o'rganding?\"",
      "2) \"Sening eng yaqin do'sting seni ilhomlantiradimi?\"",
      "3) \"Do'st tanlashda uchta qoidadan qaysi biri senga eng muhim?\"",
      "",
      "Har javobini hurmat qil, kichik maslahat ber. Maksimal 2-3 jumla.",
    ].join('\n'),
    components: [
      mcq([
        {
          text: [
            "📖 SHAXSIY RIVOJLANISH — Do'st tanlash qoidalari",
            "",
            "Do'stlar, bilasizmi, kim bilan ko'p vaqt o'tkazsangiz — siz ham asta-sekin o'shanga o'xshab qolasiz. Shuning uchun do'st tanlash — bu hayotingizni tanlash degani.",
            "",
            "Yaxshi do'st nima qiladi? U sizni ortga tortmaydi, aksincha — ko'taradi. Siz xato qilsangiz — kulmaydi, yaxshi yo'l ko'rsatadi. Orzuingizga ishonadi, siz bilan birga harakat qiladi.",
            "",
            "Agar do'stingiz faqat g'iybat qilsa, urishsa, yomon so'zlar aytsa — u seni o'zgartiryapti. Yomon tomonga!",
            "",
            "Shuning uchun do'st tanlashda 3 ta qoidani esda saqla:",
            "- U seni ilhomlantiradimi?",
            "- U seni dangasalikka emas, harakatga undaydimi?",
            "- U borligida o'zingni yaxshi his qilasanmi?",
            "",
            "Agar javob \"ha\" bo'lsa — u chin do'st!",
            "Esda tut: do'stlik son bilan emas — sifat bilan o'lchanadi!",
            "",
            "👨‍👩‍👧 Oila a'zolaringizga shu mavzuda treyning o'tib bering va ko'proq oynaga qarab mashq qiling!",
            "",
            "❓ Yaxshi do'stning belgisi qaysi?",
          ].join('\n'),
          options: [
            "Doim sening barcha gaplaringga rozi bo'ladi",
            "Sening yutuqlaringga ishonadi va harakatga undaydi",
            "Hech qachon senga muammo aytmaydi",
          ],
          correct: 1,
        },
      ]),
      mcq([{ text: "Do'st tanlash — bu nima tanlash?", options: ["Faqat o'yin sherigini", "Hayotingni tanlash", "Faqat sinfdoshni", "Hech narsa"], correct: 1 }]),
      mcq([{ text: "Kim bilan ko'p vaqt o'tkazsang, nima bo'lasan?", options: ["Hech narsa o'zgarmaydi", "O'shanga o'xshab qolasan", "Aksincha bo'lasan", "Kuchliroq bo'lasan"], correct: 1 }]),
      mcq([{ text: "Yaxshi do'st xato qilsang nima qiladi?", options: ["Kuladi", "G'iybat tarqatadi", "Yaxshi yo'l ko'rsatadi", "Seni tark etadi"], correct: 2 }]),
      mcq([{ text: "Do'stlik son bilan emas, nima bilan o'lchanadi?", options: ["Pul bilan", "Sifat bilan", "Vaqt bilan", "Yoshga qarab"], correct: 1 }]),
      mcq([{ text: "Do'stingiz faqat g'iybat qilsa va yomon so'zlar aytsa, bu nima degani?", options: ["U seni yaxshi ko'radi", "U seni yomon tomonga o'zgartiryapti", "U hazil qilyapti", "U seni sinayapti"], correct: 1 }]),
      mcq([{ text: "Do'st tanlashning birinchi qoidasi:", options: ["U seni ilhomlantiradimi?", "U boy'mi?", "U mashhurmi?", "U yaqin yashaydimi?"], correct: 0 }]),
      mcq([{ text: "Yaxshi do'st seni qaysi tomonga yo'naltiradi?", options: ["Dangasalikka", "Harakatga va yuqoriga", "Bekorchilikka", "Boshqalarni kamsitishga"], correct: 1 }]),
      mcq([{ text: "Do'st tanlashning uchinchi qoidasi: U borligida o'zingni qanday his qilasan?", options: ["Yomon va kichik", "Yaxshi va qimmatli", "Befarq", "Charchagan"], correct: 1 }]),
      mcq([{ text: "Chin do'stning belgisi:", options: ["Har doim sening bilan rozi bo'lishi", "Seni ilhomlantirib, harakatga undashi", "Hech qachon tanqid qilmasligi", "Ko'p pul sarflashi"], correct: 1 }]),
      mcq([{ text: "Sinfdoshing har doim senga dangasalikka undaydi. Bu do'stlik haqida nima deydi?", options: ["Bu yaxshi do'stlik", "Bunday do'stlik seni pastga tortadi", "Bu normal holat", "Bu yordam berish demak"], correct: 1 }]),
      mcq([{ text: "5 yaxshi do'st yoki 50 yomon do'st — qaysi yaxshiroq?", options: ["50 yomon — ko'p do'st yaxshi", "5 yaxshi — sifatli do'stlik qimmatroq", "Ikkalasi teng", "Umuman do'st kerak emas"], correct: 1 }]),
      mcq([{ text: "Do'stingiz orzuingga ishonganda o'zingni qanday his qilasiz?", options: ["Ahamiyatsiz", "Kuchliroq va ilhomlangansiz", "Uyalgansiz", "Xavotirda"], correct: 1 }]),
      mcq([{ text: "Yaxshi do'st va yomon do'stning asosiy farqi:", options: ["Boy yoki kambag'allik", "Ko'tarish yoki pastga tortish", "Yoshi va o'sishi", "Maktab yoki mahallasi"], correct: 1 }]),
      mcq([{ text: "Yangi sinfdosh g'iybat qilishga chaqirdi. Nima qilasiz?", options: ["Qo'shilaman, chunki u do'stim", "Rad etaman — bu yomon do'stlikning belgisi", "Indamay ketaman", "Ustozga aytaman"], correct: 1 }]),
      mcq([{ text: "Do'st tanlash nima uchun hayotiy qaror?", options: ["Chunki do'stlar pul beradi", "Chunki atrofing seni shakllantiradi", "Chunki do'stsiz bo'lmaydi", "Chunki maktab talab qiladi"], correct: 1 }]),
      mcq([{ text: "Do'stingiz yaxshi kitob tavsiya qildi. Bu qaysi qoidaga mos?", options: ["U seni ilhomlantiradimi — ha!", "U dangasalikka undaydimi", "U borligida yomon his qilasanmi", "Hech qaysi qoidaga mos emas"], correct: 0 }]),
      mcq([{ text: "Eng yaxshi do'stlik — bu:", options: ["Ko'p vaqt birga o'ynash", "Bir-birini ko'tariladigan, ilhomlantiradigan munosabat", "Doim rozi bo'lish", "Pul bo'lishdagi sheriklik"], correct: 1 }]),
      mcq([{ text: "Agar do'sting seni harakatga undasa, bu darsdan o'rganilgan qaysi g'oyaga mos?", options: ["Do'stlik soni muhim", "Yaxshi do'st seni yuqoriga ko'taradi", "Do'st tanlash — faqat o'ynoqchilik", "Do'stlar hech qachon tanqid qilmaydi"], correct: 1 }]),
      mcq([{ text: "Do'stlik sifatini qanday tekshirish mumkin?", options: ["Do'stingiz qancha pul sarflashini ko'rish", "Do'st bilan bo'lganda yaxshiroq odamga aylanayotganimni sezish", "Do'stingiz mashhurligini tekshirish", "Uni maktabda qancha tanishligini bilish"], correct: 1 }]),
    ],
  },

  // ── STEP 36 — to be: am/is (2-dars) ─────────────────────────────────────
  {
    orderNumber: 39,
    title: 'STEP 36 — to be: am/is (2-dars)',
    type: LessonType.english,
    components: [
      mcq([
        {
          text: "Sing. subj. ('I' uchun 'am', 'he/she/it' uchun 'is') — to'g'ri shakl qaysi? 'She ___ a tailor'",
          options: ['am', 'are', 'is', 'be'],
          correct: 2,
        },
      ]),
      ...topicSentenceBlock({ uz: 'Men rassomman', en: 'I am an artist', words: ['I', 'am', 'an', 'artist'] }),
      ...topicSentenceBlock({ uz: 'Men 12 yoshdaman', en: 'I am twelve', words: ['I', 'am', 'twelve'] }),
      ...topicSentenceBlock({ uz: 'U sotuvchi', en: 'She is a seller', words: ['She', 'is', 'a', 'seller'] }),
      ...topicSentenceBlock({ uz: 'U mening sigirim', en: 'It is my cow', words: ['It', 'is', 'my', 'cow'] }),
      ...phraseBlock('Hozir emas', 'Not now.'),
      ...phraseBlock('Keyinroq qil', 'Do it later.'),
      ...phraseBlock("Keyinroq qo'ng'iroq qil", 'Call me later.'),
      matchPairs([
        { left: 'I am an artist', right: 'Men rassomman' },
        { left: 'I am middle-aged', right: "Men o'rta yoshliman" },
        { left: 'I am a teacher', right: "Men o'qituvchiman" },
        { left: 'She is my aunt', right: 'U mening xolam' },
        { left: 'She is a tailor', right: 'U tikuvchi' },
        { left: 'Not now.', right: 'Hozir emas' },
      ]),
    ],
  },

  // ── STEP 37 — Kiyimlar (1) ────────────────────────────────────────────────
  {
    orderNumber: 40,
    title: 'STEP 37 — Kiyimlar (1)',
    type: LessonType.english,
    components: [
      ...vocabBlock({ uz: 'futbolka', en: 'T-shirt', distractors: ['jeans', 'blouse', 'skirt'] }),
      ...vocabBlock({ uz: 'jinsi shim', en: 'jeans', distractors: ['T-shirt', 'blouse', 'sweater'] }),
      ...vocabBlock({ uz: 'kofta', en: 'blouse', distractors: ['T-shirt', 'jeans', 'skirt'] }),
      ...vocabBlock({ uz: 'yubka', en: 'skirt', distractors: ['jeans', 'blouse', 'sweater'] }),
      ...vocabBlock({ uz: "svit'r", en: 'sweater', distractors: ['T-shirt', 'jeans', 'skirt'] }),
      ...phraseBlock('Bu yerga kel', 'Come here.'),
      ...phraseBlock('Shu yerda qol', 'Stay here.'),
      ...phraseBlock('Men shu yerdaman', 'I am here.'),
      matchPairs([
        { left: 'T-shirt', right: 'futbolka' },
        { left: 'jeans', right: 'jinsi shim' },
        { left: 'blouse', right: 'kofta' },
        { left: 'skirt', right: 'yubka' },
        { left: 'sweater', right: "svit'r" },
        { left: 'Clothes', right: 'kiyimlar' },
      ]),
    ],
  },

  // ── STEP 38 — to be: are (2-dars) ────────────────────────────────────────
  {
    orderNumber: 41,
    title: 'STEP 38 — to be: are (2-dars)',
    type: LessonType.english,
    components: [
      mcq([
        {
          text: "Ikki yoki undan ortiq odam haqida gapirilganda 'to be'ning qaysi shakli ishlatiladi?",
          options: ['am', 'is', 'are', 'be'],
          correct: 2,
        },
      ]),
      ...topicSentenceBlock({ uz: 'Biz chet eldanmiz', en: 'We are from abroad', words: ['We', 'are', 'from', 'abroad'] }),
      ...topicSentenceBlock({ uz: 'Siz hamshirasiz', en: 'You are a nurse', words: ['You', 'are', 'a', 'nurse'] }),
      ...topicSentenceBlock({ uz: 'Ular kuchli yigitlar', en: 'They are strong boys', words: ['They', 'are', 'strong', 'boys'] }),
      ...topicSentenceBlock({ uz: 'Ular juda eski', en: 'They are very old', words: ['They', 'are', 'very', 'old'] }),
      ...phraseBlock('Bu nima?', 'What is this?'),
      ...phraseBlock('U qayerda?', 'Where is it?'),
      ...phraseBlock('Anavi kim?', 'Who is that?'),
      matchPairs([
        { left: 'We are from abroad', right: 'Biz chet eldanmiz' },
        { left: 'You are a nurse', right: 'Siz hamshirasiz' },
        { left: 'They are very old', right: 'Ular juda eski' },
        { left: 'Come here.', right: 'Bu yerga kel' },
        { left: 'Stay here.', right: 'Shu yerda qol' },
      ]),
    ],
  },

  // ── STEP 39 — Kiyimlar (2) ────────────────────────────────────────────────
  {
    orderNumber: 42,
    title: 'STEP 39 — Kiyimlar (2)',
    type: LessonType.english,
    components: [
      ...vocabBlock({ uz: "ko'ylak", en: 'dress', distractors: ['cardigan', 'jacket', 'coat'] }),
      ...vocabBlock({ uz: 'kamzul', en: 'cardigan', distractors: ['dress', 'jacket', 'cap'] }),
      ...vocabBlock({ uz: 'jaket', en: 'jacket', distractors: ['dress', 'cardigan', 'coat'] }),
      ...vocabBlock({ uz: 'palto', en: 'coat', distractors: ['jacket', 'cardigan', 'cap'] }),
      ...vocabBlock({ uz: 'bosh kiyim', en: 'cap', distractors: ['dress', 'jacket', 'coat'] }),
      ...phraseBlock('U yerga bor', 'Go there.'),
      ...phraseBlock("U o'sha yerda", 'It is there.'),
      ...phraseBlock('Anavi yerga qara', 'Look over there.'),
      matchPairs([
        { left: 'dress', right: "ko'ylak" },
        { left: 'cardigan', right: 'kamzul' },
        { left: 'jacket', right: 'jaket' },
        { left: 'coat', right: 'palto' },
        { left: 'cap', right: 'bosh kiyim' },
        { left: 'vest', right: 'ichki kiyim' },
      ]),
    ],
  },

  // ── STEP 40 — Ota-ona urishganida (Personal Dev) ─────────────────────────
  {
    orderNumber: 43,
    title: 'STEP 40 — Ota-ona urishganida',
    type: LessonType.personal_development,
    nRepetitions: 1,
    aiTutorEnabled: true,
    aiTutorContext: [
      "Sen Aloqushsan, do'stona o'zbek bola. O'zbek tilida suhbatlash.",
      "",
      "Bola hozir ushbu mavzuni o'qidi: \"Ota-onamiz urishsalar, nima qilishimiz kerak?\"",
      "",
      "Asosiy g'oya: Ota-onang urishganda — javob qaytarma, o'zingni tekshir, kerak bo'lsa sokin uzr so'ra. Tinchlik va bosiqlik — eng kuchli javob.",
      "",
      "Boladan 3 ta savol so'ra (ketma-ket, javobiga qarab):",
      "1) \"Bu darsdan nima o'rganding?\"",
      "2) \"Ota-onang urishganda odatda sen nima qilasan?\"",
      "3) \"Bundan keyin nima qilishga harakat qilasan?\"",
      "",
      "Har javobini hurmat qil, kichik maslahat ber. Maksimal 2-3 jumla.",
    ].join('\n'),
    components: [
      mcq([
        {
          text: [
            "📖 SHAXSIY RIVOJLANISH — Ota-onamiz urishsalar, nima qilishimiz kerak?",
            "",
            "Ba'zida biz xatoga yo'l qo'yamiz, yoki ota-onamiz bizni tushunmaydilar. Shunda ular jahli chiqib, urishishlari mumkin. Bunday paytda nima qilish kerak?",
            "",
            "Avvalo, urishgan paytda javob qaytarmaslik kerak. Chunki ularning jahl ustida aytgan gaplari doim ham adolatli bo'lmasligi mumkin. Javob bersak, urush yana kuchayadi.",
            "",
            "Keyin, o'zingdan so'ra: \"Men haqiqatan xato qildimmi?\" Agar ha bo'lsa, sokin gap bilan uzr so'rash — bu kuchsizlik emas, bu donolik!",
            "",
            "Agar sen xato qilmagan bo'lsang, lekin baribir urishishsalar, ularni tushunishga harakat qil. Balki ular charchaganlar yoki ishda asabiylashganlar.",
            "",
            "Esda tut: ota-onang seni yaxshi ko'radilar. Ba'zida ularning sevgisi ham shunaqa — urushib namoyon bo'ladi. Lekin sen tarbiyali bola bo'lib, jimgina tinglasang, hammasi OK bo'ladi.",
            "",
            "Tinchlik, bosiqlik — eng kuchli javob.",
            "",
            "👨‍👩‍👧 Oila a'zolaringizga shu mavzuda treyning o'tib bering va ko'proq oynaga qarab mashq qiling!",
            "",
            "❓ Ota-onang seni urishyapti. Eng to'g'ri javob qaysi?",
          ].join('\n'),
          options: [
            "Ovozini ko'tarib, javob qaytarish",
            "Jimgina tinglab, keyin xato qilgan bo'lsam, sokin uzr so'rash",
            "Eshikni yopib, ketib qolish",
          ],
          correct: 1,
        },
      ]),
      mcq([{ text: "Ota-onang urishganda birinchi nima qilish kerak?", options: ["Darhol javob qaytarish", "Jimgina tinglab, tinch bo'lish", "Eshikni yopib chiqib ketish", "Baland ovozda gapirish"], correct: 1 }]),
      mcq([{ text: "Nima uchun jahl ustida javob bermaslik kerak?", options: ["Chunki bu qoidaga zid", "Chunki javob bersak, urush yanada kuchayadi", "Chunki ular hech qachon xato qilmaydi", "Chunki siz doim xatosiz"], correct: 1 }]),
      mcq([{ text: "Xato qilgan bo'lsang, eng to'g'ri harakat:", options: ["Yashirish", "Boshqani ayblamoq", "Sokin va ochiq uzr so'rash", "Indamay o'tirish"], correct: 2 }]),
      mcq([{ text: "Uzr so'rash — bu nima?", options: ["Kuchsizlik belgisi", "Donolik va tarbiyalilik belgisi", "Mag'lubiyat", "Qo'rquv"], correct: 1 }]),
      mcq([{ text: "Ota-onang ishda charchab keldi va seni urishdi. Nima qilasan?", options: ["Men ham ovozimni ko'taraman", "Ularni tushunishga harakat qilaman — ular charchagan", "Xonaga kirib eshikni qulflayman", "Do'stlarimga shikoyat qilaman"], correct: 1 }]),
      mcq([{ text: "O'zingdan so'rash kerak bo'lgan savol:", options: ["'Ular qachon tinchlanadi?'", "'Men haqiqatan xato qildimmi?'", "'Bu adolatli emasmi?'", "'Kim aybli?'"], correct: 1 }]),
      mcq([{ text: "Ota-onam seni urishyapti, lekin sen xato qilmadingsan. Nima qilasan?", options: ["Ularga bo'kiramanlar", "Ularni tushunishga harakat qilaman — balki ular charchagan", "Uydan chiqib ketaman", "Yig'lab o'tirams"], correct: 1 }]),
      mcq([{ text: "Tinchlik va bosiqlik — bu nima?", options: ["Qo'rquv", "Eng kuchli javob", "Kuchsizlik", "Befarqlik"], correct: 1 }]),
      mcq([{ text: "Ota-onang seni sevadimi, urushsalar ham?", options: ["Yo'q, sevishsa ururish", "Ha — ularning sevgisi ba'zan urushib namoyon bo'ladi", "Bilmayman", "Faqat tinch paytda sevishadi"], correct: 1 }]),
      mcq([{ text: "Jahl ustida aytilgan gaplar qanday bo'lishi mumkin?", options: ["Har doim adolatli", "Doim to'g'ri", "Doim ham adolatli bo'lmasligi mumkin", "Har doim yolg'on"], correct: 2 }]),
      mcq([{ text: "Tarbiyali bola urishganda nima qiladi?", options: ["Balandroq gapiradi", "Jimgina tinglaydi va o'zini tekshiradi", "Eshikni urib chiqadi", "Do'stini chaqiradi"], correct: 1 }]),
      mcq([{ text: "Birinchi nima qilish kerak: o'zingni tekshirish yoki darhol uzr so'rash?", options: ["Darhol uzr so'rash", "Avval o'zingni tekshirish, keyin kerak bo'lsa uzr so'rash", "Hech narsa qilmaslik", "Boshqani ayblamoq"], correct: 1 }]),
      mcq([{ text: "Agar ota-onang asabiylashsa, buning sababi nima bo'lishi mumkin?", options: ["Ular seni yoqtirmaydi", "Ular charchagan yoki ishda muammo bo'lgan", "Bu normal holat, sababi yo'q", "Siz hech qachon xato qilmadingiz"], correct: 1 }]),
      mcq([{ text: "Urishdan keyin sokin gapirish nima beradi?", options: ["Hech narsa", "Muammoni kuchaytiradi", "Muammo hal bo'lishiga yordam beradi", "Ularni g'azablantirad"], correct: 2 }]),
      mcq([{ text: "Do'sting ham ota-onasidan urish olganda, unga nima maslahat berasan?", options: ["Uydan qochib ket", "Jimgina tingla va xato qilgan bo'lsang uzr so'ra", "Ularga jahl bilan javob ber", "Buni e'tiborsiz qoldiraman"], correct: 1 }]),
      mcq([{ text: "Ota-onangning seni urishi — bu sevgi yo'qligi degani emasmi?", options: ["Ha, sevishsa ururish", "Yo'q — ba'zida g'amxo'rlik urush shaklida ko'rinadi", "Bilmayman", "Faqat sovuq odamlar ururish"], correct: 1 }]),
      mcq([{ text: "Qaysi holat tarbiyali bolaning harakatiga eng mos?", options: ["Baland ovozda javob qaytarish", "Jimgina tinglab, kerak bo'lsa sokin uzr so'rash", "Eshikni yopib ketish", "Do'stlariga shikoyat qilish"], correct: 1 }]),
      mcq([{ text: "'Tinchlik — eng kuchli javob' degani nima?", options: ["Muammoni e'tiborsiz qoldirish", "Bosiqlik bilan munosabat bildirish — bu kuch, kuchsizlik emas", "Hech narsa qilmaslik", "Faqat yig'lash"], correct: 1 }]),
      mcq([{ text: "Ota-onang xatosini tushunsa, ular nima qiladi?", options: ["Hech qachon tan olmaydi", "Vaqt o'tsa tinchlanadi va munosabat yaxshilanadi", "Yanada ko'proq ururish", "Hech narsa o'zgarmaydi"], correct: 1 }]),
    ],
  },

  // ── TAKRORLASH 22-31 — Checkpoint (Archetype F) ───────────────────────────
  {
    orderNumber: 34,
    title: 'TAKRORLASH 22-31',
    type: LessonType.english,
    hasExam: true,
    nRepetitions: 5,
    components: [
      // ── Number match-pairs (sample 30 numbers in 5 rounds of 6) ────
      matchPairs([
        { left: 'one', right: 'bir' },
        { left: 'two', right: 'ikki' },
        { left: 'three', right: 'uch' },
        { left: 'four', right: "to'rt" },
        { left: 'five', right: 'besh' },
        { left: 'six', right: 'olti' },
      ]),
      matchPairs([
        { left: 'seven', right: 'yetti' },
        { left: 'eight', right: 'sakkiz' },
        { left: 'nine', right: "to'qqiz" },
        { left: 'ten', right: "o'n" },
        { left: 'eleven', right: "o'n bir" },
        { left: 'twelve', right: "o'n ikki" },
      ]),
      matchPairs([
        { left: 'thirteen', right: "o'n uch" },
        { left: 'fifteen', right: "o'n besh" },
        { left: 'seventeen', right: "o'n yetti" },
        { left: 'nineteen', right: "o'n to'qqiz" },
        { left: 'twenty', right: 'yigirma' },
        { left: 'thirty', right: "o'ttiz" },
      ]),
      matchPairs([
        { left: 'fourty', right: 'qirq' },
        { left: 'fifty', right: 'ellik' },
        { left: 'sixty', right: 'oltmish' },
        { left: 'seventy', right: 'yetmish' },
        { left: 'eighty', right: 'sakson' },
        { left: 'ninety', right: "to'qson" },
      ]),
      matchPairs([
        { left: 'twenty one', right: 'yigirma bir' },
        { left: 'twenty five', right: 'yigirma besh' },
        { left: 'thirty two', right: "o'ttiz ikki" },
        { left: 'fourty three', right: 'qirq uch' },
        { left: 'fifty', right: 'ellik' },
        { left: 'forty', right: 'qirq' },
      ]),
      // ── Phrase translates ─────────────────────────────────────────
      translate('U mening onam', 'She is my mom'),
      translate('Onam mehribon', 'Mom is kind'),
      translate("Onamni yaxshi ko'raman", 'I love mom'),
      translate('U mening otam', 'He is my dad'),
      translate('Dadam band', 'Dad is busy'),
      translate('Dadam uyda', 'Dad is at home'),
      translate('Mening akam bor', 'I have a brother'),
      translate('U mening singlim', 'She is my sister'),
      translate('Biz oilamiz', 'We are a family'),
      translate('Men ochman', 'I am hungry'),
      translate('Ovqat xohlayman', 'I want food'),
      translate('Biroz non yeng', 'Eat some bread'),
      translate('Men chanqadim', 'I am thirsty'),
      translate('Suv, iltimos', 'Water, please'),
      translate('Biroz suv iching', 'Drink some water'),
      translate('Menga bu yoqadi', 'I like it'),
      translate('Men choyni yoqtiraman', 'I like tea'),
      translate('Sizga bu yoqadimi?', 'Do you like it?'),
      translate('Menga bu yoqmaydi', 'I do not like it'),
      translate("Men buni yomon ko'raman", 'I hate this'),
      translate("Yo'q, rahmat", 'No, thank you'),
      // ── Topic sentence drills (you, they, am, is) ─────────────────
      wordOrder([
        { words: ['student', 'a', 'are', 'You'], correct: 'You are a student' },
        { words: ['friend', 'my', 'are', 'You'], correct: 'You are my friend' },
        { words: ['beautiful', 'are', 'You'], correct: 'You are beautiful' },
        { words: ['abroad', 'from', 'are', 'You'], correct: 'You are from abroad' },
      ]),
      wordOrder([
        { words: ['pilots', 'are', 'They'], correct: 'They are pilots' },
        { words: ['classmates', 'my', 'are', 'They'], correct: 'They are my classmates' },
        { words: ['toys', 'are', 'They'], correct: 'They are toys' },
        { words: ['abroad', 'from', 'are', 'They'], correct: 'They are from abroad' },
      ]),
      wordOrder([
        { words: ['tall', 'am', 'I'], correct: 'I am tall' },
        { words: ['old', 'years', '11', 'am', 'I'], correct: 'I am 11 years old' },
        { words: ['here', 'from', 'am', 'I'], correct: 'I am from here' },
        { words: ['young', 'am', 'I'], correct: 'I am young' },
      ]),
      wordOrder([
        { words: ['polite', 'is', 'He'], correct: 'He is polite' },
        { words: ['old', 'years', '22', 'is', 'She'], correct: 'She is 22 years old' },
        { words: ['dog', 'a', 'is', 'It'], correct: 'It is a dog' },
        { words: ['doctor', 'a', 'is', 'She'], correct: 'She is a doctor' },
      ]),
      // ── Speak-aloud key sentences ────────────────────────────────
      speakSentence('I am hungry', 70),
      speakSentence('I am thirsty', 70),
      speakSentence('I like it', 70),
      speakSentence('I do not like it', 70),
      speakSentence('She is my mom', 70),
      speakSentence('I have a brother', 70),
      speakSentence('We are a family', 70),
      // ── 'My best friend' composition recall ──────────────────────
      speakWords(
        "Hello! I want to talk about my best friend. My best friend is a good boy. He is from my city. He is kind and smart. We take care of each other. I trust my friend. I am happy to have him.",
        70,
      ),
    ],
  },
  // ─── Lesson 44: TAKRORLASH 1-40 — Yakuniy ───────────────────────────────
  {
    orderNumber: 44,
    title: "TAKRORLASH 1-40 — Yakuniy",
    type: LessonType.english,
    hasExam: true,
    nRepetitions: 5,
    components: [
      // ── Vocab match-pairs: 6 rounds covering all family / house / numbers / clothes ──
      matchPairs([
        { left: 'mother', right: 'ona' },
        { left: 'father', right: 'ota' },
        { left: 'brother', right: 'aka' },
        { left: 'sister', right: 'opa' },
        { left: 'parents', right: 'ota-ona' },
        { left: 'uncle', right: 'amaki' },
      ]),
      matchPairs([
        { left: 'grandfather', right: 'buvajon' },
        { left: 'grandmother', right: 'buvijon' },
        { left: 'aunt', right: 'amma' },
        { left: 'cousin', right: 'amakivachcha' },
        { left: 'nephew', right: "o'g'il jiyan" },
        { left: 'niece', right: 'qiz jiyan' },
      ]),
      matchPairs([
        { left: 'house', right: 'uy' },
        { left: 'door', right: 'eshik' },
        { left: 'window', right: 'deraza' },
        { left: 'wall', right: 'devor' },
        { left: 'roof', right: 'tom' },
        { left: 'bedroom', right: 'yotoqxona' },
      ]),
      matchPairs([
        { left: 'kitchen', right: 'oshxona' },
        { left: 'living room', right: 'mehmon xona' },
        { left: 'dining room', right: 'ovqatlanish xonasi' },
        { left: 'garden', right: "bog'" },
        { left: 'bathroom', right: 'yuvinish xonasi' },
        { left: 'chimney', right: "mo'ri" },
      ]),
      matchPairs([
        { left: 'one', right: 'bir' },
        { left: 'five', right: 'besh' },
        { left: 'ten', right: "o'n" },
        { left: 'twenty', right: 'yigirma' },
        { left: 'fifty', right: 'ellik' },
        { left: 'hundred', right: 'yuz' },
      ]),
      matchPairs([
        { left: 'T-shirt', right: 'futbolka' },
        { left: 'jeans', right: 'jinsi shim' },
        { left: 'dress', right: "ko'ylak" },
        { left: 'jacket', right: 'jaket' },
        { left: 'coat', right: 'palto' },
        { left: 'cap', right: 'bosh kiyim' },
      ]),
      // ── Phrase translates: 30 representative across all categories ─────
      // Greetings
      translate('Xayrli tong!', 'Good morning!'),
      translate('Xayrli kech', 'Good evening'),
      translate('Xayrli tun', 'Good night'),
      translate('Qalaysiz?', 'How are you?'),
      translate('Men yaxshiman', 'I am fine'),
      translate('Tanishganimdan xursandman', 'Nice to meet you'),
      translate("Keyinroq ko'rishguncha", 'See you later'),
      translate('Xush kelibsiz', 'Welcome'),
      // Family / movement / room
      translate('Raxmat', 'Thank you'),
      translate('Arzimaydi', 'You are welcome'),
      translate('Kechirasiz', 'I am sorry'),
      translate("Muammo yo'q", 'No problem'),
      translate('Kirsam maylimi?', 'May I come in?'),
      translate('Chiqsam maylimi?', 'May I go out?'),
      translate('Menga quloq soling', 'Listen to me'),
      // Food / health
      translate('Men ochman', 'I am hungry'),
      translate('Men chanqadim', 'I am thirsty'),
      translate('Suv, iltimos', 'Water, please'),
      translate("Boshim og'riyapti", 'My head hurts'),
      translate('Men kasalman', 'I am sick'),
      translate("Tezroq sog'ayib keting", 'Get well soon'),
      // Opinion / agreement
      translate('Ha albatta', 'Yes, of course'),
      translate('Men roziman', 'I agree'),
      translate('Siz haqsiz', 'You are right'),
      translate('Menga bu yoqadi', 'I like it'),
      translate('Menga bu yoqmaydi', 'I do not like it'),
      // Action
      translate('Buni hozir qil', 'Do it now'),
      translate('Hozir bandman', 'I am busy now'),
      translate('Darsni boshlang', 'Start the lesson'),
      translate('Hozir emas', 'Not now'),
      // ── Topic sentence drills: 12 patterns, 3 sentences each ────────────
      wordOrder([
        { words: ['pupil', 'a', 'I', 'am'], correct: 'I am a pupil' },
        { words: ['here', 'from', 'I', 'am'], correct: 'I am from here' },
        { words: ['strong', 'am', 'I'], correct: 'I am strong' },
      ]),
      wordOrder([
        { words: ['firefighter', 'a', 'is', 'He'], correct: 'He is a firefighter' },
        { words: ['abroad', 'from', 'is', 'He'], correct: 'He is from abroad' },
        { words: ['friend', 'my', 'is', 'He'], correct: 'He is my friend' },
      ]),
      wordOrder([
        { words: ['doctor', 'a', 'is', 'She'], correct: 'She is a doctor' },
        { words: ['short', 'is', 'She'], correct: 'She is short' },
        { words: ['mother', 'my', 'is', 'She'], correct: 'She is my mother' },
      ]),
      wordOrder([
        { words: ['desk', 'my', 'is', 'It'], correct: 'It is my desk' },
        { words: ['pet', 'a', 'is', 'It'], correct: 'It is a pet' },
        { words: ['big', 'very', 'is', 'It'], correct: 'It is very big' },
      ]),
      wordOrder([
        { words: ['abroad', 'from', 'are', 'We'], correct: 'We are from abroad' },
        { words: ['players', 'football', 'are', 'We'], correct: 'We are football players' },
        { words: ['clever', 'are', 'We'], correct: 'We are clever' },
      ]),
      wordOrder([
        { words: ['student', 'a', 'are', 'You'], correct: 'You are a student' },
        { words: ['friend', 'my', 'are', 'You'], correct: 'You are my friend' },
        { words: ['beautiful', 'are', 'You'], correct: 'You are beautiful' },
      ]),
      wordOrder([
        { words: ['pilots', 'are', 'They'], correct: 'They are pilots' },
        { words: ['classmates', 'my', 'are', 'They'], correct: 'They are my classmates' },
        { words: ['toys', 'are', 'They'], correct: 'They are toys' },
      ]),
      wordOrder([
        { words: ['tall', 'am', 'I'], correct: 'I am tall' },
        { words: ['young', 'am', 'I'], correct: 'I am young' },
        { words: ['here', 'from', 'am', 'I'], correct: 'I am from here' },
      ]),
      wordOrder([
        { words: ['polite', 'is', 'He'], correct: 'He is polite' },
        { words: ['dog', 'a', 'is', 'It'], correct: 'It is a dog' },
        { words: ['doctor', 'a', 'is', 'She'], correct: 'She is a doctor' },
      ]),
      wordOrder([
        { words: ['doctors', 'are', 'We'], correct: 'We are doctors' },
        { words: ['famous', 'are', 'You'], correct: 'You are famous' },
        { words: ['Uzbek', 'are', 'You'], correct: 'You are Uzbek' },
      ]),
      wordOrder([
        { words: ['artist', 'an', 'am', 'I'], correct: 'I am an artist' },
        { words: ['twelve', 'am', 'I'], correct: 'I am twelve' },
        { words: ['seller', 'a', 'is', 'She'], correct: 'She is a seller' },
      ]),
      wordOrder([
        { words: ['abroad', 'from', 'are', 'We'], correct: 'We are from abroad' },
        { words: ['nurse', 'a', 'are', 'You'], correct: 'You are a nurse' },
        { words: ['old', 'very', 'are', 'They'], correct: 'They are very old' },
      ]),
      // ── Speak-aloud: 10 representative sentences across pronouns ────────
      speakSentence('I am a pupil', 70),
      speakSentence('He is my friend', 70),
      speakSentence('She is my mother', 70),
      speakSentence('We are clever', 70),
      speakSentence('You are my friend', 70),
      speakSentence('They are my classmates', 70),
      speakSentence('I am happy', 70),
      speakSentence('I love my family', 70),
      speakSentence('Thank you', 70),
      speakSentence('See you later', 70),
      // ── Composition recall: 3 paragraphs ────────────────────────────────
      speakWords(
        "Hello! I am a student. My family is small. I am 10 years old. I am from here. I live in my town. I am a pupil at school. My favourite subject is English.",
        70,
      ),
      speakWords(
        "Hello! I have a small family. There are 4 people in my family. My father's job is teacher. My mother's job is nurse. I love my family.",
        70,
      ),
      speakWords(
        "Hello! I want to talk about my best friend. My best friend is a good boy. He is from my city. He is kind and smart. We take care of each other. I trust my friend. I am happy to have him.",
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
