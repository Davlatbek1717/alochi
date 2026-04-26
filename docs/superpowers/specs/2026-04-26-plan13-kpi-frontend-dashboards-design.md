# Plan 13: KPI Frontend + Dashboard Completion — Design Spec

**Date:** 2026-04-26
**Status:** Approved

---

## Goal

Build the KPI award pages for filadmin and manager roles, replace the filadmin placeholder with a real navigation hub, clone the student dashboard for the tester role, and wire real users into the delegations/new recipient selector.

---

## Context

All backend KPI endpoints (`POST /kpi/award`, `GET /kpi/my`, `GET /kpi/today`, `GET /kpi/monthly`) are live. `GET /users/by-branch/:branchId` is live and returns `{ id, name, role, status, phone, login }`. The following frontend gaps remain:

- `filadmin/page.tsx` — placeholder ("Plan 2 da to'liq qilinadi")
- `tester/page.tsx` — placeholder ("Plan 2 da to'liq qilinadi")
- No KPI award page exists for any role
- `delegations/new/page.tsx` — hardcoded `user_alisher` / `user_kamola` options

---

## Scope

**In scope:**
- `apps/web/app/(dashboard)/filadmin/kpi/page.tsx` — NEW: KPI award page
- `apps/web/app/(dashboard)/manager/kpi/page.tsx` — NEW: KPI award page
- `apps/web/app/(dashboard)/filadmin/page.tsx` — Replace placeholder with 4-card nav hub
- `apps/web/app/(dashboard)/tester/page.tsx` — Replace placeholder with student dashboard clone
- `apps/web/app/(dashboard)/delegations/new/page.tsx` — Real recipients from API

**Out of scope:**
- New KPI backend endpoints (all exist)
- filadmin/payments, filadmin/warnings, filadmin/attendance pages (already exist)
- KPI history page (view-only leaderboard — separate plan)
- Manager dashboard navigation cards (manager has its own layout already)

---

## Architecture

### File Map

| Action | Path |
|--------|------|
| Create | `apps/web/app/(dashboard)/filadmin/kpi/page.tsx` |
| Create | `apps/web/app/(dashboard)/manager/kpi/page.tsx` |
| Modify | `apps/web/app/(dashboard)/filadmin/page.tsx` |
| Modify | `apps/web/app/(dashboard)/tester/page.tsx` |
| Modify | `apps/web/app/(dashboard)/delegations/new/page.tsx` |

---

## Shared Type

Used in both KPI pages and delegations:

```typescript
type BranchUser = {
  id: string;
  name: string;
  role: string;
  status: string;
  phone: string;
  login: string;
};
```

---

## Task 1 — Filadmin KPI Award Page

**File:** `apps/web/app/(dashboard)/filadmin/kpi/page.tsx`

### Layout

Three stacked sections on a `max-w-lg mx-auto` container:

1. **Page header** — back link `← Filadmin` + title "KPI Mukofot"
2. **Award form card** — white rounded-xl with shadow
3. **Recent awards strip** — last 5 awards given (read-only)

### Award Form Card

```tsx
<div className="bg-white rounded-2xl shadow-sm p-6 space-y-5">
  {/* 1. User Selector */}
  {/* 2. Score Selector */}
  {/* 3. Reason Textarea */}
  {/* 4. Submit button */}
  {/* 5. Success / Error inline banner */}
</div>
```

#### 1. User Selector

Fetch `GET /users/by-branch/:branchId` on mount. Filter out `role === 'student'`. While loading show a 3-row skeleton. Render as a scrollable list of selectable user cards (not a `<select>`):

```tsx
<div className="border border-gray-200 rounded-xl overflow-hidden divide-y max-h-52 overflow-y-auto">
  {staffUsers.map(u => (
    <button
      key={u.id}
      onClick={() => setSelectedUserId(u.id)}
      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors
        ${selectedUserId === u.id
          ? 'bg-indigo-50 border-l-4 border-indigo-500'
          : 'hover:bg-gray-50 border-l-4 border-transparent'}`}
    >
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{u.name}</p>
        <p className="text-xs text-gray-400 capitalize">{u.role}</p>
      </div>
      {selectedUserId === u.id && (
        <span className="text-indigo-500 text-lg">✓</span>
      )}
    </button>
  ))}
