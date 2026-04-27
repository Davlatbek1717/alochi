# Mentor Frontend Design Spec

## Overview

Mentor panelidagi stub sahifalarni to'liq ishlaydigan frontend'ga aylantirish. Barcha sahifalar mobile-first, Tailwind CSS, `lucide-react` ikonalari.

---

## Scope

| Fayl | Holat | Ish |
|------|-------|-----|
| `apps/web/app/(dashboard)/mentor/page.tsx` | Stub | To'liq qayta yozish |
| `apps/api/src/users/users.controller.ts` | Mavjud | `GET /users/group/:groupId` endpoint qo'shish |
| `apps/api/src/users/users.service.ts` | Mavjud | `findByGroup(groupId, tenantId)` metod qo'shish |
| `apps/web/app/(dashboard)/mentor/students/[id]/page.tsx` | Yo'q | Yangi sahifa yaratish |

**Eslatma**: `mentor/group`, `mentor/attendance`, `mentor/tasks` sahifalari allaqachon tayyor — tegilmaydi.

---

## Dependencies

```bash
npm install lucide-react --workspace=apps/web
```

---

## 1. Backend: `/users/group/:groupId`

### Endpoint
```
GET /users/group/:groupId
Roles: mentor, manager, filadmin, superadmin
```

### Response
```ts
{ id: string; name: string; role: string }[]
```

### Implementatsiya
`users.service.ts`-ga `findByGroup(groupId: string, tenantId: string)` qo'shiladi:
```ts
async findByGroup(groupId: string, tenantId: string) {
  return this.prisma.user.findMany({
    where: { groupId, tenantId },
    select: { id: true, name: true, role: true },
  });
}
```

`users.controller.ts`-ga route qo'shiladi (`:id` dan oldin):
```ts
@Get('group/:groupId')
@Roles(UserRole.mentor, UserRole.manager, UserRole.filadmin, UserRole.superadmin)
findByGroup(@Param('groupId') groupId: string, @Request() req: any) {
  return this.users.findByGroup(groupId, req.user.tenantId);
}
```

---

## 2. Mentor Dashboard (`/mentor`)

### Visual dizayn
- **Fon**: `#f7f4ef` (warm cream)
- **Kartochkalar**: `#162032` (dark navy) — stat uchun; `white` — nav uchun
- **Aksent**: `#f59e0b` (amber) — KPI
- **Shrift**: `font-sans` (Tailwind default) + `font-mono` raqamlar uchun
- **Ikonalar**: `lucide-react`

### Sahifa tuzilishi (yuqoridan pastga)

#### A. Header (navy background)
- Salom matni + mentor ismi (JWT `localStorage.user.name`)
- Bugungi sana
- Notification bell ikona (faqat ko'rinish, hozircha funksiya yo'q)
- **KPI Hero Card** (header ichida, pastga chiqib turadi):
  - Bugungi KPI balli (`GET /kpi/daily`)
  - Progress ring (SVG — bugungi / 50 ball maqsad)
  - Oylik jami (`GET /kpi/monthly?year=&month=`)

#### B. Stat kartochkalar (2×2 grid + 1 wide)
| Kartochka | API | Rang |
|-----------|-----|------|
| Guruh o'quvchilari | `GET /users/group/:groupId` → `.length` | teal |
| Kutilayotgan vazifalar | `GET /tasks/my` → `status !== 'done' && status !== 'confirmed'` filtri | rose |
| Oylik KPI | `/kpi/monthly` | amber |
| Bugungi davomat (wide) | Hozircha `localStorage` ga qaramasdan — faqat "Belgilanmagan / Belgilangan" ko'rsatadi | teal |

Davomat kartochkasi:
- Agar `GET /attendance/students/bulk` bugun chaqirilmagan bo'lsa → "⚠️ Belgilanmagan" + "Belgilash" tugmasi (→ `/mentor/attendance`)
- Agar belgilangan bo'lsa → "✅ Belgilandi" + "Ko'rish" tugmasi

**Davomat holatini aniqlash**: localStorage'da `attendance_marked_${today}` kalitiga qaraydi. Guruh sahifasi saqlanganda bu kalit o'rnatiladi (bu sahifani o'zgartirmasdan — faqat dashboard o'zi tekshiradi).

