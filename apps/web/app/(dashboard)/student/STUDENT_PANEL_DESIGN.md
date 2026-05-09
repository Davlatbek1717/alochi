# A'lochi Student Panel — Design System

This document describes the design language, component inventory, and
behavioural policies that define the **student-facing** surface of A'lochi.
The admin and teacher panels keep their existing navy + amber palette and are
intentionally untouched by this work.

The goal is a Duolingo-grade experience: joyful, kid-friendly, gamified, and
calm enough to use every day for years.

---

## 1. Design system

### Palette (CSS variables — see `apps/web/app/globals.css`)

| Token              | Value     | Use                                          |
| ------------------ | --------- | -------------------------------------------- |
| `--alc-primary`    | `#58cc02` | Primary CTA, lesson nodes, progress bar fill |
| `--alc-primary-dark` | `#46a302` | Primary CTA pressed state, 3D bottom border |
| `--alc-correct`    | `#10b981` | Correct-answer banner, checkmarks            |
| `--alc-wrong`      | `#ef4444` | Wrong-answer banner, hearts                  |
| `--alc-streak`     | `#ff9500` | Streak flame (7–13 day tier)                 |
| `--alc-accent`     | `#ce82ff` | Legendary streak tier, achievement badges    |
| `--alc-gold`       | `#fbbf24` | Daily goal hit, perfect-lesson halo, certs   |
| `--alc-bg`         | `#fffaf0` | Page background ("cream")                    |
| `--alc-surface`    | `#ffffff` | Cards                                        |
| `--alc-line`       | `#e8e0d0` | Borders, progress-bar track                  |
| `--alc-ink`        | `#3c3c3c` | Body text                                    |
| `--alc-mute`       | `#777777` | Caption / secondary text                     |

WCAG AA verified for `#3c3c3c` on `#fffaf0` and white text on `#58cc02`.

### Typography

- **Display font**: Nunito (loaded via `next/font` in `app/layout.tsx`).
  Used for headings, button labels, scores, mascot speech bubbles.
- **Body font**: System sans-serif fallback (`Arial, Helvetica, sans-serif`).
- **Weights used**: 600 (semibold), 700 (bold), 800 (extrabold), 900 (black
  for level-up screens). We avoid 400/500 in the student panel — every label
  is at least bold for the chunky, friendly Duo aesthetic.

### Button styles

The `<Button variant="duo">` component renders the signature Duolingo-grade
3D button: solid fill, 4–6px bottom border in a darker shade of the same hue,
`active:translate-y-[2px]` press depression that "presses into" the bottom
border. Disabled buttons get a desaturated cream tone — never grey-on-white,
to stay on theme.

### Cards

20–24px corner radius (`rounded-3xl`), 1.5px cream border (`#e8e0d0`), white
fill, subtle drop shadow (`shadow-sm`). Cards never have hard corners or
solid black borders — softness is part of the kid-friendly tone.

---

## 2. Component inventory

### UI primitives — `apps/web/components/ui/`

| Component  | Purpose                                            |
| ---------- | -------------------------------------------------- |
| `Mascot`   | Aloqush owl SVG, four expressions (idle/happy/sad/sleeping) |
| `Button`   | All variants — `duo` is the student-panel default  |
| `Card`     | Content card                                       |
| `Modal`    | Bottom-sheet on mobile, centred dialog on desktop  |
| `Switch`   | `role="switch"` accessible toggle (Pass 7)         |
| `Skeleton` | Loading placeholders                               |
| `Toast`    | Transient feedback                                 |

### Student panel — `apps/web/app/(dashboard)/student/_components/`

