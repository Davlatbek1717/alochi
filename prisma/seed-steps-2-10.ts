/**
 * Seed STEPS 2-10 from the A'lochi 1-40 curriculum PDF.
 *
 * Seven English-track lessons (2, 3, 4, 6, 7, 8, 9) get the full
 * 12-exercise treatment matching STEP 1: mcq → word_order → translate →
 * listen_pick → listen_type → match_pairs → pick_picture → fill_blank →
 * spelling → order_sentences → speak_sentence → speak_words.
 *
 * Two personal-development lessons (5, 10) carry essay-style content
 * (Aqlli fikrlash / Qo'rqmaslik) and use a smaller exercise set —
 * mcq for comprehension, ai_tutor for reflection, speak_sentence on
 * the headline takeaway.
 *
 * Idempotent: rerun upserts each lesson by orderNumber and rebuilds its
 * LessonComponent rows from scratch. Refuses to run if no tenant exists.
 *
 * Usage from repo root:
 *   pnpm --filter api exec ts-node -r tsconfig-paths/register \
 *     ../../prisma/seed-steps-2-10.ts
 */
import { PrismaClient, LessonType } from '@prisma/client';

const prisma = new PrismaClient();

// Re-used across every lesson — the existing STEP 1 placeholder. Admins
// can swap each per-lesson via the redesigned superadmin edit form.
const PLACEHOLDER_YT = 'https://www.youtube.com/watch?v=hZTkOcAjOCs';

interface ComponentSpec {
  type: string;
  config: Record<string, unknown>;
}

interface LessonSpec {
  orderNumber: number;
  title: string;
  type: LessonType;
  components: ComponentSpec[];
}

// ─── helper builders ────────────────────────────────────────────────────────

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
  return {
    type: 'listen_pick',
    config: { text, options, correctOptionId },
  };
}

function listenType(
  text: string,
  acceptedAnswers: string[] = [],
  context?: string,
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
      ...(context ? { context } : {}),
    },
  };
}

function matchPairs(
  pairs: Array<{ left: string; right: string }>,
): ComponentSpec {
  return { type: 'match_pairs', config: { pairs } };
}

