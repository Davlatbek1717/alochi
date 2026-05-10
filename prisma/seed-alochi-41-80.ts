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
      ...topicSentenceBlock({ uz: 'Men Xitoydanman', en: 'I am from China', words: ['I', 'am', 'from', 'China'] }),
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
      ...topicSentenceBlock({ uz: 'Sofiya chiroyli', en: 'Sofia is very beautiful', words: ['Sofia', 'is', 'very', 'beautiful'] }),
      ...topicSentenceBlock({ uz: 'Imronbek futbolchi', en: 'Imronbek is a football player', words: ['Imronbek', 'is', 'a', 'football', 'player'] }),
      ...topicSentenceBlock({ uz: "Muhammadali o'quvchi", en: 'Muhammadali is a pupil', words: ['Muhammadali', 'is', 'a', 'pupil'] }),
      ...topicSentenceBlock({ uz: 'Yasemin chaqaloq', en: 'Yasemin is a baby', words: ['Yasemin', 'is', 'a', 'baby'] }),
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
        { left: 'Sofia is very beautiful', right: 'Sofiya chiroyli' },
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
      ...topicSentenceBlock({ uz: 'Javohir va Quvonch murabbiylar', en: 'Javokhir and Quvonch are coaches', words: ['Javokhir', 'and', 'Quvonch', 'are', 'coaches'] }),
      ...topicSentenceBlock({ uz: 'Gulnoza va Dilnoza talabalar', en: 'Gulnoza and Dilnoza are students', words: ['Gulnoza', 'and', 'Dilnoza', 'are', 'students'] }),
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
      ...topicSentenceBlock({ uz: 'Men Toshkentdan emasman', en: 'I am not from Tashkent', words: ['I', 'am', 'not', 'from', 'Tashkent'] }),
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
        { words: ['China', 'from', 'am', 'I'], correct: 'I am from China' },
        { words: ['sister', 'his', 'am', 'I'], correct: 'I am his sister' },
      ]),
      wordOrder([
        { words: ['beautiful', 'very', 'is', 'Sofia'], correct: 'Sofia is very beautiful' },
        { words: ['player', 'football', 'is', 'Imronbek'], correct: 'Imronbek is football player' },
        { words: ['pupil', 'a', 'is', 'Muhammadali'], correct: 'Muhammadali is a pupil' },
        { words: ['baby', 'a', 'is', 'Yasemin'], correct: 'Yasemin is a baby' },
      ]),
      wordOrder([
        { words: ['friends', 'best', 'are', 'We'], correct: 'We are best friends' },
        { words: ['lazy', 'are', 'You'], correct: 'You are lazy' },
        { words: ['students', 'are', 'Dilnoza', 'and', 'Gulnoza'], correct: 'Gulnoza and Dilnoza are students' },
      ]),
      wordOrder([
        { words: ['English', 'not', 'am', 'I'], correct: 'I am not English' },
        { words: ['old', 'years', 'ten', 'not', 'am', 'I'], correct: 'I am not ten years old' },
        { words: ['Tashkent', 'from', 'not', 'am', 'I'], correct: 'I am not from Tashkent' },
        { words: ['old', 'not', 'am', 'I'], correct: 'I am not old' },
      ]),
      // ── Speak-aloud key sentences ──
      speakSentence('I am very clever', 70),
      speakSentence('Sofia is very beautiful', 70),
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