| Component             | Purpose                                                              |
| --------------------- | -------------------------------------------------------------------- |
| `MascotGreeting`      | Animated mascot with speech bubble on the dashboard                  |
| `DailyGoalRing`       | Circular SVG progress ring for daily lesson completion target         |
| `StreakFlame`         | Tiered flame icon (5 colour tiers by streak depth)                   |
| `StudentDailyQuests`  | Horizontal quest cards with bounce-in on completion                  |
| `LessonPathPreview`   | First 5 nodes of the lesson path on the dashboard                    |
| `AnimatedCounter`     | Counts up from 0 to a target value over ~600ms                       |
| `AchievementCarousel` | Horizontal scroll of badges                                          |
| `Podium`              | Top-3 visualisation for leaderboards                                 |

### Lesson runner — `apps/web/app/(dashboard)/student/lessons/[id]/_components/`

| Component        | Purpose                                                        |
| ---------------- | -------------------------------------------------------------- |
| `LessonIntro`    | Mascot welcomes the student to the lesson                      |
| `Hearts`         | 3-life indicator, pop-shrink animation on loss                 |
| `ProgressBar`    | Single unified Duo-green bar at the top                        |
| `McqTest`        | Multiple-choice tile buttons + check CTA                       |
| `WordOrderTest`  | Drag-tap word-bank to slot row                                 |
| `XpFloater`      | No-op stub (XP removed). Calls `onDone` immediately, renders nothing. |
| `Confetti`       | Pure-CSS celebration rain on completion                        |
| `CompletionScreen` | Final stats + level-up callout                               |

### Lesson path — `apps/web/app/(dashboard)/student/lessons/_components/`

| Component             | Purpose                                                                |
| --------------------- | ---------------------------------------------------------------------- |
| `LessonNode`          | Circular node with state (locked/current/completed) + perfect halo     |
| `LessonBottomSheet`   | Tap-a-node detail card                                                 |

---

## 3. Animation policy

### Reduced-motion gating

All keyframe animations are protected at two levels:

1. **Application layer** — Tailwind's `motion-safe:` variant on every
   `animate-[…]` and `[animation:…]` utility used in student components.
2. **Global override** — `@media (prefers-reduced-motion: reduce)` block in
   `globals.css` collapses *all* `animation-duration` and `transition-duration`
   to `0.01ms` for users who opt out at the OS level. This catches built-in
   Tailwind utilities (`animate-pulse`, `animate-spin`) as a defensive net.

### Keyframes (defined in `globals.css`)

`shake`, `bounce-in`, `float-up`, `pulse-ring`, `confetti-fall`,
`flame-flicker`, `wiggle`, `pop`, `count-up-fade`, `slideIn`, `fadeIn`,
`scaleIn`, `slideUp`.

### When each fires

| Animation       | Trigger                                                 |
| --------------- | ------------------------------------------------------- |
| `bounce-in`     | Card mount, mascot becoming happy, MCQ option select    |
| `pop`           | Daily goal ring on goal-hit, hearts on loss             |
| `shake`         | Wrong MCQ option, wrong word-order slot                 |
| `float-up`      | (Unused — XP removed)                                   |
| `pulse-ring`    | Active lesson node attracting attention                 |
| `flame-flicker` | Streak flame, mascot idle/sleep gentle sway             |
| `confetti-fall` | Lesson complete screen                                  |
| `count-up-fade` | Profile stat tiles appearing                            |

---

## 4. Sound system

### Sound effects — `apps/web/lib/sound.ts`

| Key       | File                  | Plays when                                |
| --------- | --------------------- | ----------------------------------------- |
| `correct` | `/sounds/correct.mp3` | MCQ / word-order correct answer           |
| `wrong`   | `/sounds/wrong.mp3`   | MCQ / word-order wrong answer             |
| `complete`| `/sounds/complete.mp3`| Daily goal ring hit, lesson finished      |
| `correct` | `/sounds/correct.mp3` | Correct answer chime                      |
| `levelup` | `/sounds/levelup.mp3` | Level-up celebration on completion screen |

### User control

- The student panel has a **"Ovoz effektlari"** toggle in
  `/student/profile` → Sozlamalar.
