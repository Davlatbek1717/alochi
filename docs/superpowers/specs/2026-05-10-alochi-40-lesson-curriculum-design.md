# A'lochi 40-Step Curriculum — Lesson Authoring Design

**Date:** 2026-05-10
**Status:** Draft, awaiting user review
**Source:** `1-40_alochi.pdf` (Telegram-distributed A'lochi printed book, STEP 1-40)

---

## 1. Goal

Convert the printed A'lochi 40-step book into 44 platform lessons (40 from
the book + 4 review checkpoints) using the existing lesson + component
infrastructure. No new component types are introduced. The result must be
authored once via a seed script, then editable through the existing
superadmin lesson UI.

## 2. Scope and non-goals

**In scope**
- Categorise the 40 PDF STEPs into 5 lesson archetypes (greeting / vocab /
  topic-sentence / composition / personal-development).
- Define exactly which existing components each archetype uses, in what
  order, with what config, and at what `nRepetitions`.
- Add 4 standalone TAKRORLASH (review) checkpoint lessons after STEPs 11,
  21, 31, 40, each with full coverage of its range.
- Specify how speaking is submitted, how AI tutor is used in personal
  development lessons, and where critical-thinking moments are placed.
- Specify ordering: lessons numbered 1–44 with PDF STEP references in the
  title so admins can cross-check.

**Out of scope**
- New component types. The 14 existing exercise types
  (`mcq`, `word_order`, `vocabulary`, `translate`, `listen_pick`,
  `listen_type`, `match_pairs`, `pick_picture`, `fill_blank`, `spelling`,
  `order_sentences`, `speak_sentence`, `speak_words`, `ai_tutor`) cover
  every authoring need identified.
- New lesson type. Existing `english`, `personal_development`,
  `critical_thinking`, `experiment` enums suffice.
- Pictures (`pick_picture`, `listen_pick` with image options). The PDF has
  no illustrations — listen_pick uses text options only.
- Variant A/B tuning. Initial seed publishes a single canonical version;
  content-quality experiments are layered on later.
- Curriculum localisation. PDF is Uzbek + English; output mirrors that.
  No Russian/Karakalpak variants.

## 3. PDF content audit (40 STEPs)

Categorisation of every STEP in the source:

| STEP(s) | Archetype | What the page contains |
|---|---|---|
| 1, 2, 3, 4 | A. Greetings | 3-4 daily-greeting phrases each (UZ + EN + transcription) |
| 5, 10, 15, 20, 25, 30, 35, 40 | E. Personal Development | Full-page UZ essay + "Xulosa o'zingizdan" + family training task |
| 6, 8, 12, 14, 17, 19, 23, 26, 28, 32, 34, 37, 39 | B. Vocab + phrases | 4-5 single-word vocab entries (often family/house/numbers/clothes) + 3-4 phrases |
| 7, 9, 13, 16, 18, 22, 24, 27, 29, 33, 36, 38 | C. Topic sentences | One grammar topic (I / he / she / it / we / you / they / to be) with 4 example sentences + 3 phrases |
| 11, 21, 31 | D. Composition | Paragraph template ("About myself / About my family / My best friend") with personal fill-ins |

Repetition markers in the PDF:
- Almost every regular STEP carries a `TAKRORLASH: STEP X-Y` line — this
  is the book's instruction that the live class includes a brief recap
  of the previous 1-2 STEPs. We mirror this by injecting a small mixed
  recap of the 1-2 prior STEPs into each platform lesson.
- After STEPs 11, 21, 31, 40 the PDF has a dedicated `TAKRORLASH: 1-11`
  / `12-21` / `22-31` / `1-40` page — these become the 4 standalone
  checkpoint lessons.

## 4. Lesson plan: 44 lessons

`orderNumber` is contiguous 1–44. Checkpoint lessons take the slot
immediately after the last regular STEP they cover.

