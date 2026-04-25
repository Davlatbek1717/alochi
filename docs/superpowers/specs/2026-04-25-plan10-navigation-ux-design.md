# Plan 10: Navigation & UX — Design Spec

**Date:** 2026-04-25  
**Status:** Approved  

---

## Goal

Add a role-based bottom tab navigation to all dashboard pages, wire iOS safe-area support throughout, and connect the highest-priority mock pages to real API endpoints.

---

## Scope

**In scope:**
- `BottomNav` component — role-based bottom tab bar
- `apps/web/app/(dashboard)/layout.tsx` refactor — add BottomNav, remove empty `<aside>`
- `apps/web/app/layout.tsx` — iOS viewport meta tag
- `student/page.tsx` — replace `STATIC_DATA.streak/hasShield/lessonProgress` with real API
- `mentor/group/page.tsx` — replace `MOCK_STUDENTS` with `GET /users/group/:groupId`
- `manager/page.tsx` — connect XP/streak widgets; skip `red-students` (backend not built)

**Out of scope (deferred — backend not yet built):**
- `statuses` (english/personal/critical) — needs Student Status module (Plan 3)
- `GET /status/red-students` — needs Student Status module
- Delegations, payments, warnings API connections — separate phase
- Face ID, Telegram, Attendance pages — separate phase

---

## Architecture

### File Map

| Action | Path |
|--------|------|
| Create | `apps/web/app/(dashboard)/_components/BottomNav.tsx` |
| Modify | `apps/web/app/(dashboard)/layout.tsx` |
| Modify | `apps/web/app/layout.tsx` |
| Modify | `apps/web/app/(dashboard)/student/page.tsx` |
| Modify | `apps/web/app/(dashboard)/mentor/group/page.tsx` |
| Modify | `apps/web/app/(dashboard)/manager/page.tsx` |

---

## BottomNav Component

### Role → Tab Config

```typescript
const NAV_TABS: Record<string, { href: string; icon: string; label: string }[]> = {
  student: [
    { href: '/student',         icon: '🏠', label: 'Bosh'      },
    { href: '/student/lessons', icon: '📚', label: 'Darslar'   },
    { href: '/student/friends', icon: '👥', label: "Do'stlar"  },
    { href: '/student/duel',    icon: '⚔️', label: 'Duel'      },
    { href: '/student/profile', icon: '👤', label: 'Profil'    },
  ],
  mentor: [
    { href: '/mentor',            icon: '🏠', label: 'Bosh'    },
    { href: '/mentor/group',      icon: '👨‍🎓', label: 'Guruh'  },
    { href: '/mentor/attendance', icon: '📊', label: 'Davomat' },
  ],
  tester: [
    { href: '/mentor',            icon: '🏠', label: 'Bosh'    },
    { href: '/mentor/group',      icon: '👨‍🎓', label: 'Guruh'  },
    { href: '/mentor/attendance', icon: '📊', label: 'Davomat' },
  ],
  manager: [
    { href: '/manager',              icon: '🏠', label: 'Bosh'        },
    { href: '/manager/students',     icon: '👥', label: "O'quvchilar" },
    { href: '/manager/delegations',  icon: '📋', label: 'Delegatsiya' },
  ],
  filadmin: [
    { href: '/filadmin',             icon: '🏠', label: 'Bosh'            },
    { href: '/filadmin/attendance',  icon: '✅', label: 'Davomat'         },
    { href: '/filadmin/payments',    icon: '💰', label: "To'lovlar"       },
    { href: '/filadmin/warnings',    icon: '⚠️', label: 'Ogohlantirish'  },
  ],
  superadmin: [
    { href: '/superadmin',        icon: '🏠', label: 'Bosh'           },
    { href: '/superadmin/branches', icon: '🏢', label: 'Filiallar'    },
    { href: '/superadmin/users',  icon: '👤', label: 'Foydalanuvchilar' },
  ],
};
```