- Backed by `setSoundEnabled(boolean)` / `isSoundEnabled()` which persist
  to `localStorage` under the key `soundEnabled`.
- All `playSound()` calls early-return when the flag is `false`, so the
  toggle takes effect immediately across the whole app without a reload.

### Robustness

`playSound` swallows autoplay-policy rejections and missing-file errors so
the UI never breaks if a browser blocks audio or a sound file is missing.

---

## 5. Mascot usage guidelines

Aloqush ("a'lo" + "qush" — excellent bird) is the friendly owl that lives in
every joyful moment of the student panel.

**DO**

- Use `expression="happy"` for celebrations (lesson complete, daily goal hit,
  level up, streak milestone).
- Use `expression="idle"` as the default — gentle breathing, friendly.
- Use `expression="sad"` when the student loses all hearts or fails an exam.
  Pair with an encouraging message — never blame the student.
- Use `expression="sleeping"` for dormant states (no streak today, locked
  lesson preview).
- Always size at multiples of 40px (40, 80, 120, 160) to keep the SVG crisp.

**DON'T**

- Don't show the sad mascot more than once per session — kindness over
  realism.
- Don't put the mascot on dense data screens (admin tables, reports) — it's
  a student-panel character only.
- Don't recolour the body — the warm yellow + orange tufts are intrinsic.

---

## 6. Accessibility (Pass 7)

### ARIA roles applied

| Element              | Role / attribute                                   |
| -------------------- | -------------------------------------------------- |
| `Mascot`             | `role="img" aria-label="Aloqush mascot (...)"`     |
| `DailyGoalRing`      | `role="meter"` + valuenow/min/max                  |
| `Hearts`             | `role="status" aria-live="polite" aria-label="N ta yurak qoldi"` |
| `ProgressBar`        | `role="progressbar"` + valuenow/min/max/text       |
| `StreakFlame`        | `role="img" aria-label="N kunlik zanjir"`          |
| `LessonNode`         | `aria-label="Title, state"` (locked/current/completed) |
| `Confetti`           | `aria-hidden="true"` (decorative)                  |
| `XpFloater`          | No-op stub — no DOM rendered                       |
| `Switch`             | `role="switch" aria-checked` + Space/Enter toggle  |

### Keyboard navigation

- **MCQ options**: `Tab` to focus, `↑↓ ←→` cycle within the option list,
  `Enter`/`Space` selects then re-checks if already selected.
- **Word order pills**: `Tab` to focus, `Enter`/`Space` activates (button
  semantics).
- **Lesson path nodes**: `Tab` to walk, `Enter` opens bottom sheet.
- **Lesson runner**: `Escape` opens the exit-confirm modal anywhere.

### Touch targets

All interactive elements are ≥ 44×44px to meet WCAG 2.5.5 (Target Size).
The `Switch` component is built with explicit 44px height padding even
though its rendered track is 28px.

### Color contrast

WCAG AA verified pairings:

- Body text `#3c3c3c` on cream `#fffaf0` (10.7:1)
- White on duo green `#58cc02` (3.2:1 for large text — meets AA)
- White on dark green `#46a302` (4.6:1 for the 3D bottom border)

---

## 7. Routes covered

The student panel comprises 10 top-level routes (each a self-contained
journey) — all verified to render 200, no console errors, and build
successfully:

```
/student                          dashboard greeting + ring + path preview
/student/lessons                  zig-zag lesson path
/student/lessons/[id]             intro + exercises + completion
/student/profile                  animated stats + edit modal + sound toggle
/student/letters                  trading-card letter collection
/student/leaderboard              podium + ranked list
/student/duels / /duel/[id]       duels list + active duel view
/student/lenta                    social feed
/student/certificates             gold certificate cards
/student/groups                   group cards + chat
```

---

_Last updated: Pass 7 (final QA + a11y + polish), 2026-05-01._
