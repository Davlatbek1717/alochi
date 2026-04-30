# Faza 4 — Multi-tenant Onboarding Design

**Goal:** Superadmin uchun bitta sahifada yangi markaz (tenant) + birinchi admin (filadmin) + ixtiyoriy birinchi filialni atomic tarzda yaratish flow'i. Public signup yo'q.

**Scope:** Mavjud `POST /tenants` endpoint'ini kengaytiruvchi atomic onboarding flow + frontend form + credentials modal. Email infra, signup sahifasi, email verification — qamrovdan tashqari.

---

## 1. Maqsad va biznes mantiqi

**Holat:** Hozir yangi markaz qo'shish uchun superadmin 3-4 ta alohida amal qiladi:
1. `POST /tenants` — markaz yaratish
2. `POST /branches` — filial yaratish
3. `POST /users` — admin user yaratish (filadmin roli)
4. Login va parolni qo'lda admin'ga yetkazib berish

Har qadam alohida xato beradi, atomic emas, tracking qiyin.

**Maqsad:** Bitta form, bitta klik, atomic transaction. Yaratilgandan keyin credentials modal'da ko'rsatiladi (qog'ozda yoki SMS orqali markazga yetkazib berish uchun).

**Cheklovlar (YAGNI):**
- Public signup **yo'q** — faqat superadmin onboarding qila oladi
- Email verification **yo'q** — superadmin tasdiqlangan deb hisoblanadi
- Email yuborish **yo'q** — credentials modal'da bir marta ko'rsatiladi
- Trial / billing tracking **yo'q** — barcha tenantlar `status: 'active'` bilan yaratiladi
- SSO / SAML **yo'q**

---

## 2. Backend dizayni

### 2.1 Yangi endpoint

**`POST /tenants/onboard`** — superadmin only.

**Request DTO** (`apps/api/src/tenants/dto/onboard-tenant.dto.ts`):
```ts
class OnboardTenantDto {
  @IsObject() @ValidateNested() @Type(() => TenantPart)
  tenant: TenantPart;

  @IsObject() @ValidateNested() @Type(() => AdminPart)
  admin: AdminPart;

  @IsOptional() @IsObject() @ValidateNested() @Type(() => BranchPart)
  branch?: BranchPart;
}

class TenantPart {
  @IsString() @MinLength(2) @MaxLength(100)
  name: string;

  @IsString() @Matches(/^[a-z0-9-]{3,50}$/, {
    message: 'Slug faqat a-z, 0-9, - belgilarni o\'z ichiga oladi (3-50 belgi)',
  })
  slug: string;
}

class AdminPart {
  @IsString() @MinLength(2) @MaxLength(100)
  name: string;

  @IsString() @MinLength(3) @MaxLength(50) @Matches(/^[a-zA-Z0-9_.-]+$/)
  login: string;

  @IsString() @MinLength(6) @MaxLength(100)
  password: string;

  @IsOptional() @IsString() @MaxLength(20)
  phone?: string;
}

class BranchPart {
  @IsString() @MinLength(2) @MaxLength(100)
  name: string;
}
```

### 2.2 Service mantig'i

**`TenantsService.onboardTenant(dto: OnboardTenantDto)`:**

```ts
async onboardTenant(dto: OnboardTenantDto) {
  // Pre-flight: slug uniqueness
  const existing = await this.prisma.tenant.findUnique({
    where: { slug: dto.tenant.slug },
  });
  if (existing) {
    throw new ConflictException("Bu slug band, boshqasini tanlang");
  }

  const passwordHash = await bcrypt.hash(dto.admin.password, 12);

  return this.prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: {
        name: dto.tenant.name,
        slug: dto.tenant.slug,
        status: 'active',
      },
    });

    let branch = null;
    if (dto.branch) {
      branch = await tx.branch.create({
        data: { tenantId: tenant.id, name: dto.branch.name },
      });
    }

    const admin = await tx.user.create({
      data: {
        tenantId: tenant.id,
        branchId: branch?.id,
        role: UserRole.filadmin,
        name: dto.admin.name,
        login: dto.admin.login,
        password: passwordHash,
        phone: dto.admin.phone,
        status: 'active',
      },
    });

    return {
      tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug },
      admin: { id: admin.id, name: admin.name, login: admin.login },
      branch: branch ? { id: branch.id, name: branch.name } : null,
    };
  });
}
```

**Atomic guarantees:**
- Slug duplicate → 409 Conflict, hech narsa yaratilmaydi (Prisma unique constraint qo'shimcha himoya beradi transaction ichida)
- Login duplicate per tenant → 409 Conflict (lekin yangi tenantda har doim unique, real keling — bu xato amalda yuz bermaydi)
- Validation xatolar → 400 Bad Request (`class-validator`)
- Boshqa har qanday xato → transaction rollback, 500 Internal Server Error

**Auth:** `JwtAuthGuard` + `RolesGuard` + `@Roles(UserRole.superadmin)`. Mavjud pattern (e.g., `tenants.controller.ts`).

### 2.3 Mavjud `POST /tenants` ni saqlash

`POST /tenants` endpoint'i hech qanday o'zgartirilmaydi (backwards compat). Yangi `POST /tenants/onboard` qo'shimcha sifatida.

---

## 3. Frontend dizayni

### 3.1 Sahifa joylashuvi

**`/superadmin/tenants/new`** — yangi route.

`apps/web/app/(dashboard)/superadmin/tenants/new/page.tsx` — sahifa entry.

`apps/web/app/(dashboard)/superadmin/tenants/new/_components/`:
- `OnboardForm.tsx` — 3 seksiyali form (client component)
- `CredentialsModal.tsx` — muvaffaqiyatdan keyin ko'rsatiladigan modal

### 3.2 Form layout

```
┌─────────────────────────────────────────────┐
│ Yangi Markaz Qo'shish                       │
├─────────────────────────────────────────────┤
│ Markaz ma'lumotlari                         │
│   Nomi*       [____________________________] │
│   Slug*       [____________] (auto-derived) │
│                URL: alochi.uz/[slug]/login  │
├─────────────────────────────────────────────┤
│ Birinchi admin (filadmin)                   │
│   Ism*        [____________________________] │
│   Login*      [____________________________] │
│   Parol*      [_____________] [Generate]    │
│   Telefon     [+998 __ ___ __ __]           │
├─────────────────────────────────────────────┤
│ Birinchi filial (ixtiyoriy)                 │
│   ☐ Filial ham yaratish                     │
│   Filial nomi [Markaziy filial]             │
├─────────────────────────────────────────────┤
│              [Bekor]  [Markaz Yaratish]     │
└─────────────────────────────────────────────┘
```

### 3.3 Slug auto-derive

Foydalanuvchi `Markaz nomi`ni yozadi. JS-da slug avtomatik:

```ts
function deriveSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')   // diakritikalarni olib tashlash
    .replace(/[^a-z0-9]+/g, '-')       // a-z, 0-9, qolgani '-'
    .replace(/^-+|-+$/g, '')           // boshi/oxiridagi '-' larni olib tashlash
    .slice(0, 50);
}
```

Foydalanuvchi slug input'ini qo'lda tahrirlasa, auto-derive to'xtaydi (state flag bilan).

### 3.4 Generate parol tugmasi

Crypto-secure random 12 belgi, ambiguous belgilar olib tashlangan:

```ts
function generatePassword(): string {
  const ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  // 'i', 'l', 'I', 'L', 'o', 'O', '0', '1' — chiqarib tashlangan
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}
```

`Math.random()` **ishlatilmaydi**.

### 3.5 Validatsiya

Client-side validatsiya darhol (input on-blur):

| Field | Qoida | Xato xabar |
|-------|-------|------------|
| Markaz nomi | min 2, max 100 | "Nomi 2-100 belgi" |
| Slug | regex `^[a-z0-9-]{3,50}$` | "Slug faqat a-z, 0-9, - (3-50 belgi)" |
| Admin ism | min 2, max 100 | "Ism 2-100 belgi" |
| Admin login | min 3, max 50, regex `^[a-zA-Z0-9_.-]+$` | "Login: harflar, raqamlar, _.-" |
| Parol | min 6 | "Parol kamida 6 belgi" |
| Filial nomi (agar yoqilgan) | min 2, max 100 | "Filial nomi 2-100 belgi" |

Server-side validation darhol qaytaradi xato — banner + tegishli input red border.

### 3.6 Submit flow

```
[Markaz Yaratish] tugmasi
    ↓
client validation
    ↓ (pass)
POST /tenants/onboard (with accessToken)
    ↓
loading state (button disabled, spinner)
    ↓
   ╲       ╱
   ✓        ✗
    ↓        ↓
Modal      Banner xato
    ↓
Hide form behind modal backdrop
```

### 3.7 Credentials modal

```
┌─────────────────────────────────────────────┐
│ ✓ Markaz muvaffaqiyatli yaratildi           │
├─────────────────────────────────────────────┤
│ ⚠️ Ushbu ma'lumotlarni admin'ga yetkazib    │
│ bering. Modal yopilgandan keyin parol       │
│ qaytadan ko'rsatilmaydi.                    │
│                                             │
│ Markaz URL  alochi.uz/toshkent-ielts        │
│ Login       akmal                  [📋]    │
│ Parol       K8m2pQ4xN9wF           [📋]    │
│                                             │
│ [🖨 Chop etish]    [Yopib ro'yxatga]       │
└─────────────────────────────────────────────┘
```

**Print:** CSS `@media print` blok yashiradi navigation, faqat credentials sahifa qoladi (A4 portretda).

**"Yopib ro'yxatga"** tugmasi: Credentials saqlanmaydi, modal yopiladi, foydalanuvchi `/superadmin` (yoki `/superadmin/branches`) ga redirect qilinadi.

### 3.8 Nav update

`apps/web/app/(dashboard)/superadmin/page.tsx` ga nav card:

```tsx
{
  href: '/superadmin/tenants/new',
  icon: Building2,
  label: "Yangi Markaz",
  color: 'text-emerald-400',
}
```

(Building2 ikonkasi — mavjud kutubxonadan, "Filiallar" uchun ham ishlatilgan; mos keladi.)

---

## 4. Xavfsizlik

1. **Authorization:** Faqat `UserRole.superadmin` `POST /tenants/onboard` ga kira oladi (`JwtAuthGuard` + `RolesGuard` + `@Roles`).
2. **Password storage:** bcrypt cost 12 (mavjud pattern, `users.service.ts:create()` bilan bir xil).
3. **Password transmission:** HTTPS (production'da). Modal'da plaintext faqat brauzerda — server log'lariga yozilmaydi (Nest'da default `HttpLogger` body'ni log qilmaydi).
4. **Generated parolda crypto API:** `crypto.getRandomValues()`, hech qachon `Math.random()`. Audit qilish oson.
5. **Slug regex:** Pre-emptive — DB'ga noto'g'ri format slug yetib bormaydi. SQL injection vektorlari minimallashadi.
6. **Atomic transaction:** Yarim yaratilgan tenant yo'q (orphaned admin, yo'qolgan branch). Prisma `$transaction` rollback'ga ishonadi.
7. **Login uniqueness:** `@@unique([tenantId, login])` constraint schema'da (mavjud). Yangi tenantda har doim unique.

---

## 5. Testing

### 5.1 Backend unit test

**Fayl:** `apps/api/test/tenants.spec.ts` (yangi)

Pattern: existing `apps/api/test/*.spec.ts` — direct constructor mock, no TestingModule. Mock'lar: `PrismaService`, `bcrypt`.

**Test holatlari:**

1. `creates tenant + admin + branch atomically when all fields valid`
2. `creates tenant + admin without branch when branch field omitted`
3. `throws ConflictException when slug already exists`
4. `does NOT call user.create when transaction rolls back due to branch.create failure` (atomic guarantee)

### 5.2 Frontend test

Yo'q. Pure UI form, manual testing yetarli.

### 5.3 Manual test checklist

1. Superadmin login qilib `/superadmin/tenants/new` ga o'tish — sahifa ochiladi
2. Form to'ldirish (markaz + admin), branch qutisi belgilanmagan, submit — muvaffaqiyat modal ochiladi
3. Modal'da `Login` va `Parol` tugma bilan clipboard'ga nusxalanadi (browser confirm yoki toast)
4. "Chop etish" tugma `window.print()` ni chaqiradi, print preview ochiladi
5. Modal yopilgandan keyin yangi tenant slug bilan login sahifasiga (`/login` + slug) o'tib admin login + parol bilan kirish — muvaffaqiyat
6. Slug allaqachon mavjud bilan urinib — banner: "Bu slug band"
7. Form'da parol < 6 belgi — banner: "Parol kamida 6 belgi"
8. Branch qutisi belgilangan, lekin filial nomi bo'sh — banner xato

---

## 6. Faza 4 dan tashqari (kelajak)

| Xususiyat | Sabab |
|-----------|-------|
| Tenant edit/disable UI | Onboarding'dan alohida task — keyingi PR |
| Tenant ro'yxati sahifasi | `/superadmin/tenants` — alohida task |
| Public signup sahifasi | Biznes modeli admin-driven, public signup talab qilinmaydi |
| Email verification | Public signup yo'q — kerak emas |
| SMTP/Resend integratsiya | Email yuborish yo'q |
| Trial period / billing tracking | Hozircha kerak emas |
| Bulk tenant import (CSV) | Volume past, manual yetarli |
| Tenant deletion | Dangerous, alohida design talab qiladi (data retention + GDPR-like) |

---

## 7. Acceptance Criteria

Implementation tayyor deb hisoblanadi qachon:

- [ ] `POST /tenants/onboard` ishlaydi va atomic — slug duplicate xato bo'lsa hech narsa yaratilmaydi
- [ ] `apps/api/test/tenants.spec.ts` 4 test pass
- [ ] `pnpm tsc --noEmit` 0 errors (api + web)
- [ ] `pnpm lint` 0 errors changed code'da
- [ ] `pnpm build` (api + web) muvaffaqiyatli
- [ ] `/superadmin/tenants/new` sahifa form bilan ochiladi va submit ishlaydi
- [ ] Credentials modal ko'rsatiladi va clipboard nusxalash ishlaydi
- [ ] Print preview to'g'ri formatlanadi
- [ ] Yangi tenant + admin bilan kirib bo'lib `/filadmin` dashboard'iga o'tish ishlaydi (manual test)
