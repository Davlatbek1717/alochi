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

  // ── orderNumber 45 — STEP 41 — My house (Composition — Archetype D) ─────────
  {
    orderNumber: 45,
    title: 'STEP 41 — My house',
    type: LessonType.english,
    aiTutorEnabled: true,
    aiTutorContext: [
      'You are a friendly English coach for a young Uzbek learner.',
      "The student just composed a 'My house' paragraph.",
      'Ask 3 short follow-up questions in English, one at a time, to extend the topic.',
      'Be encouraging. Keep responses to 1-2 sentences.',
      'English only — they are practising English.',
    ].join('\n'),
    components: [
      fillBlank('I want to talk about my ___.', 'house', ['house', 'school', 'family', 'room']),
      fillBlank('My house is big and ___.', 'clean', ['clean', 'small', 'nice', 'new']),
      fillBlank('There are ___ rooms in my house.', 'five', ['three', 'four', 'five', 'six']),
      fillBlank('They are: a living room, a kitchen, a ___, and two bedrooms.', 'bathroom', ['bathroom', 'garden', 'garage', 'dining room']),
      fillBlank('My room is ___ but nice.', 'small', ['small', 'big', 'clean', 'bright']),
      fillBlank('There is a bed, a ___, and a chair.', 'table', ['table', 'desk', 'sofa', 'lamp']),
      fillBlank('I ___ my house.', 'love', ['love', 'like', 'clean', 'decorate']),
      fillBlank('There are ___ bedrooms in my house.', 'two', ['one', 'two', 'three', 'four']),
      fillBlank('My room has a bed and a ___.', 'chair', ['chair', 'window', 'table', 'sofa']),
      // Translate key sentences
      translate('Men uyim haqida gapirmoqchiman.', 'I want to talk about my house'),
      translate('Mening uyim katta va toza.', 'My house is big and clean'),
      translate("Uyimda beshta xona bor.", 'There are five rooms in my house'),
      translate('Mening xonam kichik, lekin chiroyli.', 'My room is small but nice'),
      translate("Men uyimni yaxshi ko'raman.", 'I love my house'),
      // Word-order
      wordOrder([
        { words: ['my', 'about', 'talk', 'to', 'want', 'I', 'house'], correct: 'I want to talk about my house' },
        { words: ['clean', 'and', 'big', 'is', 'house', 'My'], correct: 'My house is big and clean' },
        { words: ['rooms', 'five', 'are', 'There', 'house', 'my', 'in'], correct: 'There are five rooms in my house' },
        { words: ['nice', 'but', 'small', 'is', 'room', 'My'], correct: 'My room is small but nice' },
      ]),
      // Speak key sentences
      speakSentence('My house is big and clean', 70),
      speakSentence('There are five rooms in my house', 70),
      speakSentence('My room is small but nice', 70),
      speakSentence('I love my house', 70),
      // Comprehension MCQ
      mcq([
        { text: "'There are five rooms in my house' — nechta xona?", options: ['3 ta', '4 ta', '5 ta', '6 ta'], correct: 2 },
        { text: '"My room is small but nice" — xona qanday?', options: ['Katta va yaxshi', 'Kichik lekin chiroyli', 'Katta lekin eski', "Kichik va yoqimsiz"], correct: 1 },
        { text: "Uyda nechta yotoqxona bor?", options: ['Bir', 'Ikki', 'Uch', 'To\'rt'], correct: 1 },
      ]),
      speakWords(
        'I want to talk about my house. My house is big and clean. There are five rooms in my house. They are: a living room, a kitchen, a bathroom, and two bedrooms. My room is small but nice. There is a bed, a table, and a chair. I love my house.',
        70,
      ),
    ],
  },

  // ── orderNumber 46 — STEP 42 — "to be: am 3-dars" (C) ───────────────────────
  {
    orderNumber: 46,
    title: 'STEP 42 — to be: am (3-dars)',
    type: LessonType.english,
    components: [
      mcq([
        {
          text: '"Men" (I) subjekti uchun "to be" fe\'lining qaysi shakli ishlatiladi?',
          options: ['am', 'is', 'are', 'be'],
          correct: 0,
        },
      ]),
      ...topicSentenceBlock({ uz: 'Men juda aqliman', en: 'I am very clever', words: ['I', 'am', 'very', 'clever'] }),
      ...topicSentenceBlock({ uz: 'Men fazogirman', en: 'I am an astronaut', words: ['I', 'am', 'an', 'astronaut'] }),
      ...topicSentenceBlock({ uz: 'Men chet eldanman', en: 'I am from abroad', words: ['I', 'am', 'from', 'abroad'] }),
      ...topicSentenceBlock({ uz: 'Men uning opasiman', en: 'I am his sister', words: ['I', 'am', 'his', 'sister'] }),
      ...phraseBlock('Menga anavi ruchkani ber', 'Give me that pen'),
      ...phraseBlock('Bu kitobni ol', 'Take this book'),
      ...phraseBlock("Kitob o'qi", 'Read a book'),
      matchPairs([
        { left: 'I love my house', right: "Men uyimni yaxshi ko'raman" },
        { left: 'My room is small but nice', right: 'Mening xonam kichik, lekin chiroyli' },
        { left: 'There are five rooms', right: 'Beshta xona bor' },
        { left: 'living room', right: 'mehmon xona' },
        { left: 'bathroom', right: 'yuvinish xonasi' },
      ]),
    ],
  },

  // ── orderNumber 47 — STEP 43 — Vocab clothes/accessories (B) ─────────────────
  {
    orderNumber: 47,
    title: "STEP 43 — Kiyim-kechak va aksessuarlar",
    type: LessonType.english,
    components: [
      ...vocabBlock({ uz: "qo'lqoplar", en: 'gloves', distractors: ['hat', 'scarf', 'boots'] }),
      ...vocabBlock({ uz: 'shlyapa', en: 'hat', distractors: ['gloves', 'scarf', 'boots'] }),
      ...vocabBlock({ uz: 'sharf', en: 'scarf', distractors: ['gloves', 'hat', 'boots'] }),
      ...vocabBlock({ uz: 'etik', en: 'boots', distractors: ['gloves', 'hat', 'scarf'] }),
      ...vocabBlock({ uz: 'oyoq kiyim', en: 'shoes', distractors: ['hat', 'scarf', 'handbag'] }),
      ...phraseBlock('Bu qancha turadi?', 'How much is it?'),
      ...phraseBlock('Bu non arzon', 'This bread is cheap'),
      ...phraseBlock('U juda qimmat', 'It is very expensive'),
      ...phraseBlock('Keling ovqatlanamiz', "Let's eat"),
      ...phraseBlock('Mana sizning qaytimingiz', 'Here is your change'),
      ...phraseBlock('Buni sotib oling', 'Buy this one'),
      matchPairs([
        { left: 'gloves', right: "qo'lqoplar" },
        { left: 'scarf', right: 'sharf' },
        { left: 'boots', right: 'etik' },
        { left: 'shoes', right: 'oyoq kiyim' },
        { left: 'handbag', right: 'sumka' },
      ]),
    ],
  },

  // ── orderNumber 48 — STEP 44 — "is 3 (am, is, are)" (C) ────────────────────
  {
    orderNumber: 48,
    title: 'STEP 44 — to be: is (3-dars)',
    type: LessonType.english,
    components: [
      mcq([
        {
          text: "Yakkabosh (he/she/it) subjekti uchun 'to be' ning qaysi shakli to'g'ri?",
          options: ['am', 'is', 'are', 'be'],
          correct: 1,
        },
      ]),
      ...topicSentenceBlock({ uz: 'U juda chiroyli', en: 'She is very beautiful', words: ['She', 'is', 'very', 'beautiful'] }),
      ...topicSentenceBlock({ uz: 'U futbolchi', en: 'He is a football player', words: ['He', 'is', 'a', 'football', 'player'] }),
      ...topicSentenceBlock({ uz: "U o'quvchi", en: 'He is a pupil', words: ['He', 'is', 'a', 'pupil'] }),
      ...topicSentenceBlock({ uz: 'U chaqaloq', en: 'She is a baby', words: ['She', 'is', 'a', 'baby'] }),
      ...phraseBlock("Buni hozir to'xtat", 'Stop it right now'),
      ...phraseBlock('Qimirlama', 'Do not move'),
      ...phraseBlock("Tinch bo'ling", 'Be quiet'),
      matchPairs([
        { left: 'gloves', right: "qo'lqoplar" },
        { left: 'hat', right: 'shlyapa' },
        { left: 'scarf', right: 'sharf' },
        { left: 'How much is it?', right: 'Bu qancha turadi?' },
        { left: 'It is very expensive', right: 'U juda qimmat' },
      ]),
    ],
  },

  // ── orderNumber 49 — STEP 45 — Personal Dev "Maktabda masxara" (E) ──────────
  {
    orderNumber: 49,
    title: 'STEP 45 — Masxara qilishganda nima qilaman',
    type: LessonType.personal_development,
    nRepetitions: 1,
    aiTutorEnabled: true,
    aiTutorContext: [
      "Sen Aloqushsan, do'stona o'zbek bola. O'zbek tilida suhbatlash.",
      '',
      "Bola hozir ushbu mavzuni o'qidi: \"Maktabda meni masxara qilishsa nima qilaman?\"",
      '',
      "Asosiy g'oya: Masxaraga javob qaytarmaslik — kuchning belgisi. O'qituvchi bilan maslahat qilish to'g'ri yo'l.",
      '',
      'Boladan 3 ta savol so\'ra (ketma-ket, javobiga qarab):',
      '1) "Bu darsdan nima o\'rganding?"',
      '2) "Agar kimdir seni masxara qilsa, birinchi navbatda nima qilasan?"',
      '3) "O\'zingning kuchingni qanday his qilasan?"',
      '',
      'Har javobini hurmat qil, kichik maslahat ber. Maksimal 2-3 jumla.',
    ].join('\n'),
    components: [
      mcq([
        {
          text: [
            "📖 SHAXSIY RIVOJLANISH — Maktabda meni masxara qilishsa nima qilaman?",
            '',
            "Maktabda ba'zilar boshqalarni kulgi qilishni yoqtiradi. Ular kimnidir semiz, kimnidir oriq, boshqasini esa ko'rinishi, kiyimi yoki hatto familiyasi uchun masxara qiladi.",
            '',
            "Agar seni masxara qilishsa — buni yuragingga yaqin olma. Chunki bu seni emas, ularning tarbiyasi yomonligini ko'rsatadi.",
            '',
            "Shu narsani bil: Ahmoq bilan teng bo'lsang, demak sen ham ahmoqsan!",
            '',
            'Agar seni masxara qilishsa:',
            '- Javob qaytarmasdan, jimgina yurib ket.',
            "- Ichingdan: 'Men kuchliman, men sendek axmoq emasman!' deb ayt.",
            "- Holat bo'yicha o'qituvchi bilan maslahat qil.",
            '',
            "YODDA TUT: Axmoqlarning bemani gaplari seni kimligingni belgilamaydi, aksincha seni vaziyatga bo'lgan munosabating seni ILMing va Tarbiyangni belgilaydi!",
            '',
            '❓ Sinfdosh seni masxara qilyapti. Eng to\'g\'ri javob qaysi?',
          ].join('\n'),
          options: [
            'Yuqori ovozda javob qaytaraman',
            "Jimgina yurib ketib, ichimdan o'zimni kuchli deb ayyman",
            'Boshqalarni ham masxara qilaman',
            "Yig'lab ketaman",
          ],
          correct: 1,
        },
      ]),
      mcq([{ text: "Masxara qilinayotganda nima qilmaslik kerak?", options: ["Jimgina ketish", "O'qituvchiga aytish", "Baland ovozda javob qaytarish", "Ichingdan kuchli his qilish"], correct: 2 }]),
      mcq([{ text: "Masxara qiluvchi kishi aslida nimani ko'rsatadi?", options: ["Seni zaifligini", "O'zining tarbiyasi yomonligini", "Sen bilan muammoni", "Hamma rozi bo'lishi kerakligini"], correct: 1 }]),
      mcq([{ text: "Masxaraga javob qaytarmaslik nima degani?", options: ["Qo'rqoqlik", "Kuchning belgisi", "Ahmoqlik", "Zaiflik"], correct: 1 }]),
      mcq([{ text: "'Ahmoq bilan teng bo'lsang, sen ham ahmoqsan' — bu nima ma'no beradi?", options: ["Hamma teng bo'lishi kerak", "Ahmoqlik qilayotgan bilan bahslashma", "Ahmoqlarni yoqtirmaslik kerak", "Barcha odamlar teng"], correct: 1 }]),
      mcq([{ text: "Masxara qilinganingda o'qituvchiga murojaat qilish:", options: ["Zaiflik belgisi", "Yolg'onchilik", "To'g'ri va aqlli qadam", "Keraksiz harakat"], correct: 2 }]),
      mcq([{ text: "Kimdir seni familiyangga qarab masxara qildi. Eng to'g'ri harakat:", options: ["Familiyangni o'zgartirish", "Uni katta ovoz bilan tanbeh qilish", "Jimgina yurib ketish va o'qituvchiga aytish", "Do'stlaringni yig'ish"], correct: 2 }]),
      mcq([{ text: "Ichingdan 'Men kuchliman!' deyish nima beradi?", options: ["Hech narsa", "O'z-o'ziga ishonch va tinchlık", "Boshqalarga isbotlash imkoniyati", "Masxarani to'xtatadi"], correct: 1 }]),
      mcq([{ text: "Masxara qiluvchining so'zlari seni kimligingni belgilaydimi?", options: ["Ha, ular to'g'ri", "Yo'q, seni munosabating belgilaydi", "Ba'zida ha", "Doim ha"], correct: 1 }]),
      mcq([{ text: "Do'sting masxara qilinyapti. Sen nima qilishing kerak?", options: ["Kulgiga qo'shilish", "Hech narsa qilmaslik", "Unga yordam berish va o'qituvchiga aytish", "Masxara qiluvchiga javob berish"], correct: 2 }]),
      mcq([{ text: "Seni kiyiming uchun masxara qilishdi. Bu nima degani?", options: ["Kiyimingni o'zgartirish kerak", "Sen haqiqatan ham yomonsan", "Ularning tarbiyasi yetishmasligi", "Sen ular bilan muammo borligingni"], correct: 2 }]),
      mcq([{ text: "Masxarani to'xtatishning eng yaxshi usuli nima?", options: ["Qattiq javob berish", "Zo'r kiyim kiyish", "Ularning so'zlariga e'tibor bermaslik va katta bo'lib qolish", "Boshqa maktabga o'tish"], correct: 2 }]),
      mcq([{ text: "Masxaraga munosabat kimni belgilaydi?", options: ["Masxara qiluvchini", "Sening ILMing va Tarbiyangni", "O'qituvchini", "Ota-onangni"], correct: 1 }]),
      mcq([{ text: "'Bemani gap' so'zi nima ma'noda?", options: ["Juda muhim gap", "Ahamiyatsiz, befoyda gap", "Do'stona gap", "Maslahat"], correct: 1 }]),
      mcq([{ text: "Masxara qiluvchi kishi nima xohlaydi?", options: ["Seni baxtli qilish", "Seni xafa qilish va reaksiyangni ko'rish", "Seni o'qishga undash", "Sening do'sting bo'lish"], correct: 1 }]),
      mcq([{ text: "O'qituvchiga aytish qachon to'g'ri?", options: ["Hech qachon", "Faqat jismoniy hujum bo'lganda", "Har qanday masxara holatlarda", "Faqat katta muammolarda"], correct: 2 }]),
      mcq([{ text: "Masxaraga javob bermaslik uchun nima yordam beradi?", options: ["Kuchli bo'lib ko'rinish", "Ichingdan o'zingni kuchli deb his qilish", "Boshqalardan madad so'rash", "Tezda u yerdan chiqib ketish"], correct: 1 }]),
      mcq([{ text: "Boshqalarni masxara qiluvchi odamning kamchiligi nima?", options: ["Juda aqlli", "Tarbiyasi yetishmasligi", "Juda jasur", "Ko'p bilibdi"], correct: 1 }]),
      mcq([{ text: "Qaysi fikr sog'lom?", options: ["'Masxaraga javob bermasam — zaifman'", "'Men jimgina ketaman — bu mening kuchim'", "'Baland ovozda javob bersam — kuchliман'", "'Ularning so'zi to'g'ri bo'lishi mumkin'"], correct: 1 }]),
      mcq([{ text: "Masxaradan keyin sog'lom his-tuyg'u:", options: ["G'azab va qasos olish istagi", "Xafa bo'lish va yig'lash", "O'z kuchingni his qilib, oldinga qadam tashlash", "Hamma bilan munosabatni uzish"], correct: 2 }]),
    ],
  },

  // ── orderNumber 50 — STEP 46 — Vocab greetings/phrases (B) ──────────────────
  {
    orderNumber: 50,
    title: 'STEP 46 — Salomlashish va iboralar',
    type: LessonType.english,
    components: [
      ...vocabBlock({ uz: 'salomlashuv', en: 'greeting', distractors: ['farewell', 'question', 'answer'] }),
      ...vocabBlock({ uz: 'Ahvolingiz yaxshimi?', en: 'How are you?', distractors: ['Good morning', 'Goodbye', 'Thank you'] }),
      ...vocabBlock({ uz: 'Men yaxshiman', en: 'I am fine', distractors: ['I am tired', 'I am busy', 'I am happy'] }),
      ...vocabBlock({ uz: 'Men yaxshi emasman', en: 'I am not good', distractors: ['I am fine', 'I am great', 'I am okay'] }),
      ...vocabBlock({ uz: "Men zo'rman", en: 'I am great', distractors: ['I am fine', 'I am okay', 'I am well'] }),
      ...phraseBlock('davom eting', 'Go on'),
      ...phraseBlock('davom eting', 'Keep going'),
      ...phraseBlock('eshikni oching', 'Open the door'),
      ...phraseBlock('Eshikni yoping', 'Close the door'),
      ...phraseBlock("Chiroqni o'chiring", 'Turn off the light'),
      ...phraseBlock("Chiroqni yoqing", 'Turn on the light'),
      matchPairs([
        { left: 'She is very beautiful', right: 'U juda chiroyli' },
        { left: 'Stop it right now', right: "Buni hozir to'xtat" },
        { left: 'Be quiet', right: "Tinch bo'ling" },
        { left: 'boots', right: 'etik' },
        { left: 'shoes', right: 'oyoq kiyim' },
      ]),
    ],
  },

  // ── orderNumber 51 — STEP 47 — "are 3 (am, is, are)" (C) ───────────────────
  {
    orderNumber: 51,
    title: 'STEP 47 — to be: are (3-dars)',
    type: LessonType.english,
    components: [
      mcq([
        {
          text: "Ko'plik subject (we/you/they, ikki va undan ko'p ism) uchun 'to be'ning to'g'ri shakli qaysi?",
          options: ['am', 'is', 'are', 'be'],
          correct: 2,
        },
      ]),
      ...topicSentenceBlock({ uz: "Biz eng yaxshi do'stlarmiz", en: 'We are best friends', words: ['We', 'are', 'best', 'friends'] }),
      ...topicSentenceBlock({ uz: 'Sen dangasasan', en: 'You are lazy', words: ['You', 'are', 'lazy'] }),
      ...topicSentenceBlock({ uz: 'Ular murabbiylar', en: 'They are coaches', words: ['They', 'are', 'coaches'] }),
      ...topicSentenceBlock({ uz: 'Ular talabalar', en: 'They are students', words: ['They', 'are', 'students'] }),
      ...phraseBlock("Stulga o'tiring", 'Sit on the chair'),
      ...phraseBlock('Oshxonani tozala', 'Clean the kitchen'),
      ...phraseBlock('Derazani och', 'Open the window'),
      matchPairs([
        { left: 'I am fine', right: 'Men yaxshiman' },
        { left: 'I am great', right: "Men zo'rman" },
        { left: 'Open the door', right: 'eshikni oching' },
        { left: 'Turn on the light', right: "Chiroqni yoqing" },
        { left: 'greeting', right: 'salomlashuv' },
      ]),
    ],
  },

  // ── orderNumber 52 — STEP 48 — Vocab time greetings (B) ─────────────────────
  {
    orderNumber: 52,
    title: "STEP 48 — Vaqt bo'yicha salomlashish",
    type: LessonType.english,
    components: [
      ...vocabBlock({ uz: 'xayrli tong', en: 'good morning', distractors: ['good afternoon', 'good evening', 'good night'] }),
      ...vocabBlock({ uz: 'Salom', en: 'Hello', distractors: ['Goodbye', 'Good night', 'Thank you'] }),
      ...vocabBlock({ uz: 'xayrli kun', en: 'good afternoon', distractors: ['good morning', 'good evening', 'good night'] }),
      ...vocabBlock({ uz: 'xayrli kech', en: 'good evening', distractors: ['good morning', 'good afternoon', 'good night'] }),
      ...vocabBlock({ uz: 'xayrli tun', en: 'good night', distractors: ['good morning', 'good afternoon', 'good evening'] }),
      ...phraseBlock('Men tayyorman', 'I am ready'),
      ...phraseBlock('Keling, uyga', "Let's go home"),
      ...phraseBlock('Menga ergashing', 'Follow me'),
      matchPairs([
        { left: 'We are best friends', right: "Biz eng yaxshi do'stlarmiz" },
        { left: 'You are lazy', right: 'Sen dangasasan' },
        { left: 'Sit on the chair', right: "Stulga o'tiring" },
        { left: 'Clean the kitchen', right: 'Oshxonani tozala' },
        { left: 'Open the window', right: 'Derazani och' },
      ]),
    ],
  },

  // ── orderNumber 53 — STEP 49 — "am not 1" (C) ──────────────────────────────
  {
    orderNumber: 53,
    title: "STEP 49 — to be: am not (1-dars)",
    type: LessonType.english,
    components: [
      mcq([
        {
          text: "'Men' (I) uchun inkor shaklini ifodalash uchun qaysi birikmа to'g'ri?",
          options: ['I is not', 'I am not', 'I are not', 'I not am'],
          correct: 1,
        },
      ]),
      ...topicSentenceBlock({ uz: 'Men Angliyalik emasman', en: 'I am not English', words: ['I', 'am', 'not', 'English'] }),
      ...topicSentenceBlock({ uz: "Men o'n yosh emasman", en: 'I am not ten years old', words: ['I', 'am', 'not', 'ten', 'years', 'old'] }),
      ...topicSentenceBlock({ uz: 'Men bu shahardanmas emasman', en: 'I am not from this city', words: ['I', 'am', 'not', 'from', 'this', 'city'] }),
      ...topicSentenceBlock({ uz: 'Men qari emasman', en: 'I am not old', words: ['I', 'am', 'not', 'old'] }),
      ...phraseBlock("Ehtiyot bo'l", 'Be careful'),
      ...phraseBlock('Menga yordam ber', 'Help me'),
      ...phraseBlock("Ehtiyot bo'l", 'Look out'),
      matchPairs([
        { left: 'good morning', right: 'xayrli tong' },
        { left: 'good evening', right: 'xayrli kech' },
        { left: 'good night', right: 'xayrli tun' },
        { left: "Let's go home", right: 'Keling, uyga' },
        { left: 'Follow me', right: 'Menga ergashing' },
      ]),
    ],
  },

  // ── orderNumber 54 — STEP 50 — Personal Dev "O'zimga ishonish" (E) ──────────
  {
    orderNumber: 54,
    title: "STEP 50 — O'zimga ishonish",
    type: LessonType.personal_development,
    nRepetitions: 1,
    aiTutorEnabled: true,
    aiTutorContext: [
      "Sen Aloqushsan, do'stona o'zbek bola. O'zbek tilida suhbatlash.",
      '',
      "Bola hozir ushbu mavzuni o'qidi: \"Men o'zimga ishonmayapman — nima qilay?\"",
      '',
      "Asosiy g'oya: Ishonch harakat bilan quriladi. Mayda qadamlar va o'z-o'zini maqtash — ishonchni oshiradi.",
      '',
      'Boladan 3 ta savol so\'ra (ketma-ket, javobiga qarab):',
      '1) "Bu darsdan nima o\'rganding?"',
      "2) \"O'zingga ishonch beruvchi mayda qadam nima bo'lishi mumkin?\"",
      "3) \"O'zingni maqtab ayta oladigan bir narsang bormi?\"",
      '',
      'Har javobini hurmat qil, kichik maslahat ber. Maksimal 2-3 jumla.',
    ].join('\n'),
    components: [
      mcq([
        {
          text: [
            "📖 SHAXSIY RIVOJLANISH — Men o'zimga ishonmayapman — nima qilay?",
            '',
            "Ba'zida biror ishni qilish oldidan o'ylaymiz: 'Men eplolmayman', 'Hamma mendan zo'r', 'Men xato qilaman...' — deb. Bu — o'ziga ishonmaslik.",
            '',
            "Lekin bir sirni aytsam: hamma zo'rlar ham avval 100% ishonmagan! Ular ham boshlaganda qo'rqishgan, shubhalanishgan. Keyin nima qilishgan? Shunchaki qayta va qayta urinib ko'rishgan!",
            '',
            "Agar sen ham o'zingga ishonmayotgan bo'lsang, bu — endi boshlayapsan degani.",
            '',
            "O'zingga ishonish uchun:",
            "- Mayda ishlarni boshlagin — va uddalaganingda o'zingni maqtagin.",
            "- Har kuni o'zingga: 'Men harakat qilyapman, men o'sayapman!' deb ayt.",
            "- O'zingni boshqalar bilan solishtirma. Sen va faqat sen!",
            '',
            "Unutma: ishonch — tug'ilib qolmaydi, harakat bilan quriladi! Bugun kichik bir qadam tashla — ertaga o'zingga ishonch bilan qaraysan!",
            '',
            "❓ Sen yangi narsani o'rganmoqchisan, lekin 'eplolmayman' deb qo'rqayapsan. Eng to'g'ri qadam:",
          ].join('\n'),
          options: [
            "Voz kechaman, baribir bo'lmaydi",
            "Mayda qadamlar bilan boshlayman va har yutuqni o'zimni maqtayman",
            "Boshqalarni kuzataman, faqat ulardek qila olsam boshlayman",
            "Bir vaqtning o'zida katta harakat qilaman",
          ],
          correct: 1,
        },
      ]),
      mcq([{ text: "Ishonch qanday quriladi?", options: ["Tug'ilib qoladi", "Harakat bilan", "Boshqalar aytsa", "Vaqt o'tishi bilan o'z-o'zidan"], correct: 1 }]),
      mcq([{ text: "O'zimga ishonmasligim nima degani?", options: ["Men hech qachon o'sgolmayman", "Men harakat qilishni endigina boshlamoqdaman", "Men dangasaman", "Men qobiliyatsizman"], correct: 1 }]),
      mcq([{ text: "Zo'r odamlar ham avval nima his qilishgan?", options: ["Hech qachon qo'rqmagan", "Qo'rqishgan va shubhalanishgan", "Hamma narsa ular uchun oson bo'lgan", "Boshqalar ularga ishongan"], correct: 1 }]),
      mcq([{ text: "Mayda ishni uddalaganda nima qilish kerak?", options: ["Hech narsa", "O'zingni maqtash", "Boshqalarga aytish", "Kattaroq ish qilish"], correct: 1 }]),
      mcq([{ text: "Nima uchun o'zingni boshqalar bilan solishtirib bo'lmaydi?", options: ["Chunki hamma teng", "Chunki har kim o'z yo'lida, o'z vaqtida rivojlanadi", "Chunki solishtirib bo'lmaydi", "Chunki boshqalar yaxshiroq"], correct: 1 }]),
      mcq([{ text: "Har kuni o'zingga qanday gap aytish foydali?", options: ["'Men eplolmayman'", "'Hamma mendan zo'r'", "'Men harakat qilyapman, men o'sayapman!'", "'Ertaga boshlayman'"], correct: 2 }]),
      mcq([{ text: "Ishonch yo'qligi — bu nima degani?", options: ["Sen yomon odamsan", "Sen zaifsan", "Endi boshlayapsan — bu normal holat", "Sen hech qachon muvaffaqiyatga erishib bo'lmaysan"], correct: 2 }]),
      mcq([{ text: "Kichik qadam tashlagandan keyin nima bo'ladi?", options: ["Hech narsa o'zgarmaydi", "Ertaga o'zingga ishonch bilan qaraysan", "Hammaga isbotlaysan", "Katta muammolar hal bo'ladi"], correct: 1 }]),
      mcq([{ text: "Do'sting yangi sport qilishdan qo'rqyapti. Sen unga nima deysang?", options: ["'Qo'rqsang qo'ya qol'", "'Kichik qadam bilan boshlasang bo'ladi'", "'Sen buni qila olmaysan'", "'Boshqa narsa qil'"], correct: 1 }]),
      mcq([{ text: "O'z-o'zini maqtash nima uchun zarur?", options: ["Kekkayish uchun", "Boshqalar oldida zo'r ko'rinish uchun", "O'z-o'ziga ishonchni mustahkamlash uchun", "O'qituvchini xursand qilish uchun"], correct: 2 }]),
      mcq([{ text: "Birinchi urinishda natija chiqmadi. Nima qilish kerak?", options: ["Umuman to'xtatish", "Boshqalardan ko'chirib olish", "Qayta va qayta urinib ko'rish", "Natija chiqmaganini yashirish"], correct: 2 }]),
      mcq([{ text: "Sog'lom o'z-o'ziga baho berish qanday?", options: ["'Men hammadan yaxshiman'", "'Men hammadan yomonman'", "'Men kecha qilganidan bugun yaxshiroq qildim'", "'Men o'rganishga muhtoj emasman'"], correct: 2 }]),
      mcq([{ text: "Ishonchni oshirishning birinchi qadami:", options: ["Katta maqsad qo'yish", "Boshqalarni ko'rish", "Mayda, uddalab bo'ladigan ish boshlash", "Faqat kutish"], correct: 2 }]),
      mcq([{ text: "Qaysi gap to'g'ri?", options: ["Ishonch faqat aqlli odamlarda bo'ladi", "Ishonch harakat qilgan sari ortadi", "Ishonch boshqalar beradi", "Ishonch tug'ilgandan bor bo'ladi"], correct: 1 }]),
      mcq([{ text: "Sen biror narsadan qo'rqsang, eng yaxshi harakat:", options: ["Qo'rquvni yashirish", "Kutish va qo'rquv o'tib ketishini ko'rish", "Kichik qadam bilan shu narsani sinab ko'rish", "Boshqa narsa qilish"], correct: 2 }]),
      mcq([{ text: "O'z-o'ziga ishonch berish uchun qaysi ibora foydali?", options: ["'Baribir bo'lmaydi'", "'Harakat qilyapman, o'sayapman!'", "'Boshqalar nima deydi?'", "'Keyinroq qilaman'"], correct: 1 }]),
      mcq([{ text: "Nega zo'r odamlar ham avval qo'rqishgan?", options: ["Chunki ular zaif edi", "Chunki yangi narsa boshlash doim shunday his qildiradi", "Chunki hech kim ularga yordam bermadi", "Chunki ular aqli past edi"], correct: 1 }]),
      mcq([{ text: "Bugun kichik qadam tashlash nima uchun muhim?", options: ["Ertaga dam olish uchun", "Ertaga o'zingga ishonch bilan qarash uchun", "Boshqalarga ko'rsatish uchun", "Tez natija ko'rish uchun"], correct: 1 }]),
      mcq([{ text: "Qaysi holat o'z-o'ziga ishonchni oshiradi?", options: ["Hech narsa qilmaslik va kutish", "Kichik muvaffaqiyatlarni nishonlash va o'z-o'zini maqtash", "Faqat katta yutuqlarga e'tibor berish", "Boshqalardan qolishmaslik"], correct: 1 }]),
    ],
  },

  // ── orderNumber 55 — STEP 51 — Daily Routine (Composition — Archetype D) ────
  {
    orderNumber: 55,
    title: 'STEP 51 — My daily routine',
    type: LessonType.english,
    aiTutorEnabled: true,
    aiTutorContext: [
      'You are a friendly English coach for a young Uzbek learner.',
      "The student just composed a 'My daily routine' paragraph.",
      'Ask 3 short follow-up questions in English, one at a time, to extend the topic.',
      'Be encouraging. Keep responses to 1-2 sentences.',
      'English only — they are practising English.',
    ].join('\n'),
    components: [
      fillBlank('I want to talk about my daily ___.', 'routine', ['routine', 'life', 'schedule', 'day']),
      fillBlank('I wake up at ___ o\'clock in the morning.', 'six', ['five', 'six', 'seven', 'eight']),
      fillBlank('I wash my face and brush my ___.', 'teeth', ['teeth', 'hair', 'hands', 'face']),
      fillBlank('I have ___ at seven.', 'breakfast', ['breakfast', 'lunch', 'dinner', 'snack']),
      fillBlank('After breakfast, I go to ___.', 'school', ['school', 'park', 'work', 'gym']),
      fillBlank('I study ___ at school.', 'English', ['English', 'Math', 'Science', 'Music']),
      fillBlank('After school, I do my ___.', 'homework', ['homework', 'chores', 'exercise', 'reading']),
      fillBlank('I go to bed at ___ o\'clock.', 'nine', ['eight', 'nine', 'ten', 'eleven']),
      // Translate key sentences
      translate('Men kundalik tartibim haqida gapirmoqchiman.', 'I want to talk about my daily routine'),
      translate("Men ertalab soat oltida uyg'onaman.", 'I wake up at six o\'clock in the morning'),
      translate('Men yuzimni yuvib, tishlarimni tozalayman.', 'I wash my face and brush my teeth'),
      translate('Men soat yettida nonushta qilaman.', 'I have breakfast at seven'),
      translate("Men maktabga boraman.", 'I go to school'),
      translate('Men maktabda ingliz tilini o\'rganaman.', 'I study English at school'),
      translate("Maktabdan keyin uy vazifamni bajaraman.", 'I do my homework'),
      translate("Men soat to'qqizda yotaman.", 'I go to bed at nine o\'clock'),
      // Word-order
      wordOrder([
        { words: ['routine', 'daily', 'my', 'about', 'talk', 'to', 'want', 'I'], correct: 'I want to talk about my daily routine' },
        { words: ['six', 'at', 'morning', 'the', 'in', 'o\'clock', 'up', 'wake', 'I'], correct: 'I wake up at six o\'clock in the morning' },
        { words: ['school', 'to', 'go', 'I', 'breakfast', 'After'], correct: 'After breakfast I go to school' },
        { words: ['nine', 'bed', 'to', 'go', 'I', 'at', "o'clock"], correct: "I go to bed at nine o'clock" },
      ]),
      // Speak key sentences
      speakSentence('I wake up at six o\'clock in the morning', 70),
      speakSentence('I wash my face and brush my teeth', 70),
      speakSentence('I have breakfast at seven', 70),
      speakSentence('I go to bed at nine o\'clock', 70),
      // Comprehension MCQ
      mcq([
        { text: "'I wake up at six o'clock' — qachon uyg'onadi?", options: ['Soat 5 da', 'Soat 6 da', 'Soat 7 da', 'Soat 8 da'], correct: 1 },
        { text: "'I brush my teeth' — nima qiladi?", options: ['Yuzini yuvadi', 'Sochlarini taraydi', 'Tishlarini tozalaydi', "Nonushta qiladi"], correct: 2 },
        { text: "'After school, I do my homework' — maktabdan keyin nima qiladi?", options: ['Dam oladi', "O'ynaydi", 'Uy vazifasini bajaradi', 'Ovqat yeydi'], correct: 2 },
      ]),
      speakWords(
        "I want to talk about my daily routine. I wake up at six o'clock in the morning. I wash my face and brush my teeth. I have breakfast at seven. After breakfast, I go to school. I study English at school. After school, I do my homework. After homework, I take a break and play. I go to bed at nine o'clock.",
        70,
      ),
    ],
  },

  // ── orderNumber 57 — STEP 52 — Vocab kitchen (B) ────────────────────────────
  {
    orderNumber: 57,
    title: 'STEP 52 — Oshxona buyumlari (1)',
    type: LessonType.english,
    components: [
      ...vocabBlock({ uz: 'oshxona', en: 'kitchen', distractors: ['bathroom', 'bedroom', 'living room'] }),
      ...vocabBlock({ uz: 'sanchqi', en: 'fork', distractors: ['spoon', 'knife', 'bowl'] }),
      ...vocabBlock({ uz: 'qoshiq', en: 'spoon', distractors: ['fork', 'knife', 'bowl'] }),
      ...vocabBlock({ uz: 'kosa', en: 'bowl', distractors: ['fork', 'spoon', 'plate'] }),
      ...vocabBlock({ uz: 'tova', en: 'frying pan', distractors: ['bowl', 'plate', 'spoon'] }),
      matchPairs([
        { left: 'kitchen', right: 'oshxona' },
        { left: 'fork', right: 'sanchqi' },
        { left: 'spoon', right: 'qoshiq' },
        { left: 'bowl', right: 'kosa' },
        { left: 'frying pan', right: 'tova' },
      ]),
      ...vocabBlock({ uz: 'likopcha', en: 'plate', distractors: ['bowl', 'fork', 'spoon'] }),
      ...vocabBlock({ uz: 'taxtakach', en: 'chopping board', distractors: ['plate', 'bowl', 'frying pan'] }),
      matchPairs([
        { left: 'plate', right: 'likopcha' },
        { left: 'chopping board', right: 'taxtakach' },
        { left: 'fork', right: 'sanchqi' },
        { left: 'spoon', right: 'qoshiq' },
        { left: 'bowl', right: 'kosa' },
      ]),
      ...phraseBlock('Men akangizni taniyman', 'I know your brother'),
      ...phraseBlock('Men uni tanimayman', 'I do not know him'),
      ...phraseBlock('Seni tushunaman', 'I understand'),
      ...phraseBlock('Men qadamimni tugatdim', 'I finished my steps'),
      ...phraseBlock('Men inglizcha gapira olaman', 'I can speak English'),
      ...phraseBlock("Men aqlli o'quvchiman", 'I am a pupil'),
      mcq([
        { text: "'Fork' o'zbek tilida nima?", options: ['qoshiq', 'sanchqi', 'kosa', 'likopcha'], correct: 1 },
        { text: "'Tova' inglizcha nima?", options: ['bowl', 'plate', 'frying pan', 'spoon'], correct: 2 },
        { text: "'I know your brother' — bu nima ma'noda?", options: ["Men ukangizni bilaman", "Men akangizni taniyman", "Men ukangizni ko'rdim", "U mening akam"], correct: 1 },
      ]),
    ],
  },

  // ── orderNumber 58 — STEP 53 — "is not" (C) ─────────────────────────────────
  {
    orderNumber: 58,
    title: 'STEP 53 — to be: is not (1-dars)',
    type: LessonType.english,
    components: [
      mcq([
        {
          text: "He/she/it uchun inkor shaklini ifodalash uchun qaysi birikmа to'g'ri?",
          options: ['he not is', 'he is not', 'he are not', 'he am not'],
          correct: 1,
        },
      ]),
      ...topicSentenceBlock({ uz: 'U 17 da emas', en: 'He is not 17', words: ['He', 'is', 'not', '17'] }),
      ...topicSentenceBlock({ uz: 'U aktrisa emas', en: 'She is not an actress', words: ['She', 'is', 'not', 'an', 'actress'] }),
      ...topicSentenceBlock({ uz: 'U fil emas', en: 'It is not an elephant', words: ['It', 'is', 'not', 'an', 'elephant'] }),
      ...topicSentenceBlock({ uz: "U sizning o'yinchog'ingiz emas", en: 'It is not your toy', words: ['It', 'is', 'not', 'your', 'toy'] }),
      ...phraseBlock('Bu mening ruchkam', 'This is my pen'),
      ...phraseBlock('Menga qalamingni ber', 'Give me your pencil'),
      ...phraseBlock('Lineyka qayerda?', 'Where is the ruler?'),
      matchPairs([
        { left: 'He is not 17', right: 'U 17 da emas' },
        { left: 'She is not an actress', right: 'U aktrisa emas' },
        { left: 'It is not an elephant', right: 'U fil emas' },
        { left: 'This is my pen', right: 'Bu mening ruchkam' },
        { left: 'Where is the ruler?', right: 'Lineyka qayerda?' },
      ]),
      mcq([
        { text: "'She is not an actress' — bu to'g'ri gap?", options: ['Ha', "Yo'q, 'she are not'", "Yo'q, 'she am not'", "Yo'q, 'she not is'"], correct: 0 },
        { text: "Quyidagilardan qaysi biri to'g'ri ifodalangan?", options: ['It am not a cat', 'It are not a cat', 'It is not a cat', 'It not is a cat'], correct: 2 },
        { text: "'It is not your toy' — bu nima ma'noda?", options: ["Bu mening o'yinchog'im", "Bu sizning o'yinchog'ingiz emas", "Bu o'yinchog'", "U o'yinchog' emas"], correct: 1 },
      ]),
    ],
  },

  // ── orderNumber 59 — STEP 54 — Vocab kitchen tools (B) ──────────────────────
  {
    orderNumber: 59,
    title: 'STEP 54 — Oshxona buyumlari (2)',
    type: LessonType.english,
    components: [
      ...vocabBlock({ uz: "qirg'ich", en: 'grater', distractors: ['cooker', 'knife', 'fridge'] }),
      ...vocabBlock({ uz: 'gaz plita', en: 'cooker', distractors: ['grater', 'knife', 'fridge'] }),
      ...vocabBlock({ uz: 'pichoq', en: 'knife', distractors: ['grater', 'cooker', 'fridge'] }),
      ...vocabBlock({ uz: 'muzlatgich', en: 'fridge', distractors: ['grater', 'cooker', 'knife'] }),
      ...phraseBlock('Sumkangni och', 'Open your backpack'),
      ...phraseBlock('Mening daftarim bor', 'I have a notebook'),
      ...phraseBlock("O'chirg'ich kichkina", 'The eraser is small'),
      matchPairs([
        { left: 'grater', right: "qirg'ich" },
        { left: 'cooker', right: 'gaz plita' },
        { left: 'knife', right: 'pichoq' },
        { left: 'fridge', right: 'muzlatgich' },
        { left: 'Open your backpack', right: 'Sumkangni och' },
      ]),
      mcq([
        { text: "'Muzlatgich' inglizcha nima?", options: ['cooker', 'grater', 'fridge', 'knife'], correct: 2 },
        { text: "'Knife' o'zbek tilida nima?", options: ['pichoq', "qirg'ich", 'gaz plita', 'muzlatgich'], correct: 0 },
        { text: "'I have a notebook' — bu nima ma'noda?", options: ['Menga daftar ber', 'Mening daftarim bor', 'Menda daftar yo\'q', 'Bu mening daftarim'], correct: 1 },
      ]),
    ],
  },

  // ── orderNumber 60 — STEP 55 — Personal Dev "Qo'rqmaslikni o'rganish" (E) ───
  {
    orderNumber: 60,
    title: "STEP 55 — Qo'rqmaslikni o'rganish",
    type: LessonType.personal_development,
    nRepetitions: 1,
    aiTutorEnabled: true,
    aiTutorContext: [
      "Sen Aloqushsan, do'stona o'zbek bola. O'zbek tilida suhbatlash.",
      '',
      "Bola hozir ushbu mavzuni o'qidi: \"Qo'rqmaslikni qanday o'rganaman?\"",
      '',
      "Asosiy g'oya: Qo'rqish — yomon emas, bu signal. Lekin unga ergashish shart emas. Kichik qadam bilan boshlash — eng yaxshi yo'l.",
      '',
      "Boladan 3 ta savol so'ra (ketma-ket, javobiga qarab):",
      "1) \"Bu darsdan nima o'rganding?\"",
      "2) \"Nimadan qo'rqasan va birinchi kichik qadaming nima bo'lishi mumkin?\"",
      "3) \"Qo'rqib turgan bo'lsa ham harakat qilish nima uchun muhim?\"",
      '',
      'Har javobini hurmat qil, kichik maslahat ber. Maksimal 2-3 jumla.',
    ].join('\n'),
    components: [
      mcq([
        {
          text: [
            "📖 SHAXSIY RIVOJLANISH — Qo'rqmaslikni qanday o'rganaman?",
            '',
            "Biror marta biror ish qilishdan oldin qo'rqqanmisan? Masalan, qo'l ko'tarish, sahnaga chiqish yoki birinchi bo'lib gapirish... Men ham shunaqa edim.",
            '',
            "Lekin bir kuni shuni tushundim: qo'rqish — bu yomon emas. Bu shunchaki miyamizdagi ogohlantirish. Xuddi signaldek. Ammo men unga ergashishim shart emas!",
            '',
            "Endi nima qilaman? Qo'rqayotgan ishimni kichkina qadam bilan boshlayman. Masalan, sinf oldida gapirishdan qo'rqamanmi? Unda birinchi o'rinda o'zimga: 'Faqat 1 daqiqa gapiraman', — deyman. Shunaqa qilib asta-sekin o'zimni o'rgataman. Keyin oila a'zolarim oldida gapiriman undan keyin do'stlarim oldiga chiqib gapiraman...",
            '',
            "Shuni unutmang: qo'rqmaslar — bu jasurlar emas, balki qo'rqib turgan bo'lsa ham harakat qilganlar!",
            '',
            "Keling, bugun o'zimizga bitta savol beraylik: 'Men nimadan qo'rqyapman va uni yengish uchun birinchi qadamim nima bo'ladi?'",
            '',
            "❓ Qo'rqayotganingda nima qilish kerak?",
          ].join('\n'),
          options: [
            "Qo'rquvdan to'liq xalos bo'lguncha kutish",
            "Kichik qadam bilan boshlash",
            "Hech narsa qilmaslik va qo'rquvni yashirish",
            "Boshqalardan yordam so'rash va o'zing hech narsa qilmaslik",
          ],
          correct: 1,
        },
      ]),
      mcq([{ text: "Qo'rqish — bu nima?", options: ["Zaiflikning belgisi", "Miyamizdagi ogohlantirish signali", "Yomon xarakter", "Harakat qilmaslik sababi"], correct: 1 }]),
      mcq([{ text: "Qo'rqayotgan ishni boshlashning eng yaxshi usuli:", options: ["Butunlay voz kechish", "Boshqa odam boshlaguncha kutish", "Kichkina qadam bilan boshlash", "Bir daqiqada hammasini qilish"], correct: 2 }]),
      mcq([{ text: "Jasur odamlar qo'rqmasmi?", options: ["Ha, ular hech qachon qo'rqmaydi", "Yo'q, ular qo'rqib tursa ham harakat qiladi", "Faqat katta odamlar qo'rqmaydi", "Faqat bolalar qo'rqadi"], correct: 1 }]),
      mcq([{ text: "Sinf oldida gapirishdan qo'rqsang, birinchi qadam nima bo'lishi mumkin?", options: ["Sinfga kirmaslik", "'Faqat 1 daqiqa gapiraman' deb o'zimga aytish", "Boshqa dars tanlash", "Umuman gapirmaslik"], correct: 1 }]),
      mcq([{ text: "Qo'rquvga ergashish shart emas deganda nima tushuniladi?", options: ["Qo'rquvni his qilmaslik", "Qo'rqsang ham to'xtab qolmaslik", "Qo'rquvdan qochish", "Qo'rquv yo'q deb o'ylash"], correct: 1 }]),
      mcq([{ text: "Asta-sekin o'zimni o'rgatish uchun qanday tartib yaxshi?", options: ["Darhol hammani oldida gapirish", "Oila — do'stlar — sinf tartibida mashq qilish", "Hech qachon mashq qilmaslik", "Faqat o'zim bilan gapirish"], correct: 1 }]),
      mcq([{ text: "Do'sting sahna qo'rquvidan qo'rqyapti. Unga qanday maslahat berasan?", options: ["'Sen hech qachon qila olmaysan'", "'Faqat 1 daqiqa chiqib ko'r, keyin ko'ramiz'", "'Umuman chiqma'", "'Boshqa biror narsa qil'"], correct: 1 }]),
      mcq([{ text: "Qo'rquv signalga o'xshaydi — bu nima ma'noni anglatadi?", options: ["Signal paydo bo'lsa, to'xtab qolish kerak", "Signal xavf haqida ogohlantiradi, lekin siz qarorni o'zingiz qabul qilasiz", "Signalni o'chirib qo'yish kerak", "Signal doim to'g'ri"], correct: 1 }]),
      mcq([{ text: "Qo'rquvni yengish uchun birinchi qadam qaysi?", options: ["Qo'rquvni butunlay yo'q qilish", "Kichik, bajarish mumkin bo'lgan harakatni tanlash", "Boshqa odam siz o'rnida qilguncha kutish", "Uzoq vaqt fikrlash"], correct: 1 }]),
      mcq([{ text: "Qo'l ko'tarishdan qo'rqsang, kichik qadam nima?", options: ["Hech qachon qo'l ko'tarmaslik", "Birinchi uyda mashq qilish, keyin sinfda ko'tarish", "Darhol hammadan oldin qo'l ko'tarish", "O'qituvchidan so'ramaslik"], correct: 1 }]),
      mcq([{ text: "'Qo'rqmaslikni o'rganish' darsining asosiy g'oyasi nima?", options: ["Qo'rquvni his qilmaslik", "Qo'rqib tursa ham kichik qadam bilan harakat qilish", "Qo'rquv — zaiflik", "Jasurlar hech qachon qo'rqmaydi"], correct: 1 }]),
      mcq([{ text: "Nima uchun kichik qadamlar muhim?", options: ["Ular katta qadamlardan yaxshiroq", "Ular qo'rquvni asta-sekin pasaytiradi va ishonch oshiradi", "Ular tezroq natija beradi", "Ular hech narsani o'zgartirmaydi"], correct: 1 }]),
      mcq([{ text: "Birinchi bo'lib gapirish qo'rquviga qarshi eng yaxshi harakat:", options: ["Hech qachon birinchi gapirmaslik", "Kichik guruhda birinchi bo'lib gapirish bilan boshlash", "Faqat o'qituvchi so'raganda gapirish", "Boshqalarni kuzatib o'tirish"], correct: 1 }]),
      mcq([{ text: "Qo'rquv bilan kurashishda o'zimga aytishim mumkin bo'lgan eng yaxshi gap:", options: ["'Men bunga layoqatli emasman'", "'Faqat bir bor urinib ko'raman'", "'Bu menga tegishli emas'", "'Boshqalar qilsin'"], correct: 1 }]),
      mcq([{ text: "Shu darsdan so'ng o'zingga beradigan savol qaysi?", options: ["'Qachon bu o'tib ketadi?'", "'Men nimadan qo'rqyapman va birinchi qadamim nima?'", "'Kim menga yordam beradi?'", "'Nima uchun men qo'rqaman?'"], correct: 1 }]),
      mcq([{ text: "Qo'rquvni his qilish:", options: ["Har doim yomon", "Tabiiy holat, undan o'rganish mumkin", "Faqat zaif odamlarda bo'ladi", "Bolalarda bo'lmaydi"], correct: 1 }]),
      mcq([{ text: "Asta-sekin o'rganishning foydasi nima?", options: ["Qo'rquv tezroq o'tadi", "Har bir qadam bilan ishonch va tajriba ortadi", "Boshqalar senga o'xshab qo'rqmaydi", "Hech qanday foydasi yo'q"], correct: 1 }]),
      mcq([{ text: "Qo'rquvga ergashishning natijasi nima?", options: ["Sen kuchliroq bo'lasan", "Sen o'sib, rivojlanib borasan", "Sen yangi narsalarni qo'llap-quvvatlamaysan va orqada qolasan", "Sen qo'rquvdan xalos bo'lasan"], correct: 2 }]),
      mcq([{ text: "Eng jasur harakat qaysi?", options: ["Hech qachon qo'rqmaslik", "Qo'rqib tursa ham bir qadam tashlash", "Qo'rquvni yashirish", "Boshqalar jasurligini ko'rish"], correct: 1 }]),
    ],
  },

  // ── orderNumber 61 — STEP 56 — "are not" (C) ────────────────────────────────
  {
    orderNumber: 61,
    title: 'STEP 56 — to be: are not (1-dars)',
    type: LessonType.english,
    components: [
      mcq([
        {
          text: "We/you/they uchun inkor shaklini ifodalash uchun qaysi birikmа to'g'ri?",
          options: ['they is not', 'they am not', 'they are not', 'they not are'],
          correct: 2,
        },
      ]),
      ...topicSentenceBlock({ uz: 'Biz chet eldan emasmiz', en: 'We are not from abroad', words: ['We', 'are', 'not', 'from', 'abroad'] }),
      ...topicSentenceBlock({ uz: 'Sizlar barabanchi emassizlar', en: 'You are not drummers', words: ['You', 'are', 'not', 'drummers'] }),
      ...topicSentenceBlock({ uz: 'Ular yosh emaslar', en: 'They are not young', words: ['They', 'are', 'not', 'young'] }),
      ...topicSentenceBlock({ uz: 'Siz tish shifokori emassiz', en: 'You are not a dentist', words: ['You', 'are', 'not', 'a', 'dentist'] }),
      ...phraseBlock('Bu parta toza', 'This desk is clean'),
      ...phraseBlock("Vaqt bo'ldi", 'Time is up'),
      ...phraseBlock('Men xonamni tozalayman', 'I clean my room'),
      matchPairs([
        { left: 'We are not from abroad', right: 'Biz chet eldan emasmiz' },
        { left: 'They are not young', right: 'Ular yosh emaslar' },
        { left: 'You are not drummers', right: 'Sizlar barabanchi emassizlar' },
        { left: 'Time is up', right: "Vaqt bo'ldi" },
        { left: 'This desk is clean', right: 'Bu parta toza' },
      ]),
      mcq([
        { text: "Ko'plik uchun inkor shakli qaysi?", options: ['we is not', 'we am not', 'we are not', 'we not are'], correct: 2 },
        { text: "'They are not young' — bu nima ma'noda?", options: ['Ular yoshdir', 'Ular katta emas', 'Ular yosh emaslar', 'Ular bo\'y emas'], correct: 2 },
        { text: "'You are not a dentist' — to'g'ri tarjima qaysi?", options: ['Siz tish shifokorisiz', 'Sen tish shifokorisan', 'Siz tish shifokori emassiz', 'Ular tish shifokori emas'], correct: 2 },
      ]),
    ],
  },

  // ── orderNumber 62 — STEP 57 — Vocab fast food (B) ──────────────────────────
  {
    orderNumber: 62,
    title: 'STEP 57 — Tez ovqat',
    type: LessonType.english,
    components: [
      ...vocabBlock({ uz: 'hamburger', en: 'hamburger', distractors: ['pizza', 'hot dog', 'donut'] }),
      ...vocabBlock({ uz: 'kartoshka fri', en: 'french fries', distractors: ['hamburger', 'pizza', 'hot dog'] }),
      ...vocabBlock({ uz: "qovurilgan jo'ja", en: 'chicken', distractors: ['hamburger', 'pizza', 'french fries'] }),
      matchPairs([
        { left: 'hamburger', right: 'hamburger' },
        { left: 'french fries', right: 'kartoshka fri' },
        { left: 'chicken', right: "qovurilgan jo'ja" },
        { left: 'donut', right: 'teshik kulcha' },
        { left: 'pizza', right: 'pitsa' },
      ]),
      ...vocabBlock({ uz: 'teshik kulcha', en: 'donut', distractors: ['hamburger', 'pizza', 'french fries'] }),
      ...vocabBlock({ uz: 'hot dog', en: 'hot dog', distractors: ['hamburger', 'pizza', 'donut'] }),
      ...vocabBlock({ uz: 'pitsa', en: 'pizza', distractors: ['hamburger', 'hot dog', 'donut'] }),
      matchPairs([
        { left: 'hot dog', right: 'hot dog' },
        { left: 'pizza', right: 'pitsa' },
        { left: 'donut', right: 'teshik kulcha' },
        { left: 'french fries', right: 'kartoshka fri' },
        { left: 'chicken', right: "qovurilgan jo'ja" },
      ]),
      ...phraseBlock("Kompyuterni yoqing", 'Turn on the computer'),
      ...phraseBlock("Mening yangi noutbukim", 'My new laptop'),
      ...phraseBlock("Sichqonchadan foydalaning", 'Use the mouse'),
      ...phraseBlock("Hikoya o'qing", 'Read a story'),
      ...phraseBlock("Yozib qo'ying", 'Write it down'),
      ...phraseBlock("O'qituvchiga quloq soling", 'Listen to the teacher'),
      mcq([
        { text: "'Donut' o'zbek tilida nima?", options: ['hamburger', 'teshik kulcha', 'pitsa', 'hot dog'], correct: 1 },
        { text: "'Kartoshka fri' inglizcha nima?", options: ['chicken', 'hamburger', 'french fries', 'hot dog'], correct: 2 },
        { text: "'Turn on the computer' — bu nima ma'noda?", options: ["Kompyuterni o'chiring", "Kompyuterni yoqing", "Kompyuterni saqlang", "Kompyuterni ko'ring"], correct: 1 },
      ]),
    ],
  },

  // ── orderNumber 63 — STEP 58 — "am not 2" (C) ───────────────────────────────
  {
    orderNumber: 63,
    title: 'STEP 58 — to be: am not (2-dars)',
    type: LessonType.english,
    components: [
      mcq([
        {
          text: "'Men' (I) uchun 'to be' inkor shaklini to'g'ri tanlang:",
          options: ['I not am', 'I is not', 'I am not', 'I are not'],
          correct: 2,
        },
      ]),
      ...topicSentenceBlock({ uz: 'Men uning akasi emasman', en: 'I am not his brother', words: ['I', 'am', 'not', 'his', 'brother'] }),
      ...topicSentenceBlock({ uz: "Men qo'shiqchi emasman", en: 'I am not a singer', words: ['I', 'am', 'not', 'a', 'singer'] }),
      ...topicSentenceBlock({ uz: 'Men sovuq qotmayapman', en: 'I am not cold', words: ['I', 'am', 'not', 'cold'] }),
      ...topicSentenceBlock({ uz: 'Men yaxshi emasman', en: 'I am not good', words: ['I', 'am', 'not', 'good'] }),
      ...phraseBlock("O'rningdan tur", 'Stand up'),
      ...phraseBlock("O'tir", 'Sit down'),
      ...phraseBlock('Kitobingni och', 'Open your book'),
      matchPairs([
        { left: 'I am not his brother', right: 'Men uning akasi emasman' },
        { left: 'I am not a singer', right: "Men qo'shiqchi emasman" },
        { left: 'I am not cold', right: 'Men sovuq qotmayapman' },
        { left: 'Stand up', right: "O'rningdan tur" },
        { left: 'Sit down', right: "O'tir" },
      ]),
      mcq([
        { text: "'I am not good' — bu nima ma'noda?", options: ['Men yaxshiman', 'Men yaxshi emasman', 'Men zo\'rman', 'Men shaxdayman'], correct: 1 },
        { text: "Quyidagilardan qaysi biri to'g'ri?", options: ['I is not a singer', 'I are not a singer', 'I am not a singer', 'I not singer'], correct: 2 },
        { text: "'Stand up' o'zbek tilida nima?", options: ["O'tir", "O'rningdan tur", 'Yugur', 'Sakra'], correct: 1 },
      ]),
    ],
  },

  // ── orderNumber 64 — STEP 59 — Vocab food (B) ───────────────────────────────
  {
    orderNumber: 64,
    title: "STEP 59 — Taomlar",
    type: LessonType.english,
    components: [
      ...vocabBlock({ uz: 'tort', en: 'cake', distractors: ['bread', 'soup', 'meat'] }),
      ...vocabBlock({ uz: 'sendvich', en: 'sandwich', distractors: ['cake', 'bread', 'soup'] }),
      ...vocabBlock({ uz: 'spagetti', en: 'spaghetti', distractors: ['cake', 'sandwich', 'bread'] }),
      matchPairs([
        { left: 'cake', right: 'tort' },
        { left: 'sandwich', right: 'sendvich' },
        { left: 'spaghetti', right: 'spagetti' },
        { left: 'soup', right: "sho'rva" },
        { left: 'bread', right: 'non' },
      ]),
      ...vocabBlock({ uz: "sho'rva", en: 'soup', distractors: ['cake', 'sandwich', 'meat'] }),
      ...vocabBlock({ uz: 'non', en: 'bread', distractors: ['cake', 'soup', 'meat'] }),
      ...vocabBlock({ uz: "go'sht", en: 'meat', distractors: ['cake', 'bread', 'soup'] }),
      matchPairs([
        { left: 'meat', right: "go'sht" },
        { left: 'bread', right: 'non' },
        { left: 'soup', right: "sho'rva" },
        { left: 'spaghetti', right: 'spagetti' },
        { left: 'cake', right: 'tort' },
      ]),
      ...phraseBlock('Menda savol bor', 'I have a question'),
      ...phraseBlock('Iltimos, qaytaring', 'Repeat it, please'),
      ...phraseBlock('Sekin yuring', 'Walk slowly'),
      ...phraseBlock("Keling, endi o'ynaymiz", "Let's play now"),
      ...phraseBlock('Eshik tomon yugur', 'Run to the door'),
      ...phraseBlock('Juda baland sakra', 'Jump very high'),
      mcq([
        { text: "'Bread' o'zbek tilida nima?", options: ['tort', 'non', "go'sht", "sho'rva"], correct: 1 },
        { text: "'Go'sht' inglizcha nima?", options: ['soup', 'bread', 'cake', 'meat'], correct: 3 },
        { text: "'Repeat it, please' — bu nima ma'noda?", options: ['Sekin yuring', 'Iltimos, qaytaring', 'Menga aytib bering', 'Iltimos, tomosha qiling'], correct: 1 },
      ]),
    ],
  },

  // ── orderNumber 65 — STEP 60 — Personal Dev "Har kuni biroz yaxshilanish" (E) ─
  {
    orderNumber: 65,
    title: 'STEP 60 — Har kuni biroz yaxshilanish',
    type: LessonType.personal_development,
    nRepetitions: 1,
    aiTutorEnabled: true,
    aiTutorContext: [
      "Sen Aloqushsan, do'stona o'zbek bola. O'zbek tilida suhbatlash.",
      '',
      "Bola hozir ushbu mavzuni o'qidi: \"O'zimni har kuni biroz yaxshilayman\"",
      '',
      "Asosiy g'oya: Shaxsiy rivojlanish — har kuni kechagidan biroz yaxshiroq bo'lish. Kichik qadamlar katta natijalarga olib keladi.",
      '',
      "Boladan 3 ta savol so'ra (ketma-ket, javobiga qarab):",
      "1) \"Bu darsdan nima o'rganding?\"",
      "2) \"O'zingni kechagidan yaxshilash uchun bugun nima qilding?\"",
      "3) \"Har kuni bitta kichik qadam tashlash nima uchun muhim?\"",
      '',
      'Har javobini hurmat qil, kichik maslahat ber. Maksimal 2-3 jumla.',
    ].join('\n'),
    components: [
      mcq([
        {
          text: [
            "📖 SHAXSIY RIVOJLANISH — O'zimni har kuni biroz yaxshilayman",
            '',
            "Bilasizmi, shaxsiy rivojlanish degani — bu har kuni o'zimni kechagidan biroz yaxshilash demak.",
            '',
            "Masalan, kecha ertalab turishga qiynaldimmi? Bugun 5 daqiqa oldinroq turaman. Kecha ko'p vaqtimni telefonga ketkazdimmi? Bugun yarim soat kitob o'qiyman. Hatto bular juda kichik ishdek tuyuladi, lekin ular meni har kuni kuchliroq qiladi!",
            '',
            "O'zimga har kuni bitta savol beraman: 'Men bugun o'zimni nimada yaxshiladim?'",
            '',
            "Shuni eslab qoling: katta odam bo'lish — yosh bilan emas, harakat bilan bo'ladi. Bugun yaxshiroq bola bo'lsak, ertaga eng zo'r inson bo'lamiz!",
            '',
            "O'zimizga ishonaylik va har kuni bitta kichik qadam tashlaylik!",
            '',
            "❓ Har kuni o'zingni qanday yaxshilaysan?",
          ].join('\n'),
          options: [
            "Bir kunda hammasini o'zgartirishga harakat qilish",
            "Bitta kichik qadam tashlab, kechagidan biroz yaxshiroq bo'lish",
            "Faqat boshqalar aytganda harakat qilish",
            "Katta maqsadlarga to'g'ridan-to'g'ri o'tish",
          ],
          correct: 1,
        },
      ]),
      mcq([{ text: "Shaxsiy rivojlanish degani nima?", options: ["Har kuni kechagidan biroz yaxshiroq bo'lish", "Hamma narsada eng yaxshi bo'lish", "Faqat maktabda zo'r bo'lish", "Boshqalardan yaxshiroq bo'lish"], correct: 0 }]),
      mcq([{ text: "Kecha telefonga ko'p vaqt ketkazdim. Bugun nima qilaman?", options: ["Yana ko'p vaqt telefonda o'tiraman", "Yarim soat kitob o'qiyman", "Telefonni o'chirib qo'yaman", "Hech narsa qilmayman"], correct: 1 }]),
      mcq([{ text: "Kichik qadamlar nima uchun muhim?", options: ["Ular katta o'zgarishlarga olib keladi", "Ular oson shuning uchun", "Ular vaqtni tejaydi", "Ular hech narsa bermaydi"], correct: 0 }]),
      mcq([{ text: "Har kuni o'zimga berish kerak bo'lgan savol:", options: ["'Hamma nima qilyapti?'", "'Men bugun o'zimni nimada yaxshiladim?'", "'Qachon dam olaman?'", "'Kim eng yaxshisi?'"], correct: 1 }]),
      mcq([{ text: "Katta odam bo'lish nimaga bog'liq?", options: ["Yoshga", "Pul-boylikka", "Harakat va intilishga", "Tashqi ko'rinishga"], correct: 2 }]),
      mcq([{ text: "Kecha ertalab turishga qiynaldim. Bugun nima qilaman?", options: ["Yana kechroq turaman", "5 daqiqa oldinroq turaman", "Umuman turmayman", "Soatni o'chiraman"], correct: 1 }]),
      mcq([{ text: "Do'sting o'z-o'zini yaxshilashni xohlaydi. Unga qanday maslahat berasan?", options: ["'Hamma narsani bir kunda o'zgartir'", "'Kichik, kuchli qadam tashla'", "'Hammadan yaxshiroq bo'lishga harakat qil'", "'Boshqalarga ergash'"], correct: 1 }]),
      mcq([{ text: "Shaxsiy rivojlanishda eng muhim narsa:", options: ["Tezlik", "Boshqalardan o'zib ketish", "Har kuni bitta kichik qadam", "Katta maqsadlar"], correct: 2 }]),
      mcq([{ text: "Bitta kichik o'zgarish kun sayin nima beradi?", options: ["Hech narsa", "Kuchlanish", "Asta-sekin yaxshilanish va kuchlanish", "Charchash"], correct: 2 }]),
      mcq([{ text: "O'zimga ishonish nima uchun kerak?", options: ["Boshqalarni ishontirish uchun", "O'z harakatlarimga ishor va davom etish uchun", "Maqtanish uchun", "Hech narsa uchun emas"], correct: 1 }]),
      mcq([{ text: "'Har kuni kuchliroq bo'laman' uchun nima kerak?", options: ["Har kuni kichik ish qilish", "Bir kunda katta harakat qilish", "Dam olish", "Boshqalarni kuzatish"], correct: 0 }]),
      mcq([{ text: "Ertalab erta turish odati qanday shakllanadi?", options: ["Bir kunda", "Har kuni 5 daqiqa oldinroq turib, asta-sekin", "Kun tartibini o'zgartirmasdan", "Faqat shovqinli soat bilan"], correct: 1 }]),
      mcq([{ text: "Qaysi fikr shaxsiy rivojlanishni to'g'ri ifodalaydi?", options: ["'Men hech qachon o'zgara olmayman'", "'Bugun kichik qadam — ertaga katta natija'", "'Faqat iqtidorlilar o'sadi'", "'O'zgarish qiyin, kut'"], correct: 1 }]),
      mcq([{ text: "Nima uchun boshqalar bilan solishtirmaslik kerak?", options: ["Chunki hamma teng", "Chunki har inson o'z yo'lida rivojlanadi", "Chunki boshqalar yaxshiroq", "Chunki solishtirish oson emas"], correct: 1 }]),
      mcq([{ text: "Kuchli motivatsiya qanday saqlanadi?", options: ["Bir daqiqalik ilhom bilan", "Har kuni kichik yutuqlarni nishonlab", "Boshqalar maqtashi bilan", "Katta maqsad qo'yish bilan"], correct: 1 }]),
      mcq([{ text: "Shaxsiy rivojlanishga to'sqinlik qiluvchi holat:", options: ["Kichik qadam tashlab ko'rish", "Har kuni bir oz o'qish", "Hozir komfort zonasida qolish va o'zgarishni kechiktirish", "Do'stlarga maslahat so'rash"], correct: 2 }]),
      mcq([{ text: "Ertaga zo'r inson bo'lish uchun bugun nima qilish kerak?", options: ["Hech narsa, ertaga boshlayman", "Bugun yaxshiroq bola bo'lish uchun bitta kichik qadam", "Katta reja tuzish", "Boshqalarga qarab o'rganish"], correct: 1 }]),
      mcq([{ text: "O'zingga ishonib kichik qadam tashlash natijasi:", options: ["Hech narsa o'zgarmaydi", "Sening irodang va ishonching o'sadi", "Boshqalar rozi bo'ladi", "Tezda katta natija ko'rinadi"], correct: 1 }]),
      mcq([{ text: "Qaysi holat shaxsiy rivojlanishga misol?", options: ["Har kuni bir xil bo'lib qolish", "Kecha o'qimadim — bugun 10 daqiqa o'qiyman", "Maqsadni unutib qo'yish", "Harakat qilmasdan natija kutish"], correct: 1 }]),
    ],
  },

  // ── orderNumber 66 — STEP 61 — Composition "My hobby" (D) ───────────────────
  {
    orderNumber: 66,
    title: 'STEP 61 — My hobby',
    type: LessonType.english,
    aiTutorEnabled: true,
    aiTutorContext: [
      'You are a friendly English coach for a young Uzbek learner.',
      "The student just composed a 'My hobby' paragraph.",
      'Ask 3 short follow-up questions in English, one at a time, to extend the topic.',
      'Be encouraging. Keep responses to 1-2 sentences.',
      'English only — they are practising English.',
    ].join('\n'),
    components: [
      fillBlank('I have ___ hobbies.', 'two', ['one', 'two', 'three', 'four']),
      fillBlank('I like playing ___.', 'football', ['football', 'basketball', 'tennis', 'chess']),
      fillBlank('I play football with my friends ___ school.', 'after', ['after', 'before', 'during', 'at']),
      fillBlank('I also like learning ___.', 'English', ['English', 'Math', 'Science', 'Music']),
      fillBlank('I learn English every ___.', 'day', ['day', 'week', 'month', 'year']),
      fillBlank('I read books and watch ___ in English.', 'cartoons', ['cartoons', 'movies', 'shows', 'videos']),
      fillBlank('I love my hobbies very ___.', 'much', ['much', 'well', 'good', 'great']),
      // Translate key sentences
      translate('Mening ikkita hobbim bor.', 'I have two hobbies'),
      translate("Men futbol o'ynashni yoqtiraman.", 'I like playing football'),
      translate("Men maktabdan keyin do'stlarim bilan futbol o'ynamiz.", 'I play football with my friends after school'),
      translate("Men shuningdek ingliz tilini o'rganishni ham yoqtiraman.", 'I also like learning English'),
      translate("Men har kuni ingliz tilini o'rganaman.", 'I learn English every day'),
      translate("Men ingliz tilida kitob o'qiyman va multfilm ko'raman.", 'I read books and watch cartoons in English'),
      translate("Men hobbiylarimni juda yaxshi ko'raman.", 'I love my hobbies very much'),
      // Word-order
      wordOrder([
        { words: ['hobbies', 'two', 'have', 'I'], correct: 'I have two hobbies' },
        { words: ['football', 'playing', 'like', 'I'], correct: 'I like playing football' },
        { words: ['English', 'learning', 'like', 'also', 'I'], correct: 'I also like learning English' },
        { words: ['day', 'every', 'English', 'learn', 'I'], correct: 'I learn English every day' },
      ]),
      // Speak key sentences
      speakSentence('I have two hobbies', 70),
      speakSentence('I like playing football', 70),
      speakSentence('I also like learning English', 70),
      speakSentence('I love my hobbies very much', 70),
      // Comprehension MCQ
      mcq([
        { text: "'I have two hobbies' — nechta hobby?", options: ['Bir', 'Ikki', 'Uch', 'To\'rt'], correct: 1 },
        { text: "'I learn English every day' — qachon o'rganadi?", options: ['Har hafta', 'Har oy', 'Har kuni', 'Hech qachon'], correct: 2 },
        { text: "'I play football after school' — futbolni qachon o'ynaydi?", options: ['Maktabda', 'Maktabdan oldin', 'Maktabdan keyin', 'Kechasi'], correct: 2 },
      ]),
      speakWords(
        'I have two hobbies. I like playing football. I play football with my friends after school. I also like learning English. I learn English every day. I read books and watch cartoons in English. I love my hobbies very much.',
        70,
      ),
    ],
  },

  // ── orderNumber 68 — STEP 62 — "is not 2" (C) ───────────────────────────────
  {
    orderNumber: 68,
    title: 'STEP 62 — to be: is not (2-dars)',
    type: LessonType.english,
    components: [
      mcq([
        {
          text: "U (he/she/it) uchun inkor shaklini ifodalash uchun qaysi birlikma to'g'ri?",
          options: ['he not is', 'he am not', 'he is not', 'he are not'],
          correct: 2,
        },
      ]),
      ...topicSentenceBlock({ uz: "U mening do'stim emas", en: 'He is not my friend', words: ['He', 'is', 'not', 'my', 'friend'] }),
      ...topicSentenceBlock({ uz: "U qo'l soati emas", en: 'It is not a watch', words: ['It', 'is', 'not', 'a', 'watch'] }),
      ...topicSentenceBlock({ uz: 'U huquqshunos emas', en: 'He is not a lawyer', words: ['He', 'is', 'not', 'a', 'lawyer'] }),
      ...topicSentenceBlock({ uz: 'U yigirmada emas', en: 'She is not twenty', words: ['She', 'is', 'not', 'twenty'] }),
      ...phraseBlock('Devorga qarang', 'Look at the wall'),
      ...phraseBlock('Soat orqada qolyapti', 'The clock is slow'),
      ...phraseBlock('Xaritani yoping', 'Close the map'),
      matchPairs([
        { left: 'He is not my friend', right: "U mening do'stim emas" },
        { left: 'It is not a watch', right: "U qo'l soati emas" },
        { left: 'He is not a lawyer', right: 'U huquqshunos emas' },
        { left: 'Look at the wall', right: 'Devorga qarang' },
        { left: 'The clock is slow', right: 'Soat orqada qolyapti' },
      ]),
      mcq([
        { text: "'She is not twenty' — bu nima ma'noda?", options: ['U yigirma yoshda', 'U yigirmada emas', "U o'n yoshda", "U o'ttizda emas"], correct: 1 },
        { text: "Quyidagilardan qaysi biri to'g'ri?", options: ['She is not a lawyer', 'She am not a lawyer', 'She are not a lawyer', 'She not lawyer'], correct: 0 },
        { text: "'Close the map' o'zbek tilida nima?", options: ['Xaritani oching', "Xaritani ko'ring", 'Xaritani yoping', 'Xaritaga qarang'], correct: 2 },
      ]),
    ],
  },

  // ── orderNumber 69 — STEP 63 — Vocab drinks (B) ─────────────────────────────
  {
    orderNumber: 69,
    title: 'STEP 63 — Ichimliklar (1)',
    type: LessonType.english,
    components: [
      ...vocabBlock({ uz: 'choy', en: 'tea', distractors: ['coffee', 'milk', 'juice'] }),
      ...vocabBlock({ uz: 'kofe', en: 'coffee', distractors: ['tea', 'milk', 'juice'] }),
      ...vocabBlock({ uz: 'sut', en: 'milk', distractors: ['tea', 'coffee', 'juice'] }),
      ...vocabBlock({ uz: 'apelsin sharbati', en: 'orange juice', distractors: ['tea', 'coffee', 'milk'] }),
      matchPairs([
        { left: 'tea', right: 'choy' },
        { left: 'coffee', right: 'kofe' },
        { left: 'milk', right: 'sut' },
        { left: 'orange juice', right: 'apelsin sharbati' },
      ]),
      ...phraseBlock('Quloqchinlaringizdan foydalaning', 'Use your headphones'),
      ...phraseBlock('Musiqani tinglang', 'Listen to the music'),
      ...phraseBlock('Ovozni balandlating, iltimos', 'Volume up, please'),
      mcq([
        { text: "'Milk' o'zbek tilida nima?", options: ['choy', 'kofe', 'sut', 'apelsin sharbati'], correct: 2 },
        { text: "'Apelsin sharbati' inglizcha nima?", options: ['milk', 'tea', 'coffee', 'orange juice'], correct: 3 },
        { text: "'Listen to the music' — bu nima ma'noda?", options: ['Musiqa yoqing', 'Musiqani tinglang', "Musiqa o'chiring", 'Musiqani yozing'], correct: 1 },
      ]),
    ],
  },

  // ── orderNumber 70 — STEP 64 — "are not 2" (C) ─────────────────────────────
  {
    orderNumber: 70,
    title: 'STEP 64 — to be: are not (2-dars)',
    type: LessonType.english,
    components: [
      mcq([
        {
          text: "We/you/they uchun inkor shaklini ifodalash uchun qaysi birlikma to'g'ri?",
          options: ['we is not', 'we am not', 'we are not', 'we not are'],
          correct: 2,
        },
      ]),
      ...topicSentenceBlock({ uz: 'Biz och emasmiz', en: 'We are not hungry', words: ['We', 'are', 'not', 'hungry'] }),
      ...topicSentenceBlock({ uz: 'Siz politsiyachi emassiz', en: 'You are not a policeman', words: ['You', 'are', 'not', 'a', 'policeman'] }),
      ...topicSentenceBlock({ uz: "Ular do'stlar emas", en: 'They are not friends', words: ['They', 'are', 'not', 'friends'] }),
      ...topicSentenceBlock({ uz: 'Ular sinfdoshlar emas', en: 'They are not classmates', words: ['They', 'are', 'not', 'classmates'] }),
      ...phraseBlock('Endi sekin yur', 'Walk slowly now'),
      ...phraseBlock('Hovuzda suz', 'Swim in the pool'),
      ...phraseBlock("To'pni tutib ol", 'Catch the ball'),
      matchPairs([
        { left: 'We are not hungry', right: 'Biz och emasmiz' },
        { left: 'You are not a policeman', right: 'Siz politsiyachi emassiz' },
        { left: 'They are not friends', right: "Ular do'stlar emas" },
        { left: 'Walk slowly now', right: 'Endi sekin yur' },
        { left: 'Catch the ball', right: "To'pni tutib ol" },
      ]),
      mcq([
        { text: "'They are not classmates' — bu nima ma'noda?", options: ['Ular sinfdoshlar', 'Ular sinfdoshlar emas', "Ular do'stlar emas", "Ular o'quvchilar emas"], correct: 1 },
        { text: "Quyidagilardan qaysi biri to'g'ri?", options: ['They is not friends', 'They am not friends', 'They are not friends', 'They not friends'], correct: 2 },
        { text: "'Swim in the pool' — bu nima ma'noda?", options: ["Hovuzda yur", "Hovuzda o'yna", 'Hovuzda suz', "Hovuzda o'tir"], correct: 2 },
      ]),
    ],
  },

  // ── orderNumber 71 — STEP 65 — Personal Dev "Vaqtni boshqarish" (E) ──────────
  {
    orderNumber: 71,
    title: 'STEP 65 — Vaqtni boshqarish',
    type: LessonType.personal_development,
    nRepetitions: 1,
    aiTutorEnabled: true,
    aiTutorContext: [
      "Sen Aloqushsan, do'stona o'zbek bola. O'zbek tilida suhbatlash.",
      '',
      "Bola hozir ushbu mavzuni o'qidi: \"Vaqtimni boshqara olsam — hayotimni boshqaraman!\"",
      '',
      "Asosiy g'oya: Vaqtni boshqarish — hayotni boshqarish. Har kuni ertalab 5 daqiqa rejalashtirish eng muhim 3 ta ishni bajarishga yordam beradi.",
      '',
      "Boladan 3 ta savol so'ra (ketma-ket, javobiga qarab):",
      "1) \"Bu darsdan nima o'rganding?\"",
      "2) \"Bugun eng muhim 3 ta ishing nima bo'ladi?\"",
      "3) \"Vaqtni yaxshi boshqarish hayotingni qanday o'zgartiradi deb o'ylaysan?\"",
      '',
      'Har javobini hurmat qil, kichik maslahat ber. Maksimal 2-3 jumla.',
    ].join('\n'),
    components: [
      mcq([
        {
          text: [
            '📖 SHAXSIY RIVOJLANISH — Vaqtimni boshqara olsam — hayotimni boshqaraman!',
            '',
            "Sizda ham vaqtingiz yetmay qolyaptimi? Men ham darsga, o'yinga, uy ishlariga ulgurmasdim. Lekin bir narsani o'rgandim: vaqt bu — puldan ham qimmat narsa ekan!",
            '',
            "Men endi har kuni ertalab 5 daqiqa vaqt ajrataman va o'zimga savol beraman: 'Bugun men eng muhim nima ishni qilishim kerak?' Keyin 3 ta ish yozaman va shularni bajarishga harakat qilaman.",
            '',
            "Bilasizmi, vaqtni kim boshqara olsa — o'sha hayotini ham o'zgartira oladi! Chunki dangasalik yoki chalg'ish bizni ortga tortadi. Reja esa bizni oldinga olib boradi!",
            '',
            "Shuning uchun keling, bugundan boshlab har kuni vaqtingizni 5 daqiqa rejalashtiring. Shunda ham ko'proq o'ynaysiz, ham o'rganasiz!",
            '',
            '❓ Vaqtdan unumli foydalanish uchun nima qilish kerak?',
          ].join('\n'),
          options: [
            "Har kuni ertalab 5 daqiqa rejalashtirish va eng muhim 3 ta ishni yozish",
            "Ko'proq dam olish va keyin harakat qilish",
            "Faqat maktab vazifalarini bajarish",
            "Vaqtni boshqarishni kattalar qilsin",
          ],
          correct: 0,
        },
      ]),
      mcq([{ text: "Vaqt nima bilan taqqoslanadi?", options: ["Puldan arzon narsa", "Puldan ham qimmat narsa", "Oddiy narsa", "Faqat maktabda muhim narsa"], correct: 1 }]),
      mcq([{ text: "Har kuni ertalab necha daqiqa rejalashtirish tavsiya etiladi?", options: ['1 daqiqa', '3 daqiqa', '5 daqiqa', '10 daqiqa'], correct: 2 }]),
      mcq([{ text: "Ertalab savol beramiz: 'Bugun eng muhim nima ish qilishim kerak?' — Nechta ish yozamiz?", options: ['1 ta', '2 ta', '3 ta', '5 ta'], correct: 2 }]),
      mcq([{ text: "Dangasalik va chalg'ish nimaga olib boradi?", options: ['Oldinga', 'Ortga', 'Tezlikka', 'Muvaffaqiyatga'], correct: 1 }]),
      mcq([{ text: "Reja nimaga olib boradi?", options: ['Ortga', "To'xtatishga", 'Oldinga', 'Hech qayerga'], correct: 2 }]),
      mcq([{ text: "Vaqtni boshqara olgan odam nimani boshqara oladi?", options: ['Faqat maktabni', 'Hayotini', 'Boshqalarni', 'Faqat uy vazifasini'], correct: 1 }]),
      mcq([{ text: "Do'sting 'Vaqtim yetmayapti' deyapti. Unga qanday maslahat berasan?", options: ["'Kamroq o'yna'", "'Har kuni 5 daqiqa rejalashtir'", "'Ko'proq uxla'", "'Hech narsa qilma'"], correct: 1 }]),
      mcq([{ text: "Reja tuzish nima beradi?", options: ['Charchash', "Vaqtni yo'qotish", 'Tartib va muvaffaqiyat', "Boshqalarga bog'liqlik"], correct: 2 }]),
      mcq([{ text: "Har kuni 5 daqiqa rejalashtirish natijasi:", options: ["Ko'proq o'ynash va ko'proq o'rganish", "Faqat uy vazifasini bajarish", "Ko'proq uyqu", "Kamroq harakat"], correct: 0 }]),
      mcq([{ text: "Vaqtni unumli boshqarishning birinchi qadami:", options: ["Ko'proq dam olish", "Ertalab muhim ishlarni yozish", "Boshqalardan yordam so'rash", "Kechiktirib qo'yish"], correct: 1 }]),
      mcq([{ text: "Qaysi harakat vaqtni yo'qotadi?", options: ['Reja tuzish', "Muhim ishlarni bajarish", "Chalg'ish va dangasalik", 'Ertalab erta turish'], correct: 2 }]),
      mcq([{ text: "Vaqtni rejalashtirish qachon boshlanishi kerak?", options: ["Ertaga", "Bir haftadan keyin", "Bugundan", "Katta bo'lganda"], correct: 2 }]),
      mcq([{ text: "Eng muhim 3 ta ishni yozish nima uchun foydali?", options: ["Vaqtni tejaydi va diqqatni jamlaydi", "Boshqalarga ko'rsatish uchun", "O'qituvchini xursand qilish uchun", "Hech qanday foydasi yo'q"], correct: 0 }]),
      mcq([{ text: "Qaysi fikr to'g'ri?", options: ["Reja tuzish vaqtni oladi", "Reja tuzish vaqtni tejaydi va ko'proq ish qildiradi", "Reja faqat kattalar uchun", "Reja har doim o'zgaradi"], correct: 1 }]),
      mcq([{ text: "Vaqtni boshqarish deganda nima tushuniladi?", options: ["Soatga qarab yashash", "Muhim ishlarni rejalashtirish va ularga vaqt ajratish", "Ko'p ish qilish", "Dam olishni kamaytirish"], correct: 1 }]),
      mcq([{ text: "Chalg'ish nimadan chalg'itadi?", options: ["Dam olishdan", "Muhim ishlardan", "Maktabdan", "Do'stlardan"], correct: 1 }]),
      mcq([{ text: "Agar 3 ta muhim ishni bajarsang, nima bo'ladi?", options: ["Vaqt yo'qoladi", "Ko'proq ish qoladi", "Muvaffaqiyat va erkinlik his qilasiz", "Boshqalar rozi bo'lmaydi"], correct: 2 }]),
      mcq([{ text: "Vaqtni boshqarish bo'yicha eng yaxshi payt:", options: ["Kechasi", "Ertalab, ish boshlanishidan oldin", "Tushdan keyin", "Hech qachon"], correct: 1 }]),
      mcq([{ text: "Qaysi holat vaqtni boshqarishga misol?", options: ["Har kuni telefonda saflash", "Ertalab 3 ta muhim ish yozib, shularni bajarish", "Barchani kutib turish", "Faqat o'qituvchi aytganini qilish"], correct: 1 }]),
    ],
  },

  // ── orderNumber 72 — STEP 66 — Vocab drinks 2 (B) ───────────────────────────
  {
    orderNumber: 72,
    title: 'STEP 66 — Ichimliklar (2)',
    type: LessonType.english,
    components: [
      ...vocabBlock({ uz: 'suv', en: 'water', distractors: ['milk', 'tea', 'juice'] }),
      ...vocabBlock({ uz: 'limon sharbati', en: 'lemon juice', distractors: ['water', 'milk', 'orange juice'] }),
      ...vocabBlock({ uz: 'kola', en: 'coke', distractors: ['water', 'lemon juice', 'milk'] }),
      // Revisit already-introduced drinks
      ...vocabBlock({ uz: 'choy', en: 'tea', distractors: ['coke', 'water', 'lemon juice'] }),
      ...vocabBlock({ uz: 'sut', en: 'milk', distractors: ['coke', 'tea', 'water'] }),
      matchPairs([
        { left: 'water', right: 'suv' },
        { left: 'lemon juice', right: 'limon sharbati' },
        { left: 'coke', right: 'kola' },
        { left: 'tea', right: 'choy' },
        { left: 'milk', right: 'sut' },
      ]),
      ...phraseBlock('Yuzingni yuv', 'Wash your face'),
      ...phraseBlock('Tishlaringni tozala', 'Brush your teeth'),
      ...phraseBlock('Sochingni tara', 'Comb your hair'),
      mcq([
        { text: "'Coke' o'zbek tilida nima?", options: ['suv', 'limon sharbati', 'kola', 'choy'], correct: 2 },
        { text: "'Limon sharbati' inglizcha nima?", options: ['orange juice', 'water', 'coke', 'lemon juice'], correct: 3 },
        { text: "'Brush your teeth' — bu nima ma'noda?", options: ['Yuzingni yuv', 'Sochingni tara', 'Tishlaringni tozala', "Qo'lingni yuv"], correct: 2 },
      ]),
    ],
  },

  // ── orderNumber 73 — STEP 67 — "am not 3" (C) ───────────────────────────────
  {
    orderNumber: 73,
    title: 'STEP 67 — to be: am not (3-dars)',
    type: LessonType.english,
    components: [
      mcq([
        {
          text: "'Men' (I) uchun inkor shaklini to'g'ri tanlang:",
          options: ['I is not', 'I are not', 'I am not', 'I not am'],
          correct: 2,
        },
      ]),
      ...topicSentenceBlock({ uz: 'Men chet eldan emasman', en: 'I am not from abroad', words: ['I', 'am', 'not', 'from', 'abroad'] }),
      ...topicSentenceBlock({ uz: 'Men muhandis emasman', en: 'I am not an engineer', words: ['I', 'am', 'not', 'an', 'engineer'] }),
      ...topicSentenceBlock({ uz: 'Men oshpaz emasman', en: 'I am not a chef', words: ['I', 'am', 'not', 'a', 'chef'] }),
      ...topicSentenceBlock({ uz: "Men basketbol o'yinchisi emasman", en: 'I am not a basketball player', words: ['I', 'am', 'not', 'a', 'basketball', 'player'] }),
      ...phraseBlock("Ko'ylagingni kiy", 'Put on your shirt'),
      ...phraseBlock("Oyoq kiyimingni bog'la", 'Tie your shoes'),
      ...phraseBlock('Paltoni yech', 'Take off the coat'),
      matchPairs([
        { left: 'I am not from abroad', right: 'Men chet eldan emasman' },
        { left: 'I am not an engineer', right: 'Men muhandis emasman' },
        { left: 'I am not a chef', right: 'Men oshpaz emasman' },
        { left: 'Put on your shirt', right: "Ko'ylagingni kiy" },
        { left: 'Tie your shoes', right: "Oyoq kiyimingni bog'la" },
      ]),
      mcq([
        { text: "'I am not a basketball player' — bu nima ma'noda?", options: ["Men basketbol o'yinchisiman", "Men basketbol o'yinchisi emasman", "Men sport qilmayman", "Men basketbolni yoqtirmayman"], correct: 1 },
        { text: "Quyidagilardan qaysi biri to'g'ri?", options: ['I is not an engineer', 'I are not an engineer', 'I am not an engineer', 'I not engineer'], correct: 2 },
        { text: "'Take off the coat' o'zbek tilida nima?", options: ["Paltoni kiy", "Paltoni yech", "Paltoni yig'ishtir", "Paltoni ol"], correct: 1 },
      ]),
    ],
  },

  // ── orderNumber 74 — STEP 68 — Vocab professions (B) ───────────────────────
  {
    orderNumber: 74,
    title: "STEP 68 — Kasblar",
    type: LessonType.english,
    components: [
      ...vocabBlock({ uz: 'rassom', en: 'painter', distractors: ['chef', 'policeman', 'astronaut'] }),
      ...vocabBlock({ uz: 'oshpaz', en: 'chef', distractors: ['painter', 'policeman', 'waiter'] }),
      ...vocabBlock({ uz: 'politsiyachi', en: 'policeman', distractors: ['painter', 'chef', 'astronaut'] }),
      matchPairs([
        { left: 'painter', right: 'rassom' },
        { left: 'chef', right: 'oshpaz' },
        { left: 'policeman', right: 'politsiyachi' },
        { left: 'astronaut', right: 'astronavt' },
        { left: 'waiter', right: 'ofitsiant' },
      ]),
      ...vocabBlock({ uz: 'astronavt', en: 'astronaut', distractors: ['painter', 'chef', 'vet'] }),
      ...vocabBlock({ uz: 'ofitsiant', en: 'waiter', distractors: ['painter', 'astronaut', 'policeman'] }),
      ...vocabBlock({ uz: 'veterinar', en: 'vet', distractors: ['waiter', 'astronaut', 'chef'] }),
      matchPairs([
        { left: 'vet', right: 'veterinar' },
        { left: 'waiter', right: 'ofitsiant' },
        { left: 'astronaut', right: 'astronavt' },
        { left: 'chef', right: 'oshpaz' },
        { left: 'painter', right: 'rassom' },
      ]),
      ...phraseBlock("O'rningni yig'ishtir", 'Make your bed'),
      ...phraseBlock('Maktabga bor', 'Go to the school'),
      ...phraseBlock("Do'stlarimni yaxshi ko'raman", 'I love my friends'),
      ...phraseBlock('Doskani tozala', 'Clean the board'),
      ...phraseBlock("Bo'r bo'lagini ol", 'Take a piece of chalk'),
      ...phraseBlock("Partangizga o'tiring", 'Sit at your desk'),
      mcq([
        { text: "'Veterinar' inglizcha nima?", options: ['waiter', 'astronaut', 'chef', 'vet'], correct: 3 },
        { text: "'Painter' o'zbek tilida nima?", options: ['oshpaz', 'politsiyachi', 'rassom', 'ofitsiant'], correct: 2 },
        { text: "'Make your bed' — bu nima ma'noda?", options: ["O'rningni yig'ishtir", 'Maktabga bor', "Doskani tozala", "Partangizga o'tir"], correct: 0 },
      ]),
    ],
  },

  // ── orderNumber 75 — STEP 69 — "is not 3" (C) ───────────────────────────────
  {
    orderNumber: 75,
    title: 'STEP 69 — to be: is not (3-dars)',
    type: LessonType.english,
    components: [
      mcq([
        {
          text: "He/she/it uchun inkor shaklini to'g'ri tanlang:",
          options: ['He am not a boxer', 'He is not a boxer', 'He are not a boxer', 'He not boxer'],
          correct: 1,
        },
      ]),
      ...topicSentenceBlock({ uz: 'U bokschi emas', en: 'He is not a boxer', words: ['He', 'is', 'not', 'a', 'boxer'] }),
      ...topicSentenceBlock({ uz: 'Mushuk aqlli emas', en: 'Cat is not clever', words: ['Cat', 'is', 'not', 'clever'] }),
      ...topicSentenceBlock({ uz: 'U shifokor emas', en: 'She is not a doctor', words: ['She', 'is', 'not', 'a', 'doctor'] }),
      ...topicSentenceBlock({ uz: 'Sizning itingiz yuvosh emas', en: 'Your dog is not very friendly', words: ['Your', 'dog', 'is', 'not', 'very', 'friendly'] }),
      ...phraseBlock('Oyga qara', 'Look at the moon'),
      ...phraseBlock('Yulduzlar yorqin', 'The stars are bright'),
      ...phraseBlock("Bugun yomg'irli kun", 'It is a rainy day'),
      matchPairs([
        { left: 'He is not a boxer', right: 'U bokschi emas' },
        { left: 'Cat is not clever', right: 'Mushuk aqlli emas' },
        { left: 'She is not a doctor', right: 'U shifokor emas' },
        { left: 'Look at the moon', right: 'Oyga qara' },
        { left: 'The stars are bright', right: 'Yulduzlar yorqin' },
      ]),
      mcq([
        { text: "'Your dog is not very friendly' — bu nima ma'noda?", options: ['Sizning itingiz juda yuvosh', 'Sizning itingiz yuvosh emas', 'Itingiz bor', "Sizning itingiz do'stona"], correct: 1 },
        { text: "Quyidagilardan qaysi biri to'g'ri?", options: ['Cat am not clever', 'Cat are not clever', 'Cat is not clever', 'Cat not clever'], correct: 2 },
        { text: "'It is a rainy day' — bu nima ma'noda?", options: ['Bugun quyoshli kun', 'Bugun shamolda kun', "Bugun yomg'irli kun", 'Bugun bahorgi kun'], correct: 2 },
      ]),
    ],
  },

  // ── orderNumber 76 — STEP 70 — Personal Dev "Muloqot — sehrli kalit" (E) ────
  {
    orderNumber: 76,
    title: 'STEP 70 — Muloqot — sehrli kalit',
    type: LessonType.personal_development,
    nRepetitions: 1,
    aiTutorEnabled: true,
    aiTutorContext: [
      "Sen Aloqushsan, do'stona o'zbek bola. O'zbek tilida suhbatlash.",
      '',
      "Bola hozir ushbu mavzuni o'qidi: \"Muloqot — bu sehrli kalit!\"",
      '',
      "Asosiy g'oya: Muloqot — bu gapirish emas, balki eshitish, tushunish va sabr qilish. Dildan gapirish muammolarni hal qiladi va do'stlarni ko'paytiradi.",
      '',
      "Boladan 3 ta savol so'ra (ketma-ket, javobiga qarab):",
      "1) \"Bu darsdan nima o'rganding?\"",
      "2) \"Biror muammo bo'lganda odatda nima qilasan — gapirasanmi yoki jimgina turasan?\"",
      "3) \"Dildan gapirish qanday natija beradi deb o'ylaysan?\"",
      '',
      'Har javobini hurmat qil, kichik maslahat ber. Maksimal 2-3 jumla.',
    ].join('\n'),
    components: [
      mcq([
        {
          text: [
            '📖 SHAXSIY RIVOJLANISH — Muloqot — bu sehrli kalit!',
            '',
            "Agar kim bilandir urishib qolsang, u bilan gaplashmasang — dildan uzoqlashib ketasan.",
            '',
            "Lekin agar yuragingdagi gapni aytsang, 'kechirasan', 'meni xafa qilding', 'sen men uchun muhimsan' desang — hamma narsa tuzaladi.",
            '',
            "Muloqot qilish bu faqat gapirish emas — bu eshitish, tushunish va sabr qilish.",
            '',
            "Men o'zim ham ilgari jimgina yurardim, endi esa har safar biror muammo bo'lsa, tinchgina gaplashaman.",
            '',
            "Natijada, hamma muammoni hal qila boshladim, do'stlarim ko'paydi va ota-onam bilan munosabatim ancha yaxshilandi!",
            '',
            "Sizga ham maslahat: jim yurishdan ko'ra, dildan gaplashishni o'rganing. Chunki muloqot — bu qalbdan qalbga yo'ldir.",
            '',
            "❓ Do'sting bilan urishib qolding. Eng to'g'ri yo'l:",
          ].join('\n'),
          options: [
            "Tinchgina gaplashish va yuragingdagi gapni aytish",
            "Jimgina o'tirish va kutish",
            "Boshqa do'stlarga aytish",
            "Urishib qolishni unutib yuborish",
          ],
          correct: 0,
        },
      ]),
      mcq([{ text: "Muloqot qilish deganda nima tushuniladi?", options: ["Faqat gapirish", "Eshitish, tushunish va sabr qilish", "Baqirish va talab qilish", "Jimgina o'tirish"], correct: 1 }]),
      mcq([{ text: "Kim bilandir gaplashmaslik nimaga olib keladi?", options: ["Muammo hal bo'ladi", "Dildan uzoqlashish", "Do'stlik kuchayadi", "Hech narsa o'zgarmaydi"], correct: 1 }]),
      mcq([{ text: "'Sen men uchun muhimsan' deyish nimani bildiradi?", options: ["Zaiflikni", "Kuchni va munosabatni qadrlashni", "Kekkayishni", "Qo'rquvni"], correct: 1 }]),
      mcq([{ text: "Muloqotning eng muhim qismi:", options: ["Ko'p gapirish", "Tez gapirish", "Eshitish va tushunish", "Baland ovozda gapirish"], correct: 2 }]),
      mcq([{ text: "Dildan gapirish natijasida nima o'zgaradi?", options: ["Hech narsa", "Muammolar hal bo'ladi va munosabatlar yaxshilanadi", "Yangi muammolar paydo bo'ladi", "Do'stlar kamayadi"], correct: 1 }]),
      mcq([{ text: "Do'sting seni xafa qildi. Eng to'g'ri harakat:", options: ["Unga javob bermay ketish", "'Meni xafa qilding' deb tinchgina aytish", "Boshqa do'stlarga shikoyat qilish", "Uning bilan munosabatni uzish"], correct: 1 }]),
      mcq([{ text: "Muloqot qalbdan qalbga yo'l bo'lishi uchun nima kerak?", options: ["Baland ovoz", "Sabr, eshitish va samimiylik", "Ko'p so'z", "Tezlik"], correct: 1 }]),
      mcq([{ text: "'Kechirasan' deyish nima beradi?", options: ["Zaiflik ko'rsatadi", "Munosabatni tiklaydi va ishonch oshiradi", "Boshqalarni kuldiradi", "Hech narsa bermaydi"], correct: 1 }]),
      mcq([{ text: "Jim yurish va gapirmaslik odatda:", options: ["Muammoni hal qiladi", "Munosabatni yaxshilaydi", "Muammoni chuqurlashtiradi", "Do'stlikni mustahkamlaydi"], correct: 2 }]),
      mcq([{ text: "Ota-onam bilan munosabatni yaxshilash uchun nima qilish kerak?", options: ["Jimgina turish", "Dildan va samimiy gaplashish", "Faqat ularning gapini tinglash", "Boshqalar orqali gapirish"], correct: 1 }]),
      mcq([{ text: "Sabr qilish muloqotda nima uchun muhim?", options: ["Sabr keraksiz", "Sabr boshqani tushunishga imkon beradi", "Sabr vaqtni yo'qotadi", "Sabr zaiflikni bildiradi"], correct: 1 }]),
      mcq([{ text: "Muloqot qilishdan oldin nima qilish zarur?", options: ["G'azablanish", "Yuragingdagi gapni aniqlash va sabr bilan tayyorlanish", "Boshqalarga aytish", "Kutib turish"], correct: 1 }]),
      mcq([{ text: "Biror narsani his qilsang, buni aytish:", options: ["Zaiflik belgisi", "Kuch va samimiylik belgisi", "Keraksiz harakat", "Faqat kichiklarga xos"], correct: 1 }]),
      mcq([{ text: "Muloqot orqali nima hal bo'ladi?", options: ["Faqat kichik muammolar", "Barcha muammolar muloqot bilan yaxshilanishi mumkin", "Hech narsa hal bo'lmaydi", "Faqat maktab muammolari"], correct: 1 }]),
      mcq([{ text: "Do'stlik qanday saqlanadi?", options: ["Hech narsa qilmasdan", "Ochiq va samimiy muloqot orqali", "Faqat birga o'ynab", "Boshqalarga ko'rsatib"], correct: 1 }]),
      mcq([{ text: "Muloqotning to'g'ri ta'rifi qaysi?", options: ["Faqat o'z fikrini aytish", "Eshitish, tushunish, sabr qilish va samimiy gapirish", "Baland ovozda gapirish", "Ko'p so'z ishlatish"], correct: 1 }]),
      mcq([{ text: "Muloqot yaxshilanishi uchun birinchi qadam:", options: ["Boshqalarni kutish", "O'zing birinchi bo'lib samimiy gapirish", "Jimgina o'tirish", "Boshqalarga shikoyat qilish"], correct: 1 }]),
      mcq([{ text: "Muloqot orqali do'stlarim ko'payishining sababi:", options: ["Ko'p gapirish", "Samimiy va ochiq muloqot insonga ishonch uyg'otadi", "Baland ovoz", "Ko'p do'stlarga aytish"], correct: 1 }]),
      mcq([{ text: "Qaysi holat muloqotga misol?", options: ["Do'stingga xafa bo'lganingni aytmasdan ketish", "Do'stingga 'meni xafa qilding, gaplashaylik' deyish", "Boshqalarga shikoyat qilish", "Jimgina o'zingni tutish"], correct: 1 }]),
    ],
  },

  // ── orderNumber 77 — STEP 71 — Composition "My course" (D) ─────────────────
  {
    orderNumber: 77,
    title: "STEP 71 — My course",
    type: LessonType.english,
    aiTutorEnabled: true,
    aiTutorContext: [
      'You are a friendly English coach for a young Uzbek learner.',
      "The student just composed a 'My A'lochi course' paragraph.",
      'Ask 3 short follow-up questions in English, one at a time, to extend the topic.',
      'Be encouraging. Keep responses to 1-2 sentences.',
      'English only — they are practising English.',
    ].join('\n'),
    components: [
      fillBlank("I love my ___ course.", "A'lochi", ["A'lochi", 'school', 'English', 'math']),
      fillBlank('I am a ___ at school.', 'pupil', ['pupil', 'teacher', 'director', 'coach']),
      fillBlank('My favourite subject is ___.', 'English', ['English', 'Math', 'Science', 'Art']),
      fillBlank('I am ___ years old.', 'twelve', ['ten', 'eleven', 'twelve', 'thirteen']),
      fillBlank('I am from a ___.', 'city', ['city', 'village', 'country', 'town']),
      fillBlank('My teacher is very ___.', 'kind', ['kind', 'tall', 'clever', 'funny']),
      fillBlank('The course has ___ steps.', '500', ['100', '300', '500', '1000']),
      fillBlank('My favourite colour is ___.', 'red', ['red', 'blue', 'green', 'yellow']),
      // Translate key sentences
      translate("Men A'lochi kursimni yaxshi ko'raman.", "I love my A'lochi course"),
      translate("Men maktab o'quvchisiman.", 'I am a pupil at school'),
      translate("Men bir shahardanman.", 'I am from a city'),
      translate("Mening o'qituvchim juda mehribon.", 'My teacher is very kind'),
      translate("Kurs 500 ta qadamga ega.", 'The course has 500 steps'),
      translate("Mening sevimli rangim qizil.", 'My favourite colour is red'),
      // Word-order
      wordOrder([
        { words: ["A'lochi", 'course', 'my', 'love', 'I'], correct: "I love my A'lochi course" },
        { words: ['kind', 'very', 'is', 'teacher', 'My'], correct: 'My teacher is very kind' },
        { words: ['steps', '500', 'has', 'course', 'The'], correct: 'The course has 500 steps' },
        { words: ['school', 'at', 'pupil', 'a', 'am', 'I'], correct: 'I am a pupil at school' },
      ]),
      // Speak key sentences
      speakSentence("I love my A'lochi course", 70),
      speakSentence('My teacher is very kind', 70),
      speakSentence('The course has 500 steps', 70),
      speakSentence('I am a pupil at school', 70),
      speakSentence('My favourite colour is red', 70),
      // Comprehension MCQ
      mcq([
        { text: "'The course has 500 steps' — kursda nechta qadam bor?", options: ['100 ta', '300 ta', '500 ta', '1000 ta'], correct: 2 },
        { text: "'I am a pupil at school' — kim?", options: ["Talaba", "O'quvchi", "O'qituvchi", "Direktor"], correct: 1 },
        { text: "'My teacher is very kind' — o'qituvchi qanday?", options: ['Baland bo\'y', 'Mehribon', 'Aqlli', 'Kulgili'], correct: 1 },
      ]),
      speakWords(
        "I love my A'lochi course. I am a pupil at school. My favourite subject is English. I am twelve years old. I am from a city. My teacher is very kind. The course has 500 steps. My favourite colour is red.",
        70,
      ),
    ],
  },

  // ── orderNumber 56 — TAKRORLASH 41-51 (Checkpoint — Archetype F) ─────────────
  {
    orderNumber: 56,
    title: 'TAKRORLASH 41-51',
    type: LessonType.english,
    hasExam: true,
    nRepetitions: 5,
    components: [
      // ── Vocab match-pairs (3 rounds covering clothes/accessories + greetings) ──
      matchPairs([
        { left: 'gloves', right: "qo'lqoplar" },
        { left: 'hat', right: 'shlyapa' },
        { left: 'scarf', right: 'sharf' },
        { left: 'boots', right: 'etik' },
        { left: 'shoes', right: 'oyoq kiyim' },
        { left: 'handbag', right: 'sumka' },
      ]),
      matchPairs([
        { left: 'greeting', right: 'salomlashuv' },
        { left: 'how are you?', right: 'ahvolingiz yaxshimi' },
        { left: 'I am fine', right: 'Men yaxshiman' },
        { left: 'I am great', right: "Men zo'rman" },
        { left: 'I am not good', right: 'Men yaxshi emasman' },
        { left: 'Hello', right: 'Salom' },
      ]),
      matchPairs([
        { left: 'good morning', right: 'xayrli tong' },
        { left: 'good afternoon', right: 'xayrli kun' },
        { left: 'good evening', right: 'xayrli kech' },
        { left: 'good night', right: 'xayrli tun' },
      ]),
      // ── Phrase translates (UZ → EN) covering STEPs 41-51 functional phrases ──
      translate('Menga anavi ruchkani ber', 'Give me that pen'),
      translate('Bu kitobni ol', 'Take this book'),
      translate("Kitob o'qi", 'Read a book'),
      translate("Buni hozir to'xtat", 'Stop it right now'),
      translate('Qimirlama', 'Do not move'),
      translate("Tinch bo'ling", 'Be quiet'),
      translate("Stulga o'tiring", 'Sit on chair'),
      translate('Oshxonani tozala', 'Clean the kitchen'),
      translate('Derazani och', 'Open the window'),
      translate('Men tayyorman', 'I am ready'),
      translate("Keling, uyga", "Let's go home"),
      translate('Menga ergashing', 'Follow me'),
      translate("Ehtiyot bo'l", 'Be careful'),
      translate('Menga yordam ber', 'Help me'),
      translate('Bu qancha turadi?', 'How much is it?'),
      translate('Bu non arzon', 'This bread is cheap'),
      translate('U juda qimmat', 'It is very expensive'),
      translate('Buni sotib oling', 'Buy this one'),
      translate('davom eting', 'go on'),
      translate('Eshikni oching', 'Open the door'),
      translate('Eshikni yoping', 'Close the door'),
      translate("Chiroqni o'chiring", 'Turn off the light'),
      translate('Chiroqni yoqing', 'Turn on the light'),
      // ── Topic-sentence drills (am 3 / is 3 / are 3 / am not 1) ──
      wordOrder([
        { words: ['clever', 'very', 'am', 'I'], correct: 'I am very clever' },
        { words: ['astronaut', 'an', 'am', 'I'], correct: 'I am an astronaut' },
        { words: ['abroad', 'from', 'am', 'I'], correct: 'I am from abroad' },
        { words: ['sister', 'his', 'am', 'I'], correct: 'I am his sister' },
      ]),
      wordOrder([
        { words: ['beautiful', 'very', 'is', 'She'], correct: 'She is very beautiful' },
        { words: ['player', 'football', 'a', 'is', 'He'], correct: 'He is a football player' },
        { words: ['pupil', 'a', 'is', 'He'], correct: 'He is a pupil' },
        { words: ['baby', 'a', 'is', 'She'], correct: 'She is a baby' },
      ]),
      wordOrder([
        { words: ['friends', 'best', 'are', 'We'], correct: 'We are best friends' },
        { words: ['lazy', 'are', 'You'], correct: 'You are lazy' },
        { words: ['students', 'are', 'They'], correct: 'They are students' },
      ]),
      wordOrder([
        { words: ['English', 'not', 'am', 'I'], correct: 'I am not English' },
        { words: ['old', 'years', 'ten', 'not', 'am', 'I'], correct: 'I am not ten years old' },
        { words: ['city', 'this', 'from', 'not', 'am', 'I'], correct: 'I am not from this city' },
        { words: ['old', 'not', 'am', 'I'], correct: 'I am not old' },
      ]),
      // ── Speak-aloud key sentences ──
      speakSentence('I am very clever', 70),
      speakSentence('She is very beautiful', 70),
      speakSentence('We are best friends', 70),
      speakSentence('I am not English', 70),
      speakSentence('Good morning', 70),
      speakSentence('How are you?', 70),
      speakSentence("Let's go home", 70),
      // ── Composition recall (My house + Daily Routine) ──
      speakWords(
        'I want to talk about my house. My house is big and clean. There are five rooms. I love my house.',
        70,
      ),
      speakWords(
        "I want to talk about my daily routine. I wake up at six o'clock. I have breakfast at seven. After school, I do my homework. I go to bed at nine o'clock.",
        70,
      ),
    ],
  },
  {
    orderNumber: 67,
    title: 'TAKRORLASH 52-61',
    type: LessonType.english,
    hasExam: true,
    nRepetitions: 5,
    components: [
      // ── Vocab match-pairs (4 rounds covering kitchen + food, ~23 words) ──
      matchPairs([
        { left: 'kitchen', right: 'oshxona' },
        { left: 'fork', right: 'sanchqi' },
        { left: 'spoon', right: 'qoshiq' },
        { left: 'bowl', right: 'kosa' },
        { left: 'frying pan', right: 'tova' },
        { left: 'plate', right: 'likopcha' },
      ]),
      matchPairs([
        { left: 'chopping board', right: 'taxtakach' },
        { left: 'grater', right: "qirg'ich" },
        { left: 'cooker', right: 'gaz plita' },
        { left: 'knife', right: 'pichoq' },
        { left: 'fridge', right: 'muzlatgich' },
      ]),
      matchPairs([
        { left: 'hamburger', right: 'gamburger' },
        { left: 'french fries', right: 'kartoshka fri' },
        { left: 'chicken', right: "qovurilgan jo'ja" },
        { left: 'donut', right: 'teshik kulcha' },
        { left: 'hot dog', right: 'hot dog' },
        { left: 'pizza', right: 'pitsa' },
      ]),
      matchPairs([
        { left: 'cake', right: 'tort' },
        { left: 'sandwich', right: 'sendvich' },
        { left: 'spaghetti', right: 'spagetti' },
        { left: 'soup', right: "sho'rva" },
        { left: 'bread', right: 'non' },
        { left: 'meat', right: "go'sht" },
      ]),
      // ── Phrase translates (UZ → EN) ──
      translate('Men akangizni taniyman', 'I know your brother'),
      translate('Men uni tanimayman', 'I do not know him'),
      translate('Seni tushunaman', 'I understand'),
      translate('Bu mening ruchkam', 'This is my pen'),
      translate('Menga qalamingni ber', 'Give me your pencil'),
      translate('Lineyka qayerda?', 'Where is the ruler?'),
      translate("Sumkangni och", 'Open your backpack'),
      translate('Mening daftarim bor', 'I have a notebook'),
      translate("O'chirg'ich kichkina", 'The eraser is small'),
      translate('Bu parta toza', 'This desk is clean'),
      translate("Vaqt bo'ldi", 'Time is up'),
      translate('Men xonamni tozalayman', 'I clean my room'),
      translate('Kompyuterni yoqing', 'Turn on the computer'),
      translate('Sichqonchadan foydalaning', 'Use the mouse'),
      translate("Hikoya o'qing", 'Read a story'),
      translate("Yozib qo'ying", 'Write it down'),
      translate("O'qituvchiga quloq soling", 'Listen to the teacher'),
      translate("O'rningdan tur", 'Stand up'),
      translate("O'tir", 'Sit down'),
      translate('Kitobingni och', 'Open your book'),
      translate('Menda savol bor', 'I have a question'),
      translate('Iltimos, qaytaring', 'Repeat it, please'),
      translate('Sekin yuring', 'Walk slowly'),
      translate("Keling, endi o'ynaymiz", "Let's play now"),
      translate('Eshik tomon yugur', 'Run to the door'),
      translate('Juda baland sakra', 'Jump very high'),
      // ── Topic-sentence drills (is not, are not, am not 2) ──
      wordOrder([
        { words: ['17', 'not', 'is', 'He'], correct: 'He is not 17' },
        { words: ['actress', 'an', 'not', 'is', 'She'], correct: 'She is not an actress' },
        { words: ['elephant', 'an', 'not', 'is', 'It'], correct: 'It is not an elephant' },
        { words: ['toy', 'your', 'not', 'is', 'It'], correct: 'It is not your toy' },
      ]),
      wordOrder([
        { words: ['abroad', 'from', 'not', 'are', 'We'], correct: 'We are not from abroad' },
        { words: ['drummers', 'not', 'are', 'You'], correct: 'You are not drummers' },
        { words: ['young', 'not', 'are', 'They'], correct: 'They are not young' },
      ]),
      wordOrder([
        { words: ['brother', 'his', 'not', 'am', 'I'], correct: 'I am not his brother' },
        { words: ['singer', 'a', 'not', 'am', 'I'], correct: 'I am not a singer' },
        { words: ['cold', 'not', 'am', 'I'], correct: 'I am not cold' },
        { words: ['good', 'not', 'am', 'I'], correct: 'I am not good' },
      ]),
      // ── Speak-aloud key sentences ──
      speakSentence('He is not 17', 70),
      speakSentence('We are not from abroad', 70),
      speakSentence('I am not a singer', 70),
      speakSentence('I have a question', 70),
      speakSentence("Let's play now", 70),
      speakSentence('Stand up', 70),
      speakSentence('Time is up', 70),
      // ── Composition recall (My hobby) ──
      speakWords(
        'I have two hobbies. I like playing football. I play football with my friends after school. I also like learning English. I love my hobbies very much.',
        70,
      ),
    ],
  },

  // ── orderNumber 78 — TAKRORLASH 62-71 (Checkpoint — Archetype F) ─────────────
  {
    orderNumber: 78,
    title: 'TAKRORLASH 62-71',
    type: LessonType.english,
    hasExam: true,
    nRepetitions: 5,
    components: [
      // ── Vocab match-pairs (3 rounds: drinks + professions, 13 words total) ──
      matchPairs([
        { left: 'tea', right: 'choy' },
        { left: 'coffee', right: 'kofe' },
        { left: 'milk', right: 'sut' },
        { left: 'orange juice', right: 'apelsin sharbati' },
        { left: 'water', right: 'suv' },
        { left: 'lemon juice', right: 'limon sharbati' },
      ]),
      matchPairs([
        { left: 'coke', right: 'kola' },
        { left: 'painter', right: 'rassom' },
        { left: 'chef', right: 'oshpaz' },
        { left: 'policeman', right: 'politsiyachi' },
      ]),
      matchPairs([
        { left: 'astronaut', right: 'astronavt' },
        { left: 'waiter', right: 'ofitsiant' },
        { left: 'vet', right: 'veterinar' },
      ]),
      // ── Phrase translates (UZ → EN) ──
      translate('Devorga qarang', 'Look at the wall'),
      translate('Soat orqada qolyapti', 'The clock is slow'),
      translate('Xaritani yoping', 'Close the map'),
      translate('Quloqchinlaringizdan foydalaning', 'Use your headphones'),
      translate('Musiqani tinglang', 'Listen to the music'),
      translate('Ovozni balandlating, iltimos', 'Volume up, please'),
      translate('Endi sekin yur', 'Walk slowly now'),
      translate('Hovuzda suz', 'Swim in the pool'),
      translate("To'pni tutib ol", 'Catch the ball'),
      translate('Yuzingni yuv', 'Wash your face'),
      translate('Tishlaringni tozala', 'Brush your teeth'),
      translate('Sochingni tara', 'Comb your hair'),
      translate("Ko'ylagingni kiy", 'Put on your shirt'),
      translate("Oyoq kiyimingni bog'la", 'Tie your shoes'),
      translate('Paltoni yech', 'Take off the coat'),
      translate("O'rningni yig'ishtir", 'Make your bed'),
      translate('Maktabga bor', 'Go to the school'),
      translate("Do'stlarimni yaxshi ko'raman", 'I love my friends'),
      translate('Doskani tozala', 'Clean the board'),
      translate("Bo'r bo'lagini ol", 'Take a piece of chalk'),
      translate("Partangizga o'tiring", 'Sit at your desk'),
      translate('Oyga qara', 'Look at the moon'),
      translate('Yulduzlar yorqin', 'The stars are bright'),
      translate("Bugun yomg'irli kun", 'It is a rainy day'),
      // ── Topic-sentence drills (is not 2 / are not 2 / am not 3 / is not 3) ──
      wordOrder([
        { words: ['friend', 'my', 'not', 'is', 'He'], correct: 'He is not my friend' },
        { words: ['watch', 'a', 'not', 'is', 'It'], correct: 'It is not a watch' },
        { words: ['twenty', 'not', 'is', 'She'], correct: 'She is not twenty' },
      ]),
      wordOrder([
        { words: ['hungry', 'not', 'are', 'We'], correct: 'We are not hungry' },
        { words: ['policeman', 'a', 'not', 'are', 'You'], correct: 'You are not a policeman' },
        { words: ['friends', 'not', 'are', 'They'], correct: 'They are not friends' },
      ]),
      wordOrder([
        { words: ['abroad', 'from', 'not', 'am', 'I'], correct: 'I am not from abroad' },
        { words: ['engineer', 'an', 'not', 'am', 'I'], correct: 'I am not an engineer' },
        { words: ['chef', 'a', 'not', 'am', 'I'], correct: 'I am not a chef' },
      ]),
      wordOrder([
        { words: ['boxer', 'a', 'not', 'is', 'He'], correct: 'He is not a boxer' },
        { words: ['clever', 'not', 'is', 'Cat'], correct: 'Cat is not clever' },
        { words: ['doctor', 'a', 'not', 'is', 'She'], correct: 'She is not a doctor' },
      ]),
      // ── Speak-aloud key sentences ──
      speakSentence('He is not my friend', 70),
      speakSentence('We are not hungry', 70),
      speakSentence('I am not an engineer', 70),
      speakSentence('He is not a boxer', 70),
      speakSentence('Wash your face', 70),
      speakSentence('Look at the moon', 70),
      speakSentence('I love my friends', 70),
      // ── Composition recall (My course) ──
      speakWords(
        "I love my A'lochi course. My teacher is very kind. I am from a city. The course has 500 steps. My favourite colour is red. I am a pupil at school.",
        70,
      ),
    ],
  },

  // ── orderNumber 79 — STEP 72 — Vocab colors (B) ─────────────────────────────
  {
    orderNumber: 79,
    title: 'STEP 72 — Ranglar (1)',
    type: LessonType.english,
    components: [
      ...vocabBlock({ uz: 'qizil', en: 'red', distractors: ['green', 'yellow', 'blue'] }),
      ...vocabBlock({ uz: 'yashil', en: 'green', distractors: ['red', 'yellow', 'blue'] }),
      ...vocabBlock({ uz: 'sariq', en: 'yellow', distractors: ['red', 'green', 'blue'] }),
      ...vocabBlock({ uz: "ko'k", en: 'blue', distractors: ['red', 'green', 'yellow'] }),
      matchPairs([
        { left: 'red', right: 'qizil' },
        { left: 'green', right: 'yashil' },
        { left: 'yellow', right: 'sariq' },
        { left: 'blue', right: "ko'k" },
      ]),
      ...phraseBlock('Mushuk kichkina', 'The cat is small'),
      ...phraseBlock('Mening kuchugim jigarrang', 'My dog is brown'),
      ...phraseBlock("Men katta qushni ko'ryapman", 'I see a big bird'),
      matchPairs([
        { left: 'The cat is small', right: 'Mushuk kichkina' },
        { left: 'My dog is brown', right: 'Mening kuchugim jigarrang' },
        { left: 'I see a big bird', right: "Men katta qushni ko'ryapman" },
        { left: 'red', right: 'qizil' },
        { left: 'yellow', right: 'sariq' },
      ]),
      mcq([
        { text: "'Yashil' inglizcha nima?", options: ['red', 'green', 'yellow', 'blue'], correct: 1 },
        { text: "'Blue' o'zbek tilida nima?", options: ['qizil', 'yashil', 'sariq', "ko'k"], correct: 3 },
        { text: "'The cat is small' — mushuk qanday?", options: ['Katta', 'Jigarrang', 'Kichkina', 'Qizil'], correct: 2 },
        { text: "'My dog is brown' — itning rangi nima?", options: ["Ko'k", 'Sariq', 'Yashil', 'Jigarrang'], correct: 3 },
        { text: "'I see a big bird' — qush qanday?", options: ['Kichik', 'Katta', 'Sariq', 'Yashil'], correct: 1 },
      ]),
    ],
  },

  // ── orderNumber 80 — STEP 73 — "are not 3" (C) ──────────────────────────────
  {
    orderNumber: 80,
    title: 'STEP 73 — to be: are not (3-dars)',
    type: LessonType.english,
    components: [
      mcq([
        {
          text: "Ko'plik subject uchun inkor shaklini to'g'ri tanlang:",
          options: [
            'We is not from abroad',
            'We am not from abroad',
            'We are not from abroad',
            'We not abroad',
          ],
          correct: 2,
        },
      ]),
      ...topicSentenceBlock({ uz: 'Biz chet eldan emasmiz', en: 'We are not from abroad', words: ['We', 'are', 'not', 'from', 'abroad'] }),
      ...topicSentenceBlock({ uz: 'Siz quruvchi emassiz', en: 'You are not a builder', words: ['You', 'are', 'not', 'a', 'builder'] }),
      ...topicSentenceBlock({ uz: 'Ular quvnoq emaslar', en: 'They are not funny', words: ['They', 'are', 'not', 'funny'] }),
      ...topicSentenceBlock({ uz: "Ular bizning qo'shnimiz emas", en: 'They are not our neighbours', words: ['They', 'are', 'not', 'our', 'neighbours'] }),
      ...phraseBlock('Shirin olmani ye', 'Eat a sweet apple'),
      ...phraseBlock('Menga banan yoqadi', 'I like a banana'),
      ...phraseBlock('Apelsin sharbatini ich', 'Drink an orange juice'),
      matchPairs([
        { left: 'We are not from abroad', right: 'Biz chet eldan emasmiz' },
        { left: 'You are not a builder', right: 'Siz quruvchi emassiz' },
        { left: 'They are not funny', right: 'Ular quvnoq emaslar' },
        { left: 'Eat a sweet apple', right: 'Shirin olmani ye' },
        { left: 'I like a banana', right: 'Menga banan yoqadi' },
      ]),
      mcq([
        { text: "'We are not from abroad' — bu nima ma'noda?", options: ['Biz chet elliklar', 'Biz chet eldan emasmiz', 'Biz quruvchimiz', 'Biz chet elga boramiz'], correct: 1 },
        { text: "'You are not a builder' — to'g'ri tarjima:", options: ['Siz quruvchisiz', 'Siz quruvchi emassiz', 'Siz muhandissiz', 'Siz ishchi emassiz'], correct: 1 },
        { text: "Quyidagilardan qaysi biri to'g'ri?", options: ['They is not funny', 'They am not funny', 'They are not funny', 'They not funny'], correct: 2 },
        { text: "'Drink an orange juice' o'zbek tilida:", options: ['Apelsin ye', 'Apelsin sharbatini ich', 'Suv ich', 'Banan ye'], correct: 1 },
      ]),
    ],
  },

  // ── orderNumber 81 — STEP 74 — Vocab colors + days (B) ─────────────────────
  {
    orderNumber: 81,
    title: "STEP 74 — Ranglar (2) va Haftaning kunlari",
    type: LessonType.english,
    components: [
      ...vocabBlock({ uz: "to'q sariq", en: 'orange', distractors: ['purple', 'pink', 'brown'] }),
      ...vocabBlock({ uz: 'binafsha', en: 'purple', distractors: ['orange', 'pink', 'black'] }),
      ...vocabBlock({ uz: 'pushti', en: 'pink', distractors: ['orange', 'purple', 'white'] }),
      ...vocabBlock({ uz: 'qora', en: 'black', distractors: ['white', 'pink', 'orange'] }),
      ...vocabBlock({ uz: 'oq', en: 'white', distractors: ['black', 'purple', 'pink'] }),
      ...vocabBlock({ uz: 'jigar', en: 'brown', distractors: ['orange', 'purple', 'black'] }),
      matchPairs([
        { left: 'orange', right: "to'q sariq" },
        { left: 'purple', right: 'binafsha' },
        { left: 'pink', right: 'pushti' },
        { left: 'black', right: 'qora' },
        { left: 'white', right: 'oq' },
        { left: 'brown', right: 'jigar' },
      ]),
      ...phraseBlock('Bugun dushanba', 'Today is Monday'),
      ...phraseBlock('Men seshanba kuni ishlayman', 'I work on Tuesday'),
      ...phraseBlock("Chorshanba kuni ko'rishish", 'Meet me on Wednesday'),
      ...phraseBlock("Payshanba kuni qo'ng'iroq qil", 'Call me on Thursday'),
      ...phraseBlock('Biz juma kuni dam olamiz', 'We rest on Friday'),
      ...phraseBlock("Yakshanba kuni ko'rishguncha", 'See you on Sunday'),
      matchPairs([
        { left: 'Today is Monday', right: 'Bugun dushanba' },
        { left: 'I work on Tuesday', right: 'Men seshanba kuni ishlayman' },
        { left: 'We rest on Friday', right: 'Biz juma kuni dam olamiz' },
        { left: 'See you on Sunday', right: "Yakshanba kuni ko'rishguncha" },
        { left: 'Call me on Thursday', right: "Payshanba kuni qo'ng'iroq qil" },
      ]),
      mcq([
        { text: "'Binafsha' inglizcha nima?", options: ['pink', 'orange', 'purple', 'brown'], correct: 2 },
        { text: "'Black' o'zbek tilida nima?", options: ['oq', 'qora', 'jigar', 'binafsha'], correct: 1 },
        { text: "'Today is Monday' — bugun qaysi kun?", options: ['Seshanba', 'Dushanba', 'Juma', 'Yakshanba'], correct: 1 },
        { text: "'We rest on Friday' — qachon dam olamiz?", options: ['Dushanba', 'Chorshanba', 'Juma', 'Yakshanba'], correct: 2 },
      ]),
    ],
  },

  // ── orderNumber 82 — STEP 75 — Personal Dev "Ibn Sino: bilimga chanqoqlik" (E) ─
  {
    orderNumber: 82,
    title: 'STEP 75 — Ibn Sino: bilimga chanqoqlik',
    type: LessonType.personal_development,
    nRepetitions: 1,
    aiTutorEnabled: true,
    aiTutorContext: [
      "Sen Aloqushsan, do'stona o'zbek bola. O'zbek tilida suhbatlash.",
      '',
      "Bola hozir ushbu mavzuni o'qidi: \"Ibn Sino — bilimga chanqoqlik\".",
      '',
      "Asosiy g'oya: Bilim — kuch. Har kuni ozgina o'qish, eshitgan narsani qayta so'rash va savol berish bilimni oshiradi.",
      '',
      "Boladan 3 ta savol so'ra (ketma-ket, javobiga qarab):",
      "1) \"Bu darsdan nima o'rganding?\"",
      "2) \"Bilimga chanqoq bo'lish deganda nima tushunasan?\"",
      "3) \"Ibn Sinodan qanday ibrat oldingiz?\"",
      '',
      'Har javobini hurmat qil, kichik maslahat ber. Maksimal 2-3 jumla.',
    ].join('\n'),
    components: [
      mcq([
        {
          text: [
            "📖 SHAXSIY RIVOJLANISH — Ibn Sino: bilimga chanqoqlik",
            '',
            "Salom, do'stlar! Abu Ali ibn Sino haqida eshitganmisiz? U 10 yoshida Qur'onni yod olgan, 18 yoshida esa tabib bo'lgan!",
            '',
            "U ilmga juda chanqoq edi. Biror narsani tushunmasa, tunlab o'ylardi, eshitganini yozib yurardi. Shuning uchun ham u eng buyuk olimlardan biri bo'ldi.",
            '',
            "Men undan shuni o'rgandim: bilim — bu kuch. Har kuni ozgina o'qish, eshitgan narsani qayta so'rash, savol berish — bu bilimga ochiq bo'lish demak.",
            '',
            "Biz ham hozirdan ilmga mehr qo'ysak, kelajakda o'zimizni va boshqalarni foydali ishlar bilan hayratlantira olamiz.",
            '',
            "Keling, Ibn Sino kabi bilimga chanqoq bo'laylik!",
            '',
            "❓ Bilimni qanday oshirish mumkin?",
          ].join('\n'),
          options: [
            "Har kuni ozgina o'qish va savol berish",
            "Faqat maktabda o'rganish",
            "Kitob o'qimasdan faqat tinglash",
            "Bilimni oshirishga hojat yo'q",
          ],
          correct: 0,
        },
      ]),
      mcq([{ text: "Ibn Sino necha yoshida Qur'onni yod olgan?", options: ['8 yoshida', '10 yoshida', '12 yoshida', '15 yoshida'], correct: 1 }]),
      mcq([{ text: "Ibn Sino necha yoshida tabib bo'lgan?", options: ['15 yoshida', '16 yoshida', '18 yoshida', '20 yoshida'], correct: 2 }]),
      mcq([{ text: "Ibn Sino biror narsani tushunmasa nima qilardi?", options: ["Darhol to'xtatardi", "Tunlab o'ylardi va yozib yurardi", "Boshqalardan so'rardi", "Tark etardi"], correct: 1 }]),
      mcq([{ text: "'Bilim — bu kuch' deganda nima tushuniladi?", options: ["Bilim og'ir narsa", "Bilim odamni kuchli va imkoniyatli qiladi", "Bilim faqat maktab uchun", "Bilim foydali emas"], correct: 1 }]),
      mcq([{ text: "Bilimga chanqoqlik nima degani?", options: ["Ko'p suv ichish", "Doim yangi narsa o'rganishga ishtiyoq sezish", "Faqat imtihonga tayyorlanish", "O'rganishdan charchash"], correct: 1 }]),
      mcq([{ text: "Har kuni ozgina o'qish nima uchun foydali?", options: ["Vaqtni o'ldiradi", "Asta-sekin bilimni oshirib boradi", "Hech qanday foydasi yo'q", "Faqat katta odamlarga foydali"], correct: 1 }]),
      mcq([{ text: "Savol berish nima uchun muhim?", options: ["Savol berish vaqtni oladi", "Savol berish bilimga ochiqlikni ko'rsatadi", "Savol berish zaiflikni bildiradi", "Savol berish keraksiz"], correct: 1 }]),
      mcq([{ text: "Eshitgan narsani qayta so'rash nima beradi?", options: ["Vaqtni yo'qotadi", "Bilimni mustahkamlaydi", "Boshqalarni bezovta qiladi", "Hech narsa bermaydi"], correct: 1 }]),
      mcq([{ text: "Ibn Sino qanday odam edi?", options: ["Dangasa", "Bilimga chanqoq va tirishqoq", "Beparvo", "Faqat kitob o'qigan"], correct: 1 }]),
      mcq([{ text: "Kelajakda boshqalarni hayratlantirishning yo'li:", options: ["Pul to'plash", "Hozirdan ilmga mehr qo'yish", "Mashg'ulotlardan qochish", "Faqat kutish"], correct: 1 }]),
      mcq([{ text: "Do'sting yangi narsani o'rganishga qiziqmayapti. Unga nima deysang?", options: ["'Kerak emas'", "'Ibn Sino kabi bilimga chanqoq bo'l'", "'Menga ham ahamiyati yo'q'", "'Keyinroq o'rganasan'"], correct: 1 }]),
      mcq([{ text: "Bilimga ochiq bo'lish uchun qaysi harakat to'g'ri?", options: ["Faqat TV ko'rish", "Har kuni o'qish, savol berish, qayta so'rash", "Bilimni yig'ib qo'ymaslik", "Faqat maktabda o'rganish"], correct: 1 }]),
      mcq([{ text: "Ibn Sinodan ibrat olish deganda:", options: ["Tabib bo'lish kerak", "Ilmga chanqoqlik va tirishqoqlikni egallash", "Qur'onni yod olish kerak", "10 yoshda katta odam bo'lish"], correct: 1 }]),
      mcq([{ text: "Bilim qachon kuchga aylanadi?", options: ["Yillar o'tgach", "Doim o'rganib, qo'llab va ulashganda", "Faqat imtihon topshirganda", "Boshqalarga ko'rsatganda"], correct: 1 }]),
      mcq([{ text: "Tunlab o'ylash Ibn Sinoda nimani ko'rsatadi?", options: ["U uxlamasdi", "U bilim uchun cheksiz sabr va tirishqoqlikka ega edi", "U bemor edi", "U gapirishni yoqtirmasdi"], correct: 1 }]),
      mcq([{ text: "Har kuni ozgina o'qish — bu qanday odatga misol?", options: ["Yomon odat", "Kichik lekin doimiy bilim oshirish odati", "Vaqtni o'ldirish odati", "Keraksiz odat"], correct: 1 }]),
      mcq([{ text: "Ilmga mehr qo'yish nima beradi?", options: ["Hech narsa", "Kelajakda o'zini va boshqalarni foydali ishlar bilan hayratlantirishni", "Faqat maktabda yaxshi baho", "Tezda boy bo'lishni"], correct: 1 }]),
      mcq([{ text: "Qaysi gap Ibn Sino hayotini eng yaxshi ifodalaydi?", options: ["U faqat kitob o'qigan", "U bilimga chanqoqlik bilan buyuk olimga aylangan", "U omadli bo'lgan", "U boshqalarga o'rgatmagan"], correct: 1 }]),
      mcq([{ text: "Sog'lom bilimga munosabat:", options: ["'Bilim og'ir, menga kerak emas'", "'Har kuni ozgina o'qiy, savol beray, o'sayin'", "'Faqat imtihon uchun o'qiyman'", "'Boshqalar o'rgansin'"], correct: 1 }]),
    ],
  },

  // ── orderNumber 83 — STEP 76 — Topic questions "is" (C) ─────────────────────
  {
    orderNumber: 83,
    title: "STEP 76 — to be: Is (savol shakli)",
    type: LessonType.english,
    components: [
      mcq([
        {
          text: "He/she/it yoki yakkabosh ot uchun savol shaklini to'g'ri tanlang:",
          options: [
            'Are he your brother?',
            'Am he your brother?',
            'Is he your brother?',
            'Do he your brother?',
          ],
          correct: 2,
        },
      ]),
      ...topicSentenceBlock({ uz: 'U sizning akangizmi?', en: 'Is he your brother?', words: ['Is', 'he', 'your', 'brother', '?'] }),
      ...topicSentenceBlock({ uz: 'U yoqimtoymi?', en: 'Is she cute?', words: ['Is', 'she', 'cute', '?'] }),
      ...topicSentenceBlock({ uz: 'It yuvoshmi?', en: 'Is the dog friendly?', words: ['Is', 'the', 'dog', 'friendly', '?'] }),
      ...topicSentenceBlock({ uz: 'Stol oq ranglimi?', en: 'Is the table white colour?', words: ['Is', 'the', 'table', 'white', 'colour', '?'] }),
      ...phraseBlock('Oshxonaga bor', 'Go to the kitchen'),
      ...phraseBlock('Yotoqxona toza', 'The bedroom is clean'),
      ...phraseBlock('Dahlizda qoling', 'Stay in the hall'),
      matchPairs([
        { left: 'Is he your brother?', right: 'U sizning akangizmi?' },
        { left: 'Is she cute?', right: 'U yoqimtoymi?' },
        { left: 'Is the dog friendly?', right: 'It yuvoshmi?' },
        { left: 'Go to the kitchen', right: 'Oshxonaga bor' },
        { left: 'The bedroom is clean', right: 'Yotoqxona toza' },
      ]),
      mcq([
        { text: "'Is' bilan savol qaysi subject uchun ishlatiladi?", options: ['I', 'We / You / They', 'He / She / It / yakkabosh ot', 'Hammasi uchun bir xil'], correct: 2 },
        { text: "'Is the dog friendly?' — to'g'ri tarjima:", options: ['It aqllimi?', 'It yuvoshmi?', 'It sekinmi?', 'It kattami?'], correct: 1 },
        { text: "'Stay in the hall' o'zbek tilida:", options: ['Oshxonaga bor', 'Yotoqxonada qol', 'Dahlizda qoling', 'Hovlida tur'], correct: 2 },
        { text: "Quyidagilardan qaysi savol to'g'ri tuzilgan?", options: ['Is the table white colour?', 'Are the table white colour?', 'Am the table white colour?', 'Do the table white colour?'], correct: 0 },
      ]),
    ],
  },

  // ── orderNumber 84 — STEP 77 — Vocab bedroom (B) ────────────────────────────
  {
    orderNumber: 84,
    title: "STEP 77 — Yotoqxona jihozlari",
    type: LessonType.english,
    components: [
      ...vocabBlock({ uz: 'yotoq', en: 'bed', distractors: ['pillow', 'blanket', 'lamp'] }),
      ...vocabBlock({ uz: 'yostiq', en: 'pillow', distractors: ['bed', 'blanket', 'lamp'] }),
      ...vocabBlock({ uz: 'adyol', en: 'blanket', distractors: ['bed', 'pillow', 'lamp'] }),
      ...vocabBlock({ uz: 'lampa', en: 'lamp', distractors: ['bed', 'pillow', 'blanket'] }),
      matchPairs([
        { left: 'bed', right: 'yotoq' },
        { left: 'pillow', right: 'yostiq' },
        { left: 'blanket', right: 'adyol' },
        { left: 'lamp', right: 'lampa' },
      ]),
      ...phraseBlock('Stolni bezat', 'Set the table'),
      ...phraseBlock('Menga tuzni uzatib yubor', 'Pass me the salt'),
      ...phraseBlock('Kechki ovqat tayyor', 'Dinner is ready'),
      matchPairs([
        { left: 'Set the table', right: 'Stolni bezat' },
        { left: 'Pass me the salt', right: 'Menga tuzni uzatib yubor' },
        { left: 'Dinner is ready', right: 'Kechki ovqat tayyor' },
        { left: 'bed', right: 'yotoq' },
        { left: 'blanket', right: 'adyol' },
      ]),
      mcq([
        { text: "'Yostiq' inglizcha nima?", options: ['bed', 'blanket', 'pillow', 'lamp'], correct: 2 },
        { text: "'Blanket' o'zbek tilida nima?", options: ['yotoq', 'yostiq', 'adyol', 'lampa'], correct: 2 },
        { text: "'Pass me the salt' — bu nima ma'noda?", options: ['Stolni bezat', 'Menga tuzni uzatib yubor', 'Kechki ovqat tayyor', "Suv keltir"], correct: 1 },
        { text: "'Dinner is ready' o'zbek tilida:", options: ['Tushlik tayyor', 'Nonushta tayyor', 'Kechki ovqat tayyor', 'Ovqat emas'], correct: 2 },
        { text: "'Lamp' o'zbek tilida nima?", options: ['yotoq', 'yostiq', 'adyol', 'lampa'], correct: 3 },
      ]),
    ],
  },

  // ── orderNumber 85 — STEP 78 — Topic questions "are" (C) ────────────────────
  {
    orderNumber: 85,
    title: "STEP 78 — to be: Are (savol shakli)",
    type: LessonType.english,
    components: [
      mcq([
        {
          text: "We / You / They yoki ko'plik ot uchun savol shaklini to'g'ri tanlang:",
          options: [
            'Is we schoolmates?',
            'Am we schoolmates?',
            'Are we schoolmates?',
            'Do we schoolmates?',
          ],
          correct: 2,
        },
      ]),
      ...topicSentenceBlock({ uz: 'Biz maktabdoshlarmizmi?', en: 'Are we schoolmates?', words: ['Are', 'we', 'schoolmates', '?'] }),
      ...topicSentenceBlock({ uz: "Siz o'qituvchimisiz?", en: 'Are you a teacher?', words: ['Are', 'you', 'a', 'teacher', '?'] }),
      ...topicSentenceBlock({ uz: 'Ular bir shahardan mi?', en: 'Are they from the same city?', words: ['Are', 'they', 'from', 'the', 'same', 'city', '?'] }),
      ...topicSentenceBlock({ uz: 'Ular kelishgan qomatlimi?', en: 'Are they well-built?', words: ['Are', 'they', 'well-built', '?'] }),
      ...phraseBlock('Menga hikoya aytib ber', 'Tell me a story'),
      ...phraseBlock('Iltimos, sekin gapiring', 'Speak slowly, please'),
      ...phraseBlock('Men sizni eshityapman', 'I hear you now'),
      matchPairs([
        { left: 'Are we schoolmates?', right: 'Biz maktabdoshlarmizmi?' },
        { left: 'Are you a teacher?', right: "Siz o'qituvchimisiz?" },
        { left: 'Are they from the same city?', right: 'Ular bir shahardan mi?' },
        { left: 'Tell me a story', right: 'Menga hikoya aytib ber' },
        { left: 'Speak slowly, please', right: 'Iltimos, sekin gapiring' },
      ]),
      mcq([
        { text: "'Are' bilan savol qaysi subject uchun ishlatiladi?", options: ['He / She / It', 'I', "We / You / They / ko'plik ot", 'Faqat you uchun'], correct: 2 },
        { text: "'Are we schoolmates?' — to'g'ri tarjima:", options: ["Biz sinfdoshlarmizmi?", "Biz maktabdoshlarmizmi?", "Biz o'quvchilarmizmi?", "Biz do'stlarmizmi?"], correct: 1 },
        { text: "'Speak slowly, please' o'zbek tilida:", options: ['Tez gapiring', 'Iltimos, sekin gapiring', 'Menga hikoya aytib ber', 'Men sizni eshityapman'], correct: 1 },
        { text: "Quyidagilardan qaysi savol to'g'ri tuzilgan?", options: ['Is they well-built?', 'Am they well-built?', 'Are they well-built?', 'Do they well-built?'], correct: 2 },
      ]),
    ],
  },

  // ── orderNumber 86 — STEP 79 — Vocab room items (B) ─────────────────────────
  {
    orderNumber: 86,
    title: "STEP 79 — Xona buyumlari",
    type: LessonType.english,
    components: [
      ...vocabBlock({ uz: 'kitob javoni', en: 'bookshelf', distractors: ['poster', 'desk', 'chair'] }),
      ...vocabBlock({ uz: 'plakat', en: 'poster', distractors: ['bookshelf', 'desk', 'chair'] }),
      ...vocabBlock({ uz: 'budilnik', en: 'alarm clock', distractors: ['bookshelf', 'poster', 'toys'] }),
      ...vocabBlock({ uz: "o'yinchoqlar", en: 'toys', distractors: ['poster', 'alarm clock', 'desk'] }),
      ...vocabBlock({ uz: 'parta', en: 'desk', distractors: ['bookshelf', 'poster', 'chair'] }),
      ...vocabBlock({ uz: 'stul', en: 'chair', distractors: ['bookshelf', 'desk', 'toys'] }),
      matchPairs([
        { left: 'bookshelf', right: 'kitob javoni' },
        { left: 'poster', right: 'plakat' },
        { left: 'alarm clock', right: 'budilnik' },
        { left: 'toys', right: "o'yinchoqlar" },
        { left: 'desk', right: 'parta' },
        { left: 'chair', right: 'stul' },
      ]),
      ...phraseBlock("Bugun tug'ilgan kunim", 'Today is my birthday'),
      ...phraseBlock('Shoshma', "Don't rush"),
      ...phraseBlock('U yordam beradi', 'It helps'),
      ...phraseBlock('Charchadingizmi?', 'Are you tired?'),
      ...phraseBlock('Men juda jasurman', 'I am very brave'),
      ...phraseBlock("Xafa bo'lma", 'Do not be sad'),
      matchPairs([
        { left: 'Today is my birthday', right: "Bugun tug'ilgan kunim" },
        { left: "Don't rush", right: 'Shoshma' },
        { left: 'I am very brave', right: 'Men juda jasurman' },
        { left: 'Do not be sad', right: "Xafa bo'lma" },
        { left: 'Are you tired?', right: 'Charchadingizmi?' },
      ]),
      mcq([
        { text: "'Kitob javoni' inglizcha nima?", options: ['poster', 'desk', 'bookshelf', 'chair'], correct: 2 },
        { text: "'Alarm clock' o'zbek tilida nima?", options: ['stul', 'parta', 'plakat', 'budilnik'], correct: 3 },
        { text: "'Today is my birthday' o'zbek tilida:", options: ["Bugun dushanba", "Bugun tug'ilgan kunim", "Bugun bayram", "Bugun dam olish kuni"], correct: 1 },
        { text: "'Do not be sad' — bu nima ma'noda?", options: ["Xursand bo'l", "Xafa bo'lma", "Shoshma", "Jasur bo'l"], correct: 1 },
      ]),
    ],
  },

  // ── orderNumber 87 — STEP 80 — Personal Dev "Erinmay boshlash" (E) ───────────
  {
    orderNumber: 87,
    title: 'STEP 80 — Erinmay boshlash',
    type: LessonType.personal_development,
    nRepetitions: 1,
    aiTutorEnabled: true,
    aiTutorContext: [
      "Sen Aloqushsan, do'stona o'zbek bola. O'zbek tilida suhbatlash.",
      '',
      "Bola hozir ushbu mavzuni o'qidi: \"Uyga vazifa qilishga erinayapman...\"",
      '',
      "Asosiy g'oya: Erinish vaqtinchalik, lekin vazifani kechiktirish uni og'irlashtiradi. '5 daqiqa' usuli bilan boshlash — eng yaxshi yo'l.",
      '',
      "Boladan 3 ta savol so'ra (ketma-ket, javobiga qarab):",
      "1) \"Bu darsdan nima o'rganding?\"",
      "2) \"Uyga vazifa qilishga eringaningda nima his qilasan?\"",
      "3) \"'5 daqiqa' usulini o'zingda sinab ko'rganmisan?\"",
      '',
      'Har javobini hurmat qil, kichik maslahat ber. Maksimal 2-3 jumla.',
    ].join('\n'),
    components: [
      mcq([
        {
          text: [
            '📖 SHAXSIY RIVOJLANISH — Uyga vazifa qilishga erinayapman...',
            '',
            'Siz ham uyga vazifa qilishga erinayapsizmi? Men ham erinardim.',
            '',
            "Lekin keyin o'yladim: hozir 15 daqiqa erinib yotsam, ertaga bu ish 30 daqiqaga aylanadi. Vazifalar yig'ilib ketadi, keyin asabiylashaman.",
            '',
            "Endi o'zimni shunday aldab boshlayman: 'Faqat 5 daqiqa qilaman', deyman. Ammo boshlaganimdan keyin o'zim bilmay 20 daqiqa bo'lib ketadi!",
            '',
            "Vazifani qilish bu o'zingni yaxshi qilish degani. Bugun ozroq mehnat — ertaga ko'proq dam olish!",
            '',
            "Keling, erinmay boshlaylik. Boshlasang — yenggansan!",
            '',
            "❓ Vazifa qilishga erinayapsan. Eng to'g'ri qadam:",
          ].join('\n'),
          options: [
            "Ertaga qilaman, hozir dam olaman",
            "'Faqat 5 daqiqa qilaman' deb boshlayman",
            "Vazifani umuman qilmayman",
            "Do'stimdan ko'chirib olaman",
          ],
          correct: 1,
        },
      ]),
      mcq([{ text: "Hozir 15 daqiqa erinib yotsang, ertaga bu ish qancha bo'ladi?", options: ['15 daqiqa', '20 daqiqa', '30 daqiqa', '1 soat'], correct: 2 }]),
      mcq([{ text: "'Faqat 5 daqiqa qilaman' usulining maqsadi nima?", options: ["Vazifani qisqartirish", "Boshlab yuborish — chunki boshlagach to'xtash qiyin", "Vaqtni hisoblash", "O'qituvchiga aytish"], correct: 1 }]),
      mcq([{ text: "Vazifani kechiktirish nimaga olib keladi?", options: ["Kamroq ish qolishiga", "Vazifalar yig'ilib, asabiylashishga", "Ko'proq dam olishga", "Hech narsaga"], correct: 1 }]),
      mcq([{ text: "'Boshlasang — yenggansan!' deganda nima tushuniladi?", options: ["Birinchi bo'lib tugating", "Boshlash eng qiyin qadam, boshlagach osonlashadi", "Tez yozib tugating", "Kimgadir isbotlang"], correct: 1 }]),
      mcq([{ text: "'5 daqiqa' usuli bilan boshlagandan keyin nima bo'ladi?", options: ["Darhol to'xtatib qo'yiladi", "O'zingiz bilmay 20 daqiqa ishlagan bo'lasiz", "Vazifa og'irlashadi", "Hech narsa o'zgarmaydi"], correct: 1 }]),
      mcq([{ text: "Vazifani qilish nima degani?", options: ["O'qituvchiga yaxshi ko'rinish", "O'zingni yaxshi qilish", "Vaqtni o'ldirish", "Ko'chirib olish"], correct: 1 }]),
      mcq([{ text: "Bugun ozroq mehnat qilsang, ertaga nima bo'ladi?", options: ["Yangi vazifalar keladi", "Ko'proq dam olasiz", "Kamroq uyqusiz", "Boshqalardan orqada qolasiz"], correct: 1 }]),
      mcq([{ text: "Erinish nima sababdan vazifani og'irlashtiradi?", options: ["Vazifa qiyinlashadi", "Vazifalar yig'ilib, soni va og'irligi ortadi", "O'qituvchi qo'shimcha vazifa beradi", "Vaqt tezroq o'tadi"], correct: 1 }]),
      mcq([{ text: "Do'sting vazifa qilishga erinayapti. Unga nima deysang?", options: ["'Qilmasa ham bo'ladi'", "'5 daqiqa qil, keyin ko'rasan'", "'Ko'chir menda'", "'Ertaga qilasan'"], correct: 1 }]),
      mcq([{ text: "O'zimni 'aldash' usuli nima uchun ishlaydi?", options: ["Chunki aldash foydali", "Chunki kichik maqsad bilan boshlash osonroq va boshlagach davom etish osonlashadi", "Chunki 5 daqiqa yetarli", "Chunki boshqalar ham shunday qiladi"], correct: 1 }]),
      mcq([{ text: "Asabiylashishning oldini olish uchun nima qilish kerak?", options: ["Ko'proq uxlash", "Vazifani o'z vaqtida boshlash", "Boshqalarga aytish", "Vazifadan qochish"], correct: 1 }]),
      mcq([{ text: "Qaysi gap erinishning oqibatini to'g'ri ifodalaydi?", options: ["Erinish har doim foydali", "Erinish vazifani yig'ib, og'irlashtiradi", "Erinish vaqtni tejaydi", "Erinish boshqalarga yordam beradi"], correct: 1 }]),
      mcq([{ text: "Sog'lom munosabat vazifaga:", options: ["'Baribir qilmayman'", "'Kechiktiraman'", "'Faqat 5 daqiqa boshlayman — keyin davom etaman'", "'Ko'chirib olaman'"], correct: 2 }]),
      mcq([{ text: "'Erinmay boshlash' darsining asosiy g'oyasi:", options: ["Tez yozish", "Boshlash eng muhim qadam — '5 daqiqa' usuli bilan boshlash osonlashadi", "Ko'p vaqt sarflash", "Boshqalardan o'rganish"], correct: 1 }]),
      mcq([{ text: "Kichik qadam bilan boshlash nima beradi?", options: ["Hech narsa", "Ishni boshlab yuborish impulsi va davom etish osonligini", "Faqat 5 daqiqalik ish", "Boshqalarga isbotlashni"], correct: 1 }]),
      mcq([{ text: "Vazifalar yig'ilib ketsa nima his qilinadi?", options: ["Xursandchilik", "Asabiylik va bosim", "Hech narsa", "Erkinlik"], correct: 1 }]),
      mcq([{ text: "Qaysi holat '5 daqiqa' usulining muvaffaqiyatini ko'rsatadi?", options: ["5 daqiqada tugatish", "5 daqiqa o'tgach ham davom etib, 20 daqiqa ishlash", "5 daqiqa dam olish", "5 daqiqa o'ylab turish"], correct: 1 }]),
      mcq([{ text: "Bugun ozroq mehnat qilishning foydasi:", options: ["Hech narsa", "Ertaga ko'proq dam olish imkoniyati", "Tezroq boshqalardan o'tib ketish", "O'qituvchiga yoqish"], correct: 1 }]),
      mcq([{ text: "Qaysi gap to'g'ri?", options: ["Erinish muvaffaqiyatga olib boradi", "Boshlash — eng qiyin qadam, lekin boshlagach yengillashtiradi", "Vazifani kechiktirish yaxshi odat", "Erinish normal va muammosiz"], correct: 1 }]),
    ],
  },

  // ── Lesson 88: TAKRORLASH 1-80 — Yakuniy kurs imtihoni ──────────────────
  {
    orderNumber: 88,
    title: "TAKRORLASH 1-80 — Yakuniy kurs imtihoni",
    type: LessonType.english,
    hasExam: true,
    nRepetitions: 5,
    components: [
      // ── Vocab match-pairs: 7 rounds covering family / house / numbers / clothes / kitchen / food / professions+colors+room ──
      matchPairs([
        { left: 'mother', right: 'ona' },
        { left: 'father', right: 'ota' },
        { left: 'brother', right: 'aka' },
        { left: 'sister', right: 'opa' },
        { left: 'grandfather', right: 'buvajon' },
        { left: 'grandmother', right: 'buvijon' },
      ]),
      matchPairs([
        { left: 'house', right: 'uy' },
        { left: 'door', right: 'eshik' },
        { left: 'window', right: 'deraza' },
        { left: 'wall', right: 'devor' },
        { left: 'roof', right: 'tom' },
        { left: 'kitchen', right: 'oshxona' },
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
        { left: 'shoes', right: 'oyoq kiyim' },
        { left: 'hat', right: 'shlyapa' },
        { left: 'gloves', right: "qo'lqoplar" },
      ]),
      matchPairs([
        { left: 'fork', right: 'sanchqi' },
        { left: 'spoon', right: 'qoshiq' },
        { left: 'knife', right: 'pichoq' },
        { left: 'plate', right: 'likopcha' },
        { left: 'fridge', right: 'muzlatgich' },
        { left: 'cooker', right: 'gaz plita' },
      ]),
      matchPairs([
        { left: 'bread', right: 'non' },
        { left: 'meat', right: "go'sht" },
        { left: 'soup', right: "sho'rva" },
        { left: 'cake', right: 'tort' },
        { left: 'tea', right: 'choy' },
        { left: 'milk', right: 'sut' },
      ]),
      matchPairs([
        { left: 'painter', right: 'rassom' },
        { left: 'chef', right: 'oshpaz' },
        { left: 'astronaut', right: 'astronavt' },
        { left: 'red', right: 'qizil' },
        { left: 'blue', right: "ko'k" },
        { left: 'bed', right: 'yotoq' },
      ]),
      // ── Phrase translates: 25 representative across the whole curriculum ──
      translate('Xayrli tong!', 'Good morning!'),
      translate('Qalaysiz?', 'How are you?'),
      translate('Men yaxshiman', 'I am fine'),
      translate('Tanishganimdan xursandman', 'Nice to meet you'),
      translate('Raxmat', 'Thank you'),
      translate('Arzimaydi', 'You are welcome'),
      translate('Kechirasiz', 'I am sorry'),
      translate("Keyinroq ko'rishguncha", 'See you later'),
      translate('Men ochman', 'I am hungry'),
      translate('Suv, iltimos', 'Water, please'),
      translate('Menga bu yoqadi', 'I like it'),
      translate('Buni hozir qil', 'Do it now'),
      translate("Ehtiyot bo'l", 'Be careful'),
      translate('Bu qancha turadi?', 'How much is it?'),
      translate('Eshikni oching', 'Open the door'),
      translate('Eshikni yoping', 'Close the door'),
      translate('Chiroqni yoqing', 'Turn on the light'),
      translate("O'rningdan tur", 'Stand up'),
      translate("O'tir", 'Sit down'),
      translate('Sekin yuring', 'Walk slowly'),
      translate('Yuzingni yuv', 'Wash your face'),
      translate('Tishlaringni tozala', 'Brush your teeth'),
      translate('Maktabga bor', 'Go to the school'),
      translate("Do'stlarimni yaxshi ko'raman", 'I love my friends'),
      translate('Bugun dushanba', 'Today is Monday'),
      // ── Topic sentence drills: affirmative, negative, question patterns ──
      wordOrder([
        { words: ['pupil', 'a', 'I', 'am'], correct: 'I am a pupil' },
        { words: ['here', 'from', 'I', 'am'], correct: 'I am from here' },
        { words: ['strong', 'am', 'I'], correct: 'I am strong' },
      ]),
      wordOrder([
        { words: ['firefighter', 'a', 'is', 'He'], correct: 'He is a firefighter' },
        { words: ['friend', 'my', 'is', 'He'], correct: 'He is my friend' },
      ]),
      wordOrder([
        { words: ['doctor', 'a', 'is', 'She'], correct: 'She is a doctor' },
        { words: ['mother', 'my', 'is', 'She'], correct: 'She is my mother' },
      ]),
      wordOrder([
        { words: ['desk', 'my', 'is', 'It'], correct: 'It is my desk' },
        { words: ['big', 'very', 'is', 'It'], correct: 'It is very big' },
      ]),
      wordOrder([
        { words: ['abroad', 'from', 'are', 'We'], correct: 'We are from abroad' },
        { words: ['clever', 'are', 'We'], correct: 'We are clever' },
      ]),
      wordOrder([
        { words: ['student', 'a', 'are', 'You'], correct: 'You are a student' },
        { words: ['friend', 'my', 'are', 'You'], correct: 'You are my friend' },
      ]),
      wordOrder([
        { words: ['pilots', 'are', 'They'], correct: 'They are pilots' },
        { words: ['toys', 'are', 'They'], correct: 'They are toys' },
      ]),
      // negative forms
      wordOrder([
        { words: ['English', 'not', 'am', 'I'], correct: 'I am not English' },
        { words: ['old', 'not', 'am', 'I'], correct: 'I am not old' },
      ]),
      wordOrder([
        { words: ['17', 'not', 'is', 'He'], correct: 'He is not 17' },
        { words: ['actress', 'an', 'not', 'is', 'She'], correct: 'She is not an actress' },
      ]),
      wordOrder([
        { words: ['abroad', 'from', 'not', 'are', 'We'], correct: 'We are not from abroad' },
        { words: ['friends', 'not', 'are', 'They'], correct: 'They are not friends' },
      ]),
      // question forms
      wordOrder([
        { words: ['brother?', 'your', 'he', 'Is'], correct: 'Is he your brother?' },
        { words: ['friendly?', 'dog', 'the', 'Is'], correct: 'Is the dog friendly?' },
      ]),
      wordOrder([
        { words: ['schoolmates?', 'we', 'Are'], correct: 'Are we schoolmates?' },
        { words: ['teacher?', 'a', 'you', 'are'], correct: 'are you a teacher?' },
      ]),
      // ── Speak-aloud: 10 representative sentences ──
      speakSentence('I am a pupil', 70),
      speakSentence('He is my friend', 70),
      speakSentence('She is my mother', 70),
      speakSentence('We are clever', 70),
      speakSentence('They are my classmates', 70),
      speakSentence('I am happy', 70),
      speakSentence('I love my family', 70),
      speakSentence('Thank you', 70),
      speakSentence('Today is Monday', 70),
      speakSentence("I love my A'lochi course", 70),
      // ── Composition recall: 7 short paragraphs (one per composition lesson across the whole curriculum) ──
      speakWords(
        "Hello! I have a small family. I am 10 years old. I am from a city. I am a pupil at school. My favourite subject is English.",
        70,
      ),
      speakWords(
        "Hello! I have a small family. There are 4 people in my family. My father is kind. My mother is beautiful. I love my family.",
        70,
      ),
      speakWords(
        "Hello! I want to talk about my best friend. He is my best friend. He is from a small town. He is a good boy. I trust my friend.",
        70,
      ),
      speakWords(
        "I want to talk about my house. My house is big and clean. There are five rooms in my house. My room is small but nice. I love my house.",
        70,
      ),
      speakWords(
        "I want to talk about my daily routine. I wake up at six o'clock. I have breakfast at seven. After school, I do my homework. I go to bed at nine o'clock.",
        70,
      ),
      speakWords(
        "I have two hobbies. I like playing football. I play football with my friends after school. I also like learning English.",
        70,
      ),
      speakWords(
        "I love my A'lochi course. My teacher is very kind. I am from a city. The course has 500 steps. My favourite colour is red.",
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