</div>
```

Label: `"Xodimni tanlang"` above. If loading error: `"Xodimlar yuklanmadi"` inline in red.

#### 2. Score Selector

Visual grid of preset buttons plus a manual input for flexibility:

```tsx
const PRESETS = [5, 10, 15, 20, 25, 30, 50];

<div className="space-y-2">
  <label className="block text-sm font-medium text-gray-700">Ball</label>
  <div className="flex flex-wrap gap-2">
    {PRESETS.map(p => (
      <button
        key={p}
        onClick={() => setScore(p)}
        className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors
          ${score === p
            ? 'bg-indigo-600 text-white border-indigo-600'
            : 'border-gray-300 text-gray-700 hover:border-indigo-400'}`}
      >
        {p}
      </button>
    ))}
  </div>
  <div className="flex items-center gap-2 mt-1">
    <input
      type="number"
      min={1}
      max={50}
      value={score}
      onChange={e => setScore(Math.min(50, Math.max(1, Number(e.target.value))))}
      className="w-20 border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-center focus:ring-2 focus:ring-indigo-400 focus:outline-none"
    />
    <span className="text-sm text-gray-400">/ 50 maksimal</span>
  </div>
</div>
```

#### 3. Reason Textarea

```tsx
<div>
  <label className="block text-sm font-medium text-gray-700 mb-1">Sabab</label>
  <textarea
    rows={3}
    maxLength={200}
    value={reason}
    onChange={e => setReason(e.target.value)}
    placeholder="Nima uchun mukofot berilmoqda?"
    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-indigo-400 focus:outline-none"
  />
  <p className="text-xs text-gray-400 text-right mt-1">{reason.length}/200</p>
</div>
```

#### 4. Submit Button

Disabled when: `!selectedUserId || !reason.trim() || submitting`.

```tsx
<button
  type="button"
  onClick={handleAward}
  disabled={!selectedUserId || !reason.trim() || submitting}
  className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold
    disabled:opacity-50 disabled:cursor-not-allowed hover:bg-indigo-700 transition-colors"
>
  {submitting ? 'Yuborilmoqda...' : `${score} ball berish`}
</button>
```

#### 5. Success / Error Banner

Inline, appears below the button. Success auto-hides after 3 s and resets form (clears `selectedUserId` and `reason`, keeps `score`).

```tsx
{success && (
  <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm">
    <span>✓</span>
    <span>Ball muvaffaqiyatli berildi!</span>
  </div>
)}
{awardError && (
  <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm">
    {awardError}
  </div>
)}
```

### Recent Awards Strip

Fetch `GET /kpi/my` on mount (shows awards received BY the logged-in user, i.e. the awards the filadmin themselves was given — this is not what we want for "awards given"). 

**Note:** The backend `/kpi/my` returns history for the requester, not a history of awards they gave. For now, display `/kpi/today` as a total-points-given-today badge, and show `/kpi/my` as the filadmin's own received KPI history. A separate "given" log is out of scope.

**Today's total awarded** (from `GET /kpi/today`):

```tsx
<div className="bg-white rounded-2xl shadow-sm p-5">
  <p className="text-sm font-medium text-gray-500 mb-1">Bugun berilgan jami</p>
  {loadingStats ? (
    <div className="h-8 w-24 bg-gray-100 rounded animate-pulse" />
  ) : (
    <p className="text-3xl font-bold text-indigo-600">{todayTotal} ball</p>
  )}
</div>
```

### State Shape

```typescript
const [staffUsers, setStaffUsers] = useState<BranchUser[]>([]);
const [loadingUsers, setLoadingUsers] = useState(true);
const [usersError, setUsersError] = useState<string | null>(null);

const [selectedUserId, setSelectedUserId] = useState('');
const [score, setScore] = useState(10);
const [reason, setReason] = useState('');
const [submitting, setSubmitting] = useState(false);
const [success, setSuccess] = useState(false);
const [awardError, setAwardError] = useState<string | null>(null);

const [todayTotal, setTodayTotal] = useState(0);
const [loadingStats, setLoadingStats] = useState(true);
```

### Data Fetching

On mount, two independent fetches in parallel:

```typescript
useEffect(() => {
  const token = localStorage.getItem('accessToken') ?? '';
  const user = JSON.parse(localStorage.getItem('user') ?? '{}');
  const branchId: string = user.branchId ?? '';

  async function load() {
    const [usersRes, todayRes] = await Promise.allSettled([
      apiRequest<BranchUser[]>(`/users/by-branch/${branchId}`, {}, token),
      apiRequest<{ total: number }>('/kpi/today', {}, token),
    ]);

    if (usersRes.status === 'fulfilled') {
      setStaffUsers(usersRes.value.data.filter(u => u.role !== 'student'));
    } else {
      setUsersError('Xodimlar yuklanmadi');
    }
    setLoadingUsers(false);

    if (todayRes.status === 'fulfilled') {
      setTodayTotal(todayRes.value.data.total ?? 0);
    }
    setLoadingStats(false);
  }

  load();
}, []);
```

`handleAward`:

```typescript
async function handleAward() {
  setSubmitting(true);
  setAwardError(null);
  const token = localStorage.getItem('accessToken') ?? '';
  try {
    await apiRequest('/kpi/award', {
      method: 'POST',
      body: JSON.stringify({ userId: selectedUserId, score, reason }),
    }, token);
    setSuccess(true);
    setSelectedUserId('');
    setReason('');
    setTodayTotal(prev => prev + score);
    setTimeout(() => setSuccess(false), 3000);
  } catch (err) {
    setAwardError(err instanceof Error ? err.message : 'Xatolik yuz berdi');
  } finally {
    setSubmitting(false);
  }
}
```

---

## Task 2 — Manager KPI Award Page

**File:** `apps/web/app/(dashboard)/manager/kpi/page.tsx`

Identical component to `filadmin/kpi/page.tsx`. Same state shape, same layout, same logic. Back link goes to `/manager` instead of `/filadmin`.

Both pages are standalone files (no shared component) — the DRY cost is low compared to the coupling risk of a shared multi-role component.

---

## Task 3 — Filadmin Dashboard (Navigation Hub)

**File:** `apps/web/app/(dashboard)/filadmin/page.tsx`

Replace the placeholder with a gradient header + 4 quick-link cards.

### Structure

```tsx
<div className="space-y-6 max-w-2xl mx-auto">
  {/* Header */}
  <div className="bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl p-6 text-white">
    <p className="text-white/70 text-sm font-medium">Filial boshqaruvi</p>
    <h1 className="text-2xl font-bold mt-1">Filadmin Paneli</h1>
  </div>

  {/* Grid of 4 cards */}
  <div className="grid grid-cols-2 gap-4">
    {NAV_CARDS.map(card => (
      <Link key={card.href} href={card.href}>
        <div className={`${card.bg} rounded-2xl p-5 h-full flex flex-col gap-3
          hover:scale-[1.02] transition-transform cursor-pointer`}>
          <span className="text-3xl">{card.icon}</span>
          <div>
            <p className="font-semibold text-gray-800">{card.title}</p>
            <p className="text-xs text-gray-500 mt-0.5">{card.description}</p>
          </div>
        </div>
      </Link>
    ))}
  </div>
</div>
```

### Card Definitions

```typescript
const NAV_CARDS = [
  {
    href: '/filadmin/attendance',
    icon: '📋',
    title: 'Davomat',
    description: 'Kunlik qatnashuvni belgilash',
    bg: 'bg-blue-50',
  },
  {
    href: '/filadmin/payments',
    icon: '💳',
    title: "To'lovlar",
    description: "O'quvchi to'lovlarini boshqarish",
    bg: 'bg-green-50',
  },
  {
    href: '/filadmin/warnings',
    icon: '⚠️',
    title: 'Ogohlantirishlar',
    description: "Intizom muammolarini qayd etish",
    bg: 'bg-yellow-50',
  },
  {
    href: '/filadmin/kpi',
    icon: '⭐',
    title: 'KPI Mukofot',
    description: 'Xodimlarga ball berish',
    bg: 'bg-purple-50',
  },
];
```

This is a static page — no API calls, no loading state needed.

---

## Task 4 — Tester Dashboard (Student Clone)

**File:** `apps/web/app/(dashboard)/tester/page.tsx`

The tester role needs a full-featured gamification dashboard to validate the student experience. Replace the placeholder with a pixel-for-pixel clone of `student/page.tsx`.

### What to copy

All types, state, `useEffect` data fetching, and JSX from `student/page.tsx` are copied verbatim. No changes to logic. One difference: the bottom CTA link goes to `/tester/lessons/current` instead of `/student/lessons/current`.

```tsx
// Only diff from student/page.tsx:
<Link href="/tester/lessons/current" ...>
  ▶️ Bugungi Darsni Boshlash
</Link>
```

All imports (`XpBar`, `StreakBadge`, `DailyQuests`, `SocialFeed`, `VirtualCity`, `apiRequest`) are identical — the tester dashboard lives under `(dashboard)` and shares the same component library.

---

## Task 5 — Delegations New: Real Recipients

**File:** `apps/web/app/(dashboard)/delegations/new/page.tsx`

Replace the two hardcoded `<option>` elements with a real user list from `GET /users/by-branch/:branchId`. Filter out `role === 'student'` (you cannot delegate to a student).

### State additions

```typescript
const [staffUsers, setStaffUsers] = useState<BranchUser[]>([]);
const [loadingUsers, setLoadingUsers] = useState(true);
```

### Fetch in useEffect (inside NewDelegationForm)

```typescript
useEffect(() => {
  const token = localStorage.getItem('accessToken') ?? '';
  const user = JSON.parse(localStorage.getItem('user') ?? '{}');
  const branchId: string = user.branchId ?? '';

  apiRequest<BranchUser[]>(`/users/by-branch/${branchId}`, {}, token)
    .then(res => setStaffUsers(res.data.filter(u => u.role !== 'student')))
    .catch(() => {})
    .finally(() => setLoadingUsers(false));
}, []);
```

### Replace `<select>` options

```tsx
<select
  value={selectedRecipient}
  onChange={(e) => setSelectedRecipient(e.target.value)}
  disabled={loadingUsers}
  className="w-full border rounded-lg px-3 py-2 disabled:bg-gray-50"
  required
>
  <option value="">
    {loadingUsers ? 'Yuklanmoqda...' : 'Tanlang...'}
  </option>
  {staffUsers.map(u => (
    <option key={u.id} value={u.id}>
      {u.name} ({u.role})
    </option>
  ))}
</select>
```

All other form logic (dates, reason, submit, error) remains unchanged.

---

## Error Handling

| Scenario | Behavior |
|----------|----------|
| `GET /users/by-branch/:branchId` fails (KPI pages) | Inline error below selector: "Xodimlar yuklanmadi" |
| `GET /users/by-branch/:branchId` fails (delegations) | `<select>` stays disabled, no option; form cannot be submitted |
| `POST /kpi/award` fails | Inline error banner below submit button; form stays filled |
| `GET /kpi/today` fails | `todayTotal` stays 0, no error shown |
| `branchId` missing from localStorage | Empty `staffUsers` list (API call uses empty string, returns 400 which `.catch(() => {})` absorbs) |

---

## Testing

- `npx tsc --noEmit` in `apps/web` — 0 errors
- Manual: Filadmin → dashboard shows 4 cards; each navigates correctly
- Manual: Filadmin → KPI → staff list loads; select user → set score → enter reason → submit → success banner → form resets
- Manual: Manager → KPI — identical behavior
- Manual: Tester → dashboard shows XP/streak/quests/city (same as student)
- Manual: Delegations → New → recipient dropdown shows real names from API

---

## Out of Scope — Explicit Deferrals

| Item | Reason |
|------|--------|
| "Awards given" history log | Backend `/kpi/my` only shows received, not given — separate endpoint needed |
| KPI leaderboard page | Separate plan — viewing rankings across staff |
| `/tester/lessons/current` page | Exists or is a stub — tester CTA links there but this plan does not build it |
| Manager dashboard navigation cards | Manager layout already works — not broken |
