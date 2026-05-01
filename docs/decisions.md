# A'lochi — Architectural & Product Decisions Log

This document records intentional deviations from the master spec and the
rationale behind them. Each entry is dated and references the spec section
plus the implementing commit so future contributors can recover the context.

---

## Lesson plan size — 250 vs 500

**Spec ref:** `docs/operations/2026-04-23-alochi-platform-design.md` §3.6.1
("500-step path map").

**Decision (commit `67d2687`, 2026-04-28):** Pilot launch ships with **250
unique lessons** rather than the 500 originally specified.

### Distribution (250 total)

| Track            | Lessons |
| ---------------- | ------- |
| Dunyoqarash      | 100     |
| Tanqidiy fikrlash | 50     |
| 20 ko'nikma      | 50      |
| Eksperiment      | 50      |

### Rationale

- **Pilot scope.** Authoring 500 high-quality lessons across all four tracks
  before launch would have pushed the pilot date out by ~2 quarters with no
  product-validation upside; pedagogy team only validated the first 250 in
  user testing.
- **Adaptive engine compensates.** The path map UI (`PathMap500` component)
  still renders 500 visual nodes by design — the adaptive scheduler cycles
  the 250 unique lessons through with N-repetition based on retention
  scores, so a learner's effective curriculum is well above 250 sessions.
- **Forward-compatible.** Expansion to 500 unique lessons is unblocked: just
  add additional rows to the `Lesson` curriculum table. No schema, routing,
  or progress-tracking changes are required.

### What this means for code reviewers

If you see code that loops `0..500` for path positions, that is correct and
intentional — the visual rail has 500 slots. If you see seed data or curriculum
imports stopping at 250, that is also correct and intentional. The two sizes
are not in conflict; they describe different layers (visual rail vs.
authored content).

---

## Branch friendships require 13+ age gate

**Spec ref:** `docs/operations/2026-04-24-social-features-design.md` §5.1.

**Decision (final-gap commit, 2026-05-01):** `FriendsService.sendRequest`
enforces a 13-year-old minimum **only when** `scope === 'branch'`.
Group-scope friendships (auto-created within the same group) bypass the age
gate because no cross-classroom data exposure occurs.

- 12-year-old → branch request → `ForbiddenException` with code
  `AGE_RESTRICTED_BRANCH_FRIENDSHIP`.
- 14-year-old → branch request → allowed.
- Any age → group request → allowed.
- `birthDate` null → branch request → allowed, but a warning is logged so
  operators can backfill missing DOB data.

This implements PDPL (O'zbekiston Respublikasining "Shaxsga doir ma'lumotlar
to'g'risida" qonuni) minor-protection requirements for cross-class social
graphs.
