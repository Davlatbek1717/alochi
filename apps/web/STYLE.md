# A'lochi Frontend Style Guide

This document records the design-system decisions that *override* generic
component-spec defaults. Apply these in any new screen.

## Palette

Project palette is **amber + navy + teal** (NOT spec indigo).

- Amber `#f59e0b`  — primary accent, KPI / awards / success-positive
- Navy  `#0f172a`  — dark surfaces (header bands, primary buttons)
- Teal  `#0d9488`  — secondary accent, attendance / mentor / "good"
- Rose  `#e11d48`  — destructive / red status / errors
- Cream `#f7f4ef`  — body background

Tailwind aliases land in `apps/web/app/globals.css`. Most pages use raw hex
codes inline because the palette pre-dates Tailwind theme tokens.

## Border radius

Cards & primary surfaces use `rounded-[18px]`.
Spec called for `rounded-xl` (12px); we standardised on 18px for a softer feel.
Keep inputs and small chips at `rounded-xl` (12px) for visual contrast.

## Icons

All UI icons are `lucide-react` SVG components. The spec showed emoji glyphs
in some flows — those are documentation shorthand, not the implementation
target. Replace any emoji you find in code with the matching Lucide icon.

Example mappings:

| Spec emoji | Lucide component |
|------------|------------------|
| ⚔️         | `<Swords />`     |
| 🏆         | `<Trophy />`     |
| 💳         | `<CreditCard />` |
| 📚         | `<BookOpen />`   |
| ⚠️         | `<AlertTriangle />` |

## Filadmin dashboard — 7-card grid

The filadmin landing page extends the 4-card spec to **7 cards**:

1. Davomat (BarChart2)
2. To'lovlar (CreditCard)
3. Ogohlantirishlar (AlertTriangle)
4. KPI Mukofot (Star)        ← extension
5. Planshetlar (Tablet)      ← extension
6. Turnirlar (Trophy)        ← extension
7. Vazifalar (ClipboardList)

Cards apply `hover:scale-[1.02]` and a per-card hover-tint class
(`hover:border-…-300 hover:bg-…-50`).

## Misc conventions

- Container width on KPI/award form pages: `max-w-lg mx-auto`.
- BottomNav (mobile): max 5 tabs, lucide icons at size 20.
- Loading lists: 3-row skeleton (`[1, 2, 3].map`) for primary lists.
- Section headers always render the count, even when zero, with a card-style
  empty state ("Hech kim yo'q") underneath.