| orderNumber | Title (Uz) | PDF ref | Type | Archetype |
|---:|---|---|---|---|
| 1 | STEP 1 — Xayrli tong | STEP 1 | english | A |
| 2 | STEP 2 — Xayrli kun, kech | STEP 2 | english | A |
| 3 | STEP 3 — Xayrli tun, xayr | STEP 3 | english | A |
| 4 | STEP 4 — Qalaysiz? | STEP 4 | english | A |
| 5 | STEP 5 — Aqlli fikrlash | STEP 5 | personal_development | E |
| 6 | STEP 6 — Oila a'zolari (1) | STEP 6 | english | B |
| 7 | STEP 7 — I (men) | STEP 7 | english | C |
| 8 | STEP 8 — Oila a'zolari (2) | STEP 8 | english | B |
| 9 | STEP 9 — She (qiz bola) | STEP 9 | english | C |
| 10 | STEP 10 — Qo'rqmaslik | STEP 10 | personal_development | E |
| 11 | STEP 11 — About myself | STEP 11 | english | D |
| 12 | TAKRORLASH 1-11 | (review) | english | F |
| 13 | STEP 12 — Oila a'zolari (3) | STEP 12 | english | B |
| 14 | STEP 13 — He (o'g'il bola) | STEP 13 | english | C |
| 15 | STEP 14 — Uy qismlari (1) | STEP 14 | english | B |
| 16 | STEP 15 — O'zini solishtirmaslik | STEP 15 | personal_development | E |
| 17 | STEP 16 — It (predmet, hayvon) | STEP 16 | english | C |
| 18 | STEP 17 — Uy qismlari (2) | STEP 17 | english | B |
| 19 | STEP 18 — We (biz) | STEP 18 | english | C |
| 20 | STEP 19 — Xonalar | STEP 19 | english | B |
| 21 | STEP 20 — Xatolardan qo'rqmaslik | STEP 20 | personal_development | E |
| 22 | STEP 21 — About my family | STEP 21 | english | D |
| 23 | TAKRORLASH 12-21 | (review) | english | F |
| 24 | STEP 22 — You (sen, siz) | STEP 22 | english | C |
| 25 | STEP 23 — Sonlar 1-12 | STEP 23 | english | B |
| 26 | STEP 24 — They (ular) | STEP 24 | english | C |
| 27 | STEP 25 — Vaqtni qadrlash | STEP 25 | personal_development | E |
| 28 | STEP 26 — Sonlar 13-90 (o'nliklar) | STEP 26 | english | B |
| 29 | STEP 27 — to be: am | STEP 27 | english | C |
| 30 | STEP 28 — Sonlar 21-50 | STEP 28 | english | B |
| 31 | STEP 29 — to be: is | STEP 29 | english | C |
| 32 | STEP 30 — Katta orzu | STEP 30 | personal_development | E |
| 33 | STEP 31 — My best friend | STEP 31 | english | D |
| 34 | TAKRORLASH 22-31 | (review) | english | F |
| 35 | STEP 32 — Sonlar 51-69 | STEP 32 | english | B |
| 36 | STEP 33 — to be: are | STEP 33 | english | C |
| 37 | STEP 34 — Sonlar 71-100 | STEP 34 | english | B |
| 38 | STEP 35 — Do'st tanlash | STEP 35 | personal_development | E |
| 39 | STEP 36 — to be: am/is (2-dars) | STEP 36 | english | C |
| 40 | STEP 37 — Kiyimlar (1) | STEP 37 | english | B |
| 41 | STEP 38 — to be: are (2-dars) | STEP 38 | english | C |
| 42 | STEP 39 — Kiyimlar (2) | STEP 39 | english | B |
| 43 | STEP 40 — Ota-ona urishganida | STEP 40 | personal_development | E |
| 44 | TAKRORLASH 1-40 | (review) | english | F |

(STEP 28, 32, 34, 37, 39 each appear twice in the PDF — those are
two-page spreads. We treat each as one lesson covering both pages of
content.)

## 5. Component templates per archetype

### Archetype A — Greetings (4 lessons)

For each phrase in the page (3-4 phrases per lesson):
1. `listen_type` — TTS plays the EN phrase; student types what they hear.
2. `translate` — UZ prompt → EN text input (graded with fuzzy match).
3. `speak_sentence` — student speaks the EN phrase; minScore 70.

Plus a single `match_pairs` of 4-6 mixed UZ↔EN items from the prior STEP
(skip in STEP 1).

`nRepetitions: 3`. No video required.

### Archetype B — Vocab + phrases (13 lessons)

For each vocab word (4-5 per lesson):
1. `listen_pick` — TTS plays the EN word; student picks from 4 EN text
   options (3 distractors come from related vocab in the same lesson or
   the immediately prior lesson).
2. `spelling` — TTS plays the word; student types it letter-by-letter.
3. `translate` — UZ prompt → EN text input.
4. `speak_sentence` — speak the single word; minScore 65 (lower than
   sentence threshold because pronunciation of one isolated word is
   noisier than a sentence).

For each phrase (3-4 per lesson):
1. `listen_type`
2. `translate` (UZ → EN)
3. `speak_sentence` — minScore 70

Plus one `match_pairs` of 6 items pulled from the previous 1-2 STEPs.

Total ~25-30 components/lesson. `nRepetitions: 3`. No video.

### Archetype C — Topic sentences (12 lessons)

For each topic sentence (4 per lesson, e.g. "I am a pupil"):
1. `word_order` — words shuffled, student drags into correct order.
2. `translate` — UZ → EN text input.
3. `speak_sentence` — minScore 70.

Plus one `mcq` testing the grammar pattern itself — a critical-thinking
moment. Examples:

- STEP 7 (I-men): *"Quyidagilardan qaysi biri 'Men o'quvchiman'ning
  to'g'ri inglizcha tarjimasi?"* with 4 options.
- STEP 27 (to be: am): *"Ko'plik subjekti uchun 'am' ishlatamizmi?"* —
  no, "are". Student must reason about the rule.
- STEP 33 (to be: are): scenario MCQ — given a sentence "She ___ a
  doctor", which form fits.

Plus 3 phrases following the same `listen_type` / `translate` /
`speak_sentence` triple as in Archetype B.

Plus one `match_pairs` of 6 from the previous 1-2 STEPs.

Total ~22-25 components/lesson. `nRepetitions: 3`. No video.

### Archetype D — Composition (3 lessons: STEPs 11, 21, 31)

Template paragraphs with personal fill-ins. The PDF gives the template:

> Hello! My name is _____. My family is _____. I am _____ years old. I
> am from Bukhara. I live in Gijduvan. I am a pupil at school. My
> favourite subject is English. My favourite color is red. My favourite
> car is BMW.

For each fill-in line:
- `fill_blank` — the line with `___` for the personal slot. `alternatives`
  word bank includes likely answers ("Anvar", "small", "10", "Tashkent",
  "Samarqand", "red", "blue", "BMW", "Cobalt") so the student taps to
  fill rather than typing. `acceptedAnswers` is broad — any reasonable
  noun is allowed because the slot is personal.

After all fill-ins:
- `speak_words` — the full final paragraph, with the student's chosen
  fill-ins substituted in. To keep authoring simple in v1 the
  `speak_words` text is the **default** version (the canonical fills
  written into the PDF). Students see "Read this paragraph aloud" and
  speak whatever they composed; STT scores word-by-word against the
  default. minScore 70%.
  - Future iteration: dynamic substitution from fill_blank state into
    speak_words text. Out of v1 scope.
- `ai_tutor` — `aiTutorContext`:
  > "You are a friendly English coach for a young Uzbek learner. The
  > student just composed a paragraph about themselves [/family/best
  > friend]. Ask 3 short follow-up questions in English, one at a time,
  > to extend the topic. Be encouraging. Keep responses to 1-2 sentences.
  > English only — they are practising English."

Total ~14-18 components/lesson. `nRepetitions: 3`. No video.

### Archetype E — Personal Development (8 lessons)

Type: `personal_development`. No vocab/grammar. Pure reading +
reflection in Uzbek.

Per-lesson fields:
- `description`: 1-2 line tagline of the essay's main idea, shown on
  the intro screen.
- `aiTutorContext`: full essay text (~250 words) + the AI persona
  instruction (Uzbek-language Aloqush who asks 3 reflection questions).

Components:
1. One `mcq` — a scenario question that requires applying the essay's
   idea, not just remembering it. Example for STEP 5:
   > "Telefonni qo'lga olishdan oldin o'zingdan nima so'rashing kerak?"
   > A) "Hozir nima yangiliklar?" B) **"Bu meni aqlli va boy
   > qiladimi?"** C) "Do'stlarim nima qilyapti?"