function pickPicture(
  word: string,
  options: Array<{ id: string; emoji: string; label: string; bg: string; fg: string }>,
  correctOptionId: string,
): ComponentSpec {
  return {
    type: 'pick_picture',
    config: {
      word,
      options: options.map((o) => ({
        id: o.id,
        imageUrl: `https://placehold.co/400x400/${o.bg}/${o.fg}?text=${encodeURIComponent(o.emoji + ' ' + o.label)}`,
      })),
      correctOptionId,
    },
  };
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

function orderSentences(sentences: string[]): ComponentSpec {
  return { type: 'order_sentences', config: { sentences } };
}

function speakSentence(sentence: string, minScore = 70): ComponentSpec {
  return { type: 'speak_sentence', config: { sentence, minScore } };
}

function speakWords(text: string, minScore = 70): ComponentSpec {
  return { type: 'speak_words', config: { text, minScore } };
}

// ─── lesson definitions ─────────────────────────────────────────────────────

const LESSONS: LessonSpec[] = [
  // ── STEP 2 — Good afternoon / evening / Hello + ism ──────────────────────
  {
    orderNumber: 2,
    title: 'STEP 2 — Xayrli kun',
    type: LessonType.english,
    components: [
      mcq([
        {
          text: '"Xayrli kun" inglizchada qanday?',
          options: ['Good morning', 'Good afternoon', 'Good night', 'Goodbye'],
          correct: 1,
        },
        {
          text: '"Good evening" qachon ishlatiladi?',
          options: ['Tongda', 'Kunduzi', 'Kechqurun', 'Tunda'],
          correct: 2,
        },
        {
          text: '"Hello, Namoz" qanday tarjima qilinadi?',
          options: [
            'Xayr, Namoz',
            'Salom, Namoz',
            'Xayrli kun, Namoz',
            "O'zingdan o'rgan",
          ],
          correct: 1,
        },
      ]),
      wordOrder([
        {
          words: ['afternoon', 'Good'],
          correct: 'Good afternoon',
        },
        {
          words: ['Namoz', 'Hello', ','],
          correct: 'Hello , Namoz',
        },
      ]),
      translate('Xayrli kun!', 'Good afternoon!', ['good afternoon!']),
      listenPick(
        'Good evening',
        [
          { id: 'a', label: 'Xayrli tong' },
          { id: 'b', label: 'Xayrli kun' },
          { id: 'c', label: 'Xayrli kech' },
          { id: 'd', label: 'Xayrli tun' },
        ],
        'c',
      ),
      listenType('Good afternoon', [], "Kunduzgi salomlashish"),
      matchPairs([
        { left: 'Good afternoon', right: 'Xayrli kun' },
        { left: 'Good evening', right: 'Xayrli kech' },
        { left: 'Hello', right: 'Salom' },
        { left: 'Namoz', right: 'Namoz' },
      ]),
      pickPicture(
        'Evening',
        [
          { id: 'sunset', emoji: '🌆', label: 'Evening', bg: 'f59e0b', fg: '0f172a' },
          { id: 'sunrise', emoji: '☀️', label: 'Morning', bg: 'fbbf24', fg: '0f172a' },
          { id: 'night', emoji: '🌙', label: 'Night', bg: '0f172a', fg: 'fbbf24' },
          { id: 'noon', emoji: '☀️', label: 'Noon', bg: 'fef3c7', fg: 'a16207' },
        ],
        'sunset',
      ),
      fillBlank('Good ___, Namoz!', 'evening', [
        'evening',
        'morning',
        'night',
        'afternoon',
      ]),
      spelling('afternoon'),
      orderSentences([
        'Good afternoon!',
        'Good evening, Namoz.',
        'Hello, everyone!',
      ]),
      speakSentence('Good afternoon, everyone!'),
      speakWords('Good afternoon Hello Namoz Good evening'),
    ],
  },

  // ── STEP 3 — Xayrlashish ──────────────────────────────────────────────────
  {
    orderNumber: 3,
    title: 'STEP 3 — Xayrlashish',
    type: LessonType.english,
    components: [
      mcq([
        {
          text: '"Good night" qanday tarjima qilinadi?',
          options: ['Xayrli tun', 'Xayrli kech', 'Xayr', 'Yaxshi tong'],
          correct: 0,
        },
        {
          text: '"Sleep well" nimani anglatadi?',
          options: [
            'Yaxshi yur',
            'Yaxshi dam oling',
            'Yaxshi ovqatlan',
            'Yaxshi gapir',
          ],
          correct: 1,
        },
        {
          text: '"Goodbye" — bu ...',
          options: ['Salom', 'Xayr', 'Rahmat', 'Iltimos'],
          correct: 1,
        },
      ]),
      wordOrder([
        { words: ['night', 'Good'], correct: 'Good night' },
        { words: ['well', 'Sleep'], correct: 'Sleep well' },
      ]),
      translate('Xayrli tun!', 'Good night!', ['good night!']),
      listenPick(
        'Goodbye',
        [
          { id: 'a', label: 'Salom' },
          { id: 'b', label: 'Xayr' },
          { id: 'c', label: 'Rahmat' },
          { id: 'd', label: 'Tun' },
        ],
        'b',
      ),
      listenType('Sleep well', [], 'Uxlashdan oldin tilak'),
      matchPairs([
        { left: 'Good night', right: 'Xayrli tun' },
        { left: 'Sleep well', right: 'Yaxshi dam oling' },
        { left: 'Goodbye', right: 'Xayr' },
        { left: 'Sleep', right: 'Uxlash' },
      ]),
      pickPicture(
        'Night',
        [
          { id: 'moon', emoji: '🌙', label: 'Night', bg: '0f172a', fg: 'fbbf24' },
          { id: 'sun', emoji: '☀️', label: 'Day', bg: 'fbbf24', fg: '0f172a' },
          { id: 'star', emoji: '⭐', label: 'Star', bg: 'fef3c7', fg: 'a16207' },
          { id: 'wave', emoji: '👋', label: 'Bye', bg: '1cb0f6', fg: 'ffffff' },
        ],
        'moon',
      ),
      fillBlank('Good ___! Sleep well.', 'night', [
        'night',
        'morning',
        'day',
        'afternoon',
      ]),
      spelling('goodbye'),
      orderSentences(['Good night.', 'Sleep well.', 'Goodbye!']),
      speakSentence('Good night, sleep well!'),
      speakWords('Good night Sleep well Goodbye'),
    ],
  },

  // ── STEP 4 — How are you? ─────────────────────────────────────────────────
  {
    orderNumber: 4,
    title: 'STEP 4 — Qalaysiz?',
    type: LessonType.english,
    components: [
      mcq([
        {
          text: '"How are you?" qanday ma\'noni anglatadi?',
          options: ['Sen kimsan?', 'Qalaysiz?', 'Qayerdasan?', 'Nima qilyapsan?'],
          correct: 1,
        },
        {
          text: '"I am fine" — bu javob nima haqida?',
          options: [
            'Mening ismim',
            "Yoshim haqida",
            'Mening ahvolim — yaxshi',
            'Mening kasbim',
          ],
          correct: 2,
        },
        {
          text: '"I am sleepy" — bu nimani anglatadi?',
          options: [
            'Men charchadim',
            'Uyqum kelyapti',
            "Men ochman",
            'Men uxladim',
          ],
          correct: 1,
        },
      ]),
      wordOrder([
        { words: ['are', 'How', 'you'], correct: 'How are you' },
        { words: ['fine', 'am', 'I'], correct: 'I am fine' },
      ]),
      translate(
        'Qalaysiz?',
        'How are you?',
        ['how are you?', 'how are you'],
      ),
      listenPick(
        'I am fine',
        [
          { id: 'a', label: 'Men yaxshiman' },
          { id: 'b', label: 'Men yomonman' },
          { id: 'c', label: 'Men charchadim' },
          { id: 'd', label: 'Uyqum kelyapti' },
        ],
        'a',
      ),
      listenType('I am sleepy', [], "Uyqu ahvoli"),
      matchPairs([
        { left: 'How are you?', right: 'Qalaysiz?' },
        { left: 'I am fine', right: 'Men yaxshiman' },
        { left: 'I am sleepy', right: 'Uyqum kelyapti' },
        { left: 'fine', right: 'yaxshi' },
      ]),
      pickPicture(
        'Sleepy',
        [
          { id: 'sleep', emoji: '😴', label: 'Sleepy', bg: '64748b', fg: 'ffffff' },
          { id: 'happy', emoji: '😊', label: 'Happy', bg: 'fbbf24', fg: '0f172a' },
          { id: 'angry', emoji: '😠', label: 'Angry', bg: 'ef4444', fg: 'ffffff' },
          { id: 'sick', emoji: '🤒', label: 'Sick', bg: '10b981', fg: 'ffffff' },
        ],
        'sleep',
      ),
      fillBlank('I am ___. Thank you!', 'fine', [
        'fine',
        'sleepy',
        'tired',
        'sad',
      ]),
      spelling('fine'),
      orderSentences(['How are you?', 'I am fine.', 'Thank you.']),
      speakSentence('How are you? I am fine.'),
      speakWords('How are you I am fine'),
    ],
  },

  // ── STEP 5 — Personal Development: Aqlli fikrlash ────────────────────────
  {
    orderNumber: 5,
    title: 'STEP 5 — Aqlli fikrlash',
    type: LessonType.personal_development,
    components: [
      mcq([
        {
          text: 'Aqlli fikrlashning birinchi qadami qaysi?',
          options: [
            'Tez qaror qabul qilish',
            'Har doim savol berish',
            "Hech kim bilan gaplashmaslik",
            'Kitob o\'qimaslik',
          ],
          correct: 1,
        },
        {
          text: "Telefon o'ynashdan oldin o'zingizdan nimani so'rashingiz kerak?",
          options: [
            "Bu meni boy qiladimi?",
            "Bu meni aqlli va boy qiladimi?",
            'Vaqtim bormi?',
            "Do'stlarim o'ynayaptimi?",
          ],
          correct: 1,
        },
        {
          text: "Aqlli odam bo'lish — bu ...",
          options: [
            "Tug'ma qobiliyat",
            "O'rganiladigan odat",
            'Faqat yoshlik',
            "O'qishga bog'liq",
          ],
          correct: 1,
        },
        {
          text: "Har kuni qancha o'zgarish qilishimiz kerak?",
          options: [
            "Hech narsa",
            "Bitta katta o'zgarish",
            "Bitta kichik o'zgarish",
            "Yuzta o'zgarish",
          ],
          correct: 2,
        },
      ]),
      speakSentence(
        'Aqlli odam bolish urganiladigan odat',
        60,
      ),
    ],
  },

  // ── STEP 6 — Family vocab + tanishish ─────────────────────────────────────
  {
    orderNumber: 6,
    title: 'STEP 6 — Oila a\'zolari',
    type: LessonType.english,
    components: [
      mcq([
        {
          text: '"Mother" qanday tarjima qilinadi?',
          options: ['Ota', 'Ona', 'Aka', 'Opa'],
          correct: 1,
        },
        {
          text: '"Brother" — bu ...',
          options: ['Opa/singil', 'Aka/uka', 'Ota', 'Bobo'],
          correct: 1,
        },
        {
          text: '"Nice to meet you" qachon aytiladi?',
          options: [
            "Xayrlashganda",
            "Birinchi marta tanishganda",
            "Kechirim so'raganda",
            "Rahmat aytganda",
          ],
          correct: 1,
        },
      ]),
      wordOrder([
        {
          words: ['name', 'My', 'is', 'Anvar'],
          correct: 'My name is Anvar',
        },
        {
          words: ['Anvar', 'am', 'I'],
          correct: 'I am Anvar',
        },
      ]),
      translate('Mening ismim Anvar.', 'My name is Anvar.', [
        'my name is anvar',
        'my name is anvar.',
      ]),
      listenPick(
        'sister',
        [
          { id: 'a', label: 'Ona' },
          { id: 'b', label: 'Ota' },
          { id: 'c', label: 'Aka/uka' },
          { id: 'd', label: 'Opa/singil' },
        ],
        'd',
      ),
      listenType('My name is Anvar', [], 'Tanishish'),
      matchPairs([
        { left: 'mother', right: 'ona' },
        { left: 'father', right: 'ota' },
        { left: 'brother', right: 'aka/uka' },
        { left: 'sister', right: 'opa/singil' },
      ]),
      pickPicture(
        'Mother',
        [
          { id: 'mom', emoji: '👩', label: 'Mother', bg: 'ec4899', fg: 'ffffff' },
          { id: 'dad', emoji: '👨', label: 'Father', bg: '0f172a', fg: 'ffffff' },
          { id: 'sis', emoji: '👧', label: 'Sister', bg: 'a78bfa', fg: 'ffffff' },
          { id: 'bro', emoji: '👦', label: 'Brother', bg: '1cb0f6', fg: 'ffffff' },
        ],
        'mom',
      ),
      fillBlank('My ___ is at home.', 'mother', [
        'mother',
        'father',
        'brother',
        'sister',
      ]),
      spelling('mother'),
      orderSentences([
        'Hello! My name is Anvar.',
        'I am from Uzbekistan.',
        'Nice to meet you.',
      ]),
      speakSentence('My name is Anvar. Nice to meet you.'),
      speakWords('Mother father brother sister'),
    ],
  },

  // ── STEP 7 — Men haqimda (I) ──────────────────────────────────────────────
  {
    orderNumber: 7,
    title: 'STEP 7 — Men kim?',
    type: LessonType.english,
    components: [
      mcq([
        {
          text: '"I am a pupil" — bu nimani anglatadi?',
          options: [
            "Men o'qituvchiman",
            "Men o'quvchiman",
            'Men shifokorman',
            'Men sportchiman',
          ],
          correct: 1,
        },
        {
          text: '"I am from Uzbekistan" — bu ...',
          options: [
            'Men 10 yoshdaman',
            "Men o'quvchiman",
            "Men O'zbekistondanman",
            "Men kuchliman",
          ],
          correct: 2,
        },
        {
          text: '"Where are you?" qanday tarjima qilinadi?',
          options: ['Sen kimsan?', 'Qalaysan?', 'Qayerdasan?', 'Nima qilyapsan?'],
          correct: 2,
        },
      ]),
      wordOrder([
        {
          words: ['pupil', 'I', 'am', 'a'],
          correct: 'I am a pupil',
        },
        {
          words: ['Uzbekistan', 'I', 'from', 'am'],
          correct: 'I am from Uzbekistan',
        },
      ]),
      translate(
        "Men o'quvchiman.",
        'I am a pupil.',
        ['i am a pupil', 'i am a pupil.'],
      ),
      listenPick(
        'I am 10 years old',
        [
          { id: 'a', label: 'Men 10 yoshdaman' },
          { id: 'b', label: 'Men 10 ta opam bor' },
          { id: 'c', label: "Men 10-sinfdaman" },
          { id: 'd', label: "Men 10 ta kitob o'qiyman" },
        ],
        'a',
      ),
      listenType('I am here', [], "Joyini ko'rsatish"),
      matchPairs([
        { left: 'I am a pupil', right: "Men o'quvchiman" },
        { left: 'I am strong', right: 'Men kuchliman' },
        { left: 'Where are you?', right: 'Qayerdasan?' },
        { left: 'Come here', right: 'Bu yerga kel' },
      ]),
      pickPicture(
        'Strong',
        [
          { id: 'strong', emoji: '💪', label: 'Strong', bg: '10b981', fg: 'ffffff' },
          { id: 'weak', emoji: '😩', label: 'Weak', bg: '94a3b8', fg: 'ffffff' },
          { id: 'fast', emoji: '🏃', label: 'Fast', bg: '1cb0f6', fg: 'ffffff' },
          { id: 'tall', emoji: '📏', label: 'Tall', bg: 'fbbf24', fg: '0f172a' },
        ],
        'strong',
      ),
      fillBlank('I am from ___.', 'Uzbekistan', [
        'Uzbekistan',
        'America',
        'Russia',
        'Turkey',
      ]),
      spelling('strong'),
      orderSentences([
        'My name is Anvar.',
        "I am a pupil.",
        'I am from Uzbekistan.',
      ]),
      speakSentence("I am a pupil. I am from Uzbekistan."),
      speakWords('I am a pupil from Uzbekistan strong'),
    ],
  },

  // ── STEP 8 — Extended family + day greeting ───────────────────────────────
  {
    orderNumber: 8,
    title: 'STEP 8 — Bobo-buvi',
    type: LessonType.english,
    components: [
      mcq([
        {
          text: '"Grandfather" qanday tarjima qilinadi?',
          options: ['Buvajon', 'Buvijon', 'Amaki', 'Ota'],
          correct: 0,
        },
        {
          text: '"Parents" — bu ...',
          options: ['Bola', 'Ota-ona', 'Do\'stlar', "O'qituvchilar"],
          correct: 1,
        },
        {
          text: '"How is your day?" — javob qaysi?',
          options: [
            'I am 10 years old',
            'It is good',
            'My name is Anvar',
            'I am from Uzbekistan',
          ],
          correct: 1,
        },
      ]),
      wordOrder([
        {
          words: ['day', 'How', 'your', 'is'],
          correct: 'How is your day',
        },
        {
          words: ['happy', 'I', 'am'],
          correct: 'I am happy',
        },
      ]),
      translate('Men xursandman.', 'I am happy.', ['i am happy', 'i am happy.']),
      listenPick(
        'grandmother',
        [
          { id: 'a', label: 'Ona' },
          { id: 'b', label: 'Buvijon' },
          { id: 'c', label: "Amma/xola" },
          { id: 'd', label: 'Opa' },
        ],
        'b',
      ),
      listenType('I am happy', [], 'Quvonch ahvoli'),
      matchPairs([
        { left: 'grandfather', right: 'buvajon' },
        { left: 'grandmother', right: 'buvijon' },
        { left: 'parents', right: 'ota-ona' },
        { left: 'uncle', right: "amaki/tog'a" },
      ]),
      pickPicture(
        'Happy',
        [
          { id: 'happy', emoji: '😄', label: 'Happy', bg: 'fbbf24', fg: '0f172a' },
          { id: 'sad', emoji: '😢', label: 'Sad', bg: '64748b', fg: 'ffffff' },
          { id: 'angry', emoji: '😠', label: 'Angry', bg: 'ef4444', fg: 'ffffff' },
          { id: 'tired', emoji: '😴', label: 'Tired', bg: '94a3b8', fg: 'ffffff' },
        ],
        'happy',
      ),
      fillBlank('My ___ is very kind.', 'grandmother', [
        'grandmother',
        'grandfather',
        'parents',
        'uncle',
      ]),
      spelling('parents'),
      orderSentences([
        'How is your day?',
        'It is good.',
        'I am happy.',
      ]),
      speakSentence('How is your day? It is good.'),
      speakWords('Grandfather grandmother parents uncle'),
    ],
  },

  // ── STEP 9 — She is ... ───────────────────────────────────────────────────
  {
    orderNumber: 9,
    title: 'STEP 9 — U haqida (qiz bola)',
    type: LessonType.english,
    components: [
      mcq([
        {
          text: '"She is a doctor" — bu nimani anglatadi?',
          options: [
            'U shifokor',
            "Men shifokorman",
            "U o'qituvchi",
            "U bemor",
          ],
          correct: 0,
        },
        {
          text: '"I missed you" qanday tarjima qilinadi?',
          options: [
            "Men sizni ko'rmadim",
            "Sizni sog'indim",
            "Men adashdim",
            'Salom',
          ],
          correct: 1,
        },
        {
          text: '"Welcome" — bu ...',
          options: [
            'Xayr',
            'Salom',
            'Xush kelibsiz',
            'Rahmat',
          ],
          correct: 2,
        },
      ]),
      wordOrder([
        {
          words: ['doctor', 'a', 'is', 'She'],
          correct: 'She is a doctor',
        },
        {
          words: ['mother', 'is', 'my', 'She'],
          correct: 'She is my mother',
        },
      ]),
      translate('U mening onam.', 'She is my mother.', [
        'she is my mother',
        'she is my mother.',
      ]),
      listenPick(
        'She is short',
        [
          { id: 'a', label: "U baland bo'yli" },
          { id: 'b', label: "U past bo'yli" },
          { id: 'c', label: 'U go\'zal' },
          { id: 'd', label: 'U yosh' },
        ],
        'b',
      ),
      listenType('Welcome', ['welcome', 'welcome!'], 'Mehmon kutib olish'),
      matchPairs([
        { left: 'She is a doctor', right: 'U shifokor' },
        { left: 'She is short', right: "U past bo'yli" },
        { left: 'I missed you', right: "Sog'indim" },
        { left: 'Welcome', right: 'Xush kelibsiz' },
      ]),
      pickPicture(
        'Doctor',
        [
          { id: 'doc', emoji: '👩‍⚕️', label: 'Doctor', bg: '10b981', fg: 'ffffff' },
          { id: 'teach', emoji: '👩‍🏫', label: 'Teacher', bg: '1cb0f6', fg: 'ffffff' },
          { id: 'cook', emoji: '👩‍🍳', label: 'Cook', bg: 'fbbf24', fg: '0f172a' },
          { id: 'art', emoji: '👩‍🎨', label: 'Artist', bg: 'ec4899', fg: 'ffffff' },
        ],
        'doc',
      ),
      fillBlank('She is a ___ at the hospital.', 'doctor', [
        'doctor',
        'teacher',
        'cook',
        'student',
      ]),
      spelling('doctor'),
      orderSentences([
        'She is my mother.',
        'She is a doctor.',
        'I missed you.',
      ]),
      speakSentence('She is my mother. She is a doctor.'),
      speakWords('She is a doctor my mother Welcome'),
    ],
  },

  // ── STEP 10 — Personal Development: Qo'rqmaslik ──────────────────────────
  {
    orderNumber: 10,
    title: "STEP 10 — Qo'rqmaslik",
    type: LessonType.personal_development,
    components: [
      mcq([
        {
          text: "Qo'rqmaslik — bu nima?",
          options: [
            "Hech narsadan qo'rqmaslik",
            "Qo'rqib turganda qadam tashlash",
            'Tezda qaror qabul qilish',
            "Hech kim bilan gaplashmaslik",
          ],
          correct: 1,
        },
        {
          text: "Har bir kuchli inson avval ...",
          options: [
            "Kuchli edi",
            "Boy edi",
            "Qo'rqqan, lekin to'xtamagan",
            "Mashhur edi",
          ],
          correct: 2,
        },
        {
          text: "Sening kuching qayerda?",
          options: [
            "Hech narsadan qo'rqmaslikda",
            "Qo'rqib turib ham sinab ko'rishda",
            "Kuchli ovozda gapirishda",
            "Doim g'olib chiqishda",
          ],
          correct: 1,
        },
        {
          text: "Yangi narsani o'rganishdan qo'rqayotgan bo'lsang nima qilish kerak?",
          options: [
            "Tashlab ketish",
            "Birinchi qadamni qo'yish",
            "Boshqa narsa o'ylash",
            "Uxlab dam olish",
          ],
          correct: 1,
        },
      ]),
      speakSentence("Qorqib turib ham sinab korish kuchdir", 60),
    ],
  },
];

// ─── runner ─────────────────────────────────────────────────────────────────

async function main() {
  console.log('--- Seeding STEPS 2-10 from A\'lochi 1-40 PDF ---');

  const tenant = await prisma.tenant.findFirst();
  if (!tenant) {
    console.error(
      '[ABORT] No tenant exists. Run clean-db.ts or restore data first.',
    );
    process.exit(1);
  }
  console.log(`Tenant: ${tenant.name} (${tenant.slug})`);

  for (const spec of LESSONS) {
    const existing = await prisma.lesson.findFirst({
      where: { tenantId: tenant.id, orderNumber: spec.orderNumber },
    });

    const lessonData = {
      tenantId: tenant.id,
      title: spec.title,
      type: spec.type,
      orderNumber: spec.orderNumber,
      youtubeUrl: PLACEHOLDER_YT,
      nRepetitions: 3,
      isPublished: true,
      hasExam: false,
      cameraEnabled: false,
      // Mirror STEP 1's flags so the runner unlocks the legacy MCQ +
      // word_order paths and the AI Tutor section. Personal development
      // lessons skip word_order since the content is essay-based.
      components: {
        mcq: true,
        word_order: spec.type === LessonType.english,
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
      await prisma.lessonComponent.deleteMany({ where: { lessonId: lesson.id } });
      console.log(`Updated: #${spec.orderNumber} ${spec.title}`);
    } else {
      lesson = await prisma.lesson.create({ data: lessonData });
      console.log(`Created: #${spec.orderNumber} ${spec.title}`);
    }

    for (const c of spec.components) {
      await prisma.lessonComponent.create({
        data: {
          lessonId: lesson.id,
          type: c.type,
          config: c.config as never,
        },
      });
    }
    console.log(`   + ${spec.components.length} components`);
  }

  console.log(`\nDone. ${LESSONS.length} lessons seeded.`);
  console.log(
    `Open: http://localhost:3000/superadmin/lessons (admin view)`,
  );
}

main()
  .catch((err) => {
    console.error('[ERROR]', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