### Role Detection

```typescript
function getRoleFromToken(): string {
  try {
    const token = localStorage.getItem('accessToken') ?? '';
    const payload = JSON.parse(atob(token.split('.')[1]));
    return (payload.role ?? '') as string;
  } catch {
    return '';
  }
}
```

- Token yo'q yoki decode muvaffaqiyatsiz → empty string → tab render bo'lmaydi
- `usePathname()` + `tab.href` bilan `startsWith` → aktiv tab detection (nested routes uchun)

### Active State

- Aktiv tab: `text-indigo-600` + icon ustida thin indicator dot yoki underline
- Nofaol: `text-gray-400`
- Touch target: min `44×44px` per Apple HIG

### Logout

Har bir BottomNav da oxirgi element sifatida yashirin emas — alohida profil sahifasi yo'q bo'lganda logout `⋯` (more) ikonkasi yoki profil tab sifatida:
- `localStorage.clear()` → `router.push('/login')`
- Faqat student rolida `👤` tab profil/logout uchun

---

## iOS Safe Area

### Root Layout (`apps/web/app/layout.tsx`)

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="default" />
```

### BottomNav padding

```tsx
// Fixed bottom bar with iOS safe area
className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 
           pb-[env(safe-area-inset-bottom)] px-2 pt-2"
```

### Dashboard main content

```tsx
// layout.tsx main — room for nav + iOS home indicator
className="flex-1 overflow-y-auto pb-24"
```

### Global CSS (`apps/web/app/globals.css`)

```css
* {
  -webkit-tap-highlight-color: transparent;
}

input, textarea, select {
  font-size: 16px; /* prevents iOS auto-zoom */
}
```

---

## Real API Connections

### 1. `student/page.tsx` — Remove STATIC_DATA

**Current mock:**
```typescript
const STATIC_DATA = {
  streak: 12,
  hasShield: true,
  cityName: 'Shaharcha',    // already from city API
  lessonProgress: 47,
  statuses: { ... },        // SKIP — backend not built
};
```

**Replace with:**
- `GET /gamification/streak` → `{ streak: number, hasShield: boolean }`
- `GET /progress/my` → `length` → `lessonProgress`
- `statuses` stays mock with `⚪` placeholder until Plan 3 backend is built

**Fetch pattern:** Add to existing `Promise.all` in `fetchData()`.

### 2. `mentor/group/page.tsx` — Replace MOCK_STUDENTS

- `groupId`: read from JWT payload (`payload.groupId`) or call `GET /users/me`
- Fetch: `GET /users/group/:groupId` → student list
- Show loading skeleton, error state with retry

### 3. `manager/page.tsx` — Partial connection

- XP/streak widgets: connect same as student dashboard
- `redStudents` list stays mock — `GET /status/red-students` endpoint not built
- Visual indicator: replace hardcoded red count with `?` placeholder

---

## Error Handling

- All `apiRequest` calls: `try/catch` → show non-blocking error (toast or inline text)
- Token decode failure: `getRoleFromToken()` returns `''` → BottomNav renders nothing → no crash
- 401 from any API: redirect to `/login` (existing `apiRequest` behaviour)

---

## Testing

- TypeScript: `npx tsc --noEmit` in `apps/web` — 0 errors
- Manual: login as each role → verify correct tabs appear
- iOS: test `env(safe-area-inset-bottom)` in Safari simulator or real device
- Each real API connection: verify data renders, loading state, error state

---

## Out of Scope — Explicit Deferrals

| Item | Reason |
|------|--------|
| `statuses` real API | `GET /status/my` — Student Status module not built (Plan 3) |
| `GET /status/red-students` | Same |
| `manager/students` page | N-override page doesn't exist yet |
| Delegations/payments/warnings API | Complex flows — separate plan |
| Superadmin branches/users pages | Exist but not priority |
| Push notifications | Native app feature — not in scope |