2. `ai_tutor` enabled. The AI greets in Uzbek and walks through 3
   reflection questions:
   - "Sen bu darsdan nima o'rganding?"
   - "O'zingda qanday kichik o'zgartirish qilmoqchisan?"
   - "Bu fikrni kimga yetkazmoqchisan?"

`nRepetitions: 1`. No video. The "oilaga treyning" instruction is
mentioned in the intro/description; we do not enforce it (offline
honor-system).

### Archetype F — TAKRORLASH checkpoints (4 lessons)

Comprehensive review of every meaningful item in the range. The intent
("100% to'liq savol-javob") is satisfied by ensuring every vocab word,
every phrase, and every topic sentence in the range appears in at least
one component.

Component generation rule for the range:
- For every vocab word in range: one `translate` (UZ→EN) **and** one
  `match_pairs` slot. Vocab is bucketed into `match_pairs` rounds of 6
  pairs each (so 30 vocab words = 5 match_pairs components).
- For every phrase in range: one `translate` (UZ→EN) and one
  `speak_sentence`.
- For every topic sentence in range: one `word_order` and one
  `speak_sentence`.
- For every grammar topic in range: one `mcq` (reuse or vary the C-
  archetype grammar MCQs).

Estimated counts:
- TAKRORLASH 1-11: ~50 components.
- TAKRORLASH 12-21: ~70 components.
- TAKRORLASH 22-31: ~70 components.
- TAKRORLASH 1-40: ~150 components.

`nRepetitions: 5` for stronger retention; `hasExam: true` so a tester
opens the in-academy proctored attempt after the home reps.