#### C. Tezkor navigatsiya (2×2 grid)
| Kartochka | Href | Ikona |
|-----------|------|-------|
| Guruh | `/mentor/group` | `Users` |
| Davomat | `/mentor/attendance` | `BarChart2` |
| Vazifalar | `/mentor/tasks` | `ClipboardList` |
| O'quvchilar | `/mentor/students` | `GraduationCap` |

### API chaqiruvlar
```ts
const [kpiDaily, kpiMonthly, students, tasks] = await Promise.all([
  apiRequest('/kpi/daily', {}, token),
  apiRequest(`/kpi/monthly?year=${year}&month=${month}`, {}, token),
  apiRequest(`/users/group/${groupId}`, {}, token),
  apiRequest('/tasks/my', {}, token),
]);
```

JWT'dan: `groupId`, `name` — `getGroupIdFromToken()` pattern (mavjud).

---

## 3. O'quvchi xato tahlili sahifasi (`/mentor/students/[id]`)

### Sahifa tuzilishi

#### A. Header (navy)
- Orqaga qaytish tugmasi → `/mentor/group`
- O'quvchi ismi + initials avatar
- Meta chiplar: holat (qizil/sariq/yashil), dars soni

#### B. AI Tahlil kartochkasi
- `GET /ai/analyze-errors?studentId={id}`
- Response: `{ weakAreas: string[]; recommendation: string }`
- Loading skeleton ko'rsatiladi
- Hato bo'lsa: "Tahlil uchun ma'lumot yetarli emas" xabari

#### C. Kuchsiz mavzular ro'yxati
- `weakAreas` massividan har bir mavzu uchun qator
- Progress bar: birinchi mavzu → 80%, ikkinchi → 60%, ... (nisbiy holda)
- Rang: 1-2-chi → rose (high), 3-chi → amber (mid), qolganlari → green (low)

#### D. Telegram xabar tugmasi
- `POST /notifications/telegram` (mavjud endpoint)
- Ota-onaga ogohlantirish: "O'quvchingiz [ism] tahlilida kuchsiz mavzular aniqlandi"
- Tugma bosilganda loading state, keyin "Yuborildi ✓"

### `students` sahifasi (ro'yxat) yo'q — faqat `[id]` detail sahifasi
Guruh sahifasidan (`/mentor/group`) har bir o'quvchi kartochkasiga "Xato tahlili →" havolasi qo'shiladi. Bu `group/page.tsx`'ga minimal o'zgartirish.

---

## 4. Guruh sahifasiga qo'shimcha

`mentor/group/page.tsx` — har bir student kartochkasiga link qo'shiladi:
```tsx
<Link href={`/mentor/students/${student.id}`} className="text-xs text-indigo-600 font-medium">
  Xato tahlili →
</Link>
```

---

## Dizayn tizimi (barcha sahifalar uchun)

```ts
// Ranglar
const colors = {
  bg: '#f7f4ef',          // warm cream fon
  navyCard: '#162032',     // dark card
  amber: '#f59e0b',        // KPI aksent
  teal: '#0d9488',         // guruh/davomat
  rose: '#e11d48',         // vazifalar/xato
  slate: '#64748b',        // secondary text
}

// Ikonalar (lucide-react)
// Bell, Users, BarChart2, ClipboardList, GraduationCap,
// Home, ChevronRight, ArrowLeft, Star, CheckCircle,
// AlertCircle, Sparkles, Send
```

---

## Cheklovlar

- `groupId` JWT'da bo'lmasa → "Guruh biriktirilmagan" xabar ko'rsatiladi (dashboard ham shu)
- `analyzeErrors` 5+ xato bo'lmasa backend bo'sh `weakAreas: []` qaytaradi → UI: "Hali yetarli ma'lumot yo'q"
- Barcha fetch'lar `Promise.all` bilan parallel, loading skeleton ko'rsatiladi

---

## Test qilish

1. Mentor hisobi bilan login
2. Dashboard — KPI, guruh soni, vazifalar ko'rinadi
3. "O'quvchilar" → guruh sahifasida "Xato tahlili →" havolasi bor
4. O'quvchi detail — AI tahlil natijasi ko'rinadi
5. `/users/group/:groupId` endpoint — to'g'ri response qaytaradi