The 1-40 final review is large but the platform's progress bar plus the
existing 90% video-completion + per-exercise pass logic will keep
sessions cohesive. If pilot students complain about session length we
can split TAKRORLASH 1-40 into two halves later — out of v1 scope.

## 6. Speaking submission UX (cross-cutting)

Already implemented; this design only **uses** the existing flow.

- `speak_sentence`: tap the round mic → record (5-bar waveform) → tap
  stop → upload base64 to `/ai/speech/assess` → 0–100 dial reveals →
  auto-advance when ≥ minScore. Mic-denied → "Skip" softpass so the
  lesson never softlocks.
- `speak_words`: live browser STT (en-US) word-stream. Each token
  coloured live. Pass on % correct ≥ minScore.

Defaults: minScore 70 for sentences and word-by-word; 65 for single
isolated vocab words (where STT noise dominates).

## 7. Where critical thinking is injected

Two places:

1. **Personal Development lessons (E, 8 places)** — the scenario MCQ at
   the top of each lesson asks the student to APPLY the essay's idea to
   a new situation, not just remember it. Section 5/Archetype E gives
   the example for STEP 5; the 7 other personal-development lessons
   each get a similar applied-judgment question.

2. **Topic-sentence lessons (C, 12 places)** — the grammar MCQ asks the
   student to reason about when a form applies (am vs is vs are; sing.
   vs plural subject; pronoun choice). This is rule-derivation, not
   recall.

Total: 20 explicit critical-thinking checkpoints across the 44 lessons.

## 8. Implementation approach

A standalone TypeScript seed script at
`prisma/seed-alochi-40.ts`, modelled on the existing `seed-demo.ts`:

1. Argument: `--tenant <slug>` (default `alochi`). Script refuses to
   run if the tenant doesn't exist.
2. The PDF content is encoded as a typed `LessonSpec[]` literal at the
   top of the script — one entry per lesson with title, type,
   nRepetitions, description, aiTutorContext, and the ordered list of
   components with their config blobs.
3. Inside a single Prisma transaction:
   - For each `LessonSpec`: upsert the `Lesson` row keyed by
     `(tenantId, orderNumber)`, then `deleteMany` and recreate the
     `LessonComponent` rows. Idempotent reruns are safe.
4. Logs each lesson + component count as it goes, prints a final
   summary table.

Why a script and not the UI:
- 44 lessons × ~25 components ≈ 1,100 component records. UI authoring
  takes weeks.
- The same script can re-run after any content tweak — admins still
  edit through the UI for one-off changes; a re-seed is only for bulk
  refreshes.

After seed runs: every lesson appears in `/superadmin/lessons` and the
admin can edit any field through the existing UI. Nothing in the seed
locks the rows.

## 9. Risks and open questions

- **Speaking grading on a single isolated word**: STT noise is
  meaningful. minScore 65 + soft-pass on assess failure should keep
  this from blocking learners; we'll watch the assess logs after the
  first cohort runs through.
- **AI tutor in Uzbek**: Gemini handles Uzbek but quality is uneven.
  The personal-development context prompt is short and prescriptive;
  if the AI drifts off-topic we can tighten the system prompt without
  re-seeding (admin edits `aiTutorContext` in the UI).
- **TAKRORLASH 1-40 size**: 150 components is the upper bound the
  current runner has been tested with. If telemetry shows session
  abandonment past component #80, split into "TAKRORLASH 1-40 (1-qism)"
  and "(2-qism)". Decision deferred to post-pilot.
- **Composition lesson speak_words substitution**: v1 grades against
  the canonical paragraph, not the student's personalised version. A
  motivated student who fills in different names will see word-stream
  red on those tokens. Acceptable for v1; future iteration substitutes
  from fill_blank state.
- **Tenant scoping**: the script seeds into ONE tenant. Multi-tenant
  rollout is a per-tenant rerun — there is no template-import path in
  v1.

## 10. Acceptance criteria

After the seed script runs against a clean tenant:

- [ ] `/superadmin/lessons` lists exactly 44 lessons with orderNumber 1–44.
- [ ] Lesson titles match the table in §4 exactly.
- [ ] Every Archetype A/B/C/D lesson has the component shape described in §5.
- [ ] Every Archetype E lesson has type `personal_development`, exactly
      one `mcq`, `aiTutorEnabled = true`, and a non-empty `aiTutorContext`.
- [ ] Every Archetype F lesson has `hasExam = true` and `nRepetitions = 5`.
- [ ] A student in the same tenant can open lesson 1, watch (no video),
      go through every component, finish, and have their progress row
      record `sessionCount = 1`.
- [ ] Re-running the seed script does not duplicate lessons or
      components — counts stay constant.
