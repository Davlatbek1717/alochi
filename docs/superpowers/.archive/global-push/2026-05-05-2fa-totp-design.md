# Phase 13b — 2FA TOTP Dizayni

**Sana:** 2026-05-05
**Muallif:** Davlatbek + Claude
**Holat:** Tasdiqlangan ✅

---

## Maqsad

Superadmin va filadmin rollari uchun ixtiyoriy TOTP-asosida ikki bosqichli autentifikatsiya (2FA). Telefon sinsa — 8 ta backup kod orqali kirish. Admin ham boshqasi uchun 2FA'ni reset qila oladi.

---

## Texnik Stack

- `otplib` — TOTP token generation/verification (RFC 6238)
- `qrcode` — QR kod SVG/PNG generatsiyasi
- NestJS JWT (mavjud), Prisma (mavjud)
- React `useTranslations` (mavjud i18n)

---

## 1. Ma'lumotlar Bazasi

`User` modeliga 3 ta maydon:

```prisma
totpSecret      String?  @map("totp_secret")        // AES-256 bilan shifrlangan TOTP secret
totpEnabled     Boolean  @default(false) @map("totp_enabled")
totpBackupCodes String?  @map("totp_backup_codes")  // JSON: ["hash1","hash2",...] — 8 ta
```

Migration: `0048_user_2fa`

```sql
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "totp_secret"       TEXT,
  ADD COLUMN IF NOT EXISTS "totp_enabled"      BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "totp_backup_codes" TEXT;
```

**Shifrlash:** `totpSecret` DB'ga AES-256-GCM bilan shifrlangan holda saqlanadi (xuddi `faceVector` kabi, `FACE_VECTOR_KEY` o'rniga `TOTP_ENCRYPTION_KEY` ishlatiladi).

---

## 2. Login Oqimi O'zgarishi

### Hozirgi oqim
```
POST /auth/login → credentials → JWT
```

### Yangi oqim
```
POST /auth/login
  totpEnabled=false → JWT (o'zgarmaydi, to'liq mos keladi)
  totpEnabled=true  → { status: "2fa_required", tempToken: "eyJ..." }

POST /auth/verify-2fa  { tempToken, code }
  code = TOTP yoki backup kod
  To'g'ri   → haqiqiy JWT (xuddi oddiy login kabi)
  Noto'g'ri → 401
```

### `tempToken` xususiyatlari
- Qisqa muddatli JWT: TTL = 5 daqiqa
- Payload: `{ sub: userId, purpose: "2fa" }`
- `JWT_2FA_SECRET` env bilan imzolangan (alohida secret)
- Faqat `/auth/verify-2fa` endpoint'ida qabul qilinadi

---

## 3. 2FA Setup Endpoint'lari

Barcha endpoint'lar `JwtAuthGuard` + `Roles(superadmin, filadmin)` bilan himoyalangan.

### `GET /auth/2fa/setup`
- Yangi TOTP secret generatsiya qiladi
- DB'ga **saqlamaydi** (foydalanuvchi hali tasdiqlamagan)
- Sessiyada (yoki short-lived token'da) saqlaydi
- Qaytaradi: `{ qrCodeDataUrl: "data:image/png;base64,...", secret: "ABCD1234" }`
- QR kod matni: `otpauth://totp/Adouptivo:${login}?secret=${secret}&issuer=Adouptivo`

### `POST /auth/2fa/enable  { code, secret }`
- `otplib.authenticator.verify({ token: code, secret })` bilan tekshiradi
- To'g'ri bo'lsa:
  - `totpSecret` ni shifrlangan holda DB'ga saqlaydi
  - `totpEnabled = true`
  - 8 ta tasodifiy backup kod generatsiya qiladi, bcrypt bilan hash qilib saqlaydi
  - Qaytaradi: `{ backupCodes: ["XXXX-XXXX", ...] }` — birinchi va yagona ko'rsatish

### `POST /auth/2fa/disable  { code }`
- TOTP yoki backup kod bilan tasdiqlanadi
- `totpEnabled = false`, `totpSecret = null`, `totpBackupCodes = null`

### `POST /auth/2fa/backup-codes/regenerate  { code }`
- TOTP kod bilan tasdiqlanadi
- Eski kodlarni o'chirib, 8 ta yangi kod beradi
- Qaytaradi: `{ backupCodes: ["XXXX-XXXX", ...] }`

### `DELETE /users/:id/2fa`
- Superadmin: istalgan foydalanuvchi uchun
- Filadmin: faqat o'z tenantidagi xodimlar uchun
- Hech qanday kod talab qilinmaydi (admin reset)
- `totpEnabled = false`, `totpSecret = null`, `totpBackupCodes = null`

---

## 4. `verify-2fa` Endpoint — Backup Kod Logikasi

```typescript
async verifyTwoFactor(tempToken: string, code: string) {
  // 1. tempToken decode → userId, purpose="2fa"
  // 2. User'ni olish, totpEnabled ni tekshirish
  // 3. Avval TOTP sinab ko'rish:
  const isTotp = authenticator.verify({ token: code, secret: decrypt(user.totpSecret) });
  // 4. TOTP xato bo'lsa — backup kodlarni sinab ko'rish:
  if (!isTotp) {
    const codes = JSON.parse(user.totpBackupCodes ?? '[]');
    const idx = await findMatchingBackupCode(code, codes);
    if (idx === -1) throw new UnauthorizedException('Kod noto'g'ri');
    // Ishlatilgan kodni o'chirish (bir martalik):
    codes.splice(idx, 1);
    await prisma.user.update({ data: { totpBackupCodes: JSON.stringify(codes) } });
  }
  // 5. Haqiqiy JWT qaytarish
}
```

---

## 5. Frontend

### Login sahifasi — 2FA qadam

`POST /auth/login` → `status: "2fa_required"` kelsa:

```tsx
// Login formida yangi holat
const [tfaRequired, setTfaRequired] = useState(false);
const [tempToken, setTempToken] = useState('');
const [code, setCode] = useState('');

// "2fa_required" kelganda:
setTfaRequired(true);
setTempToken(res.data.tempToken);

// Ikkinchi forma:
<input
  type="text"
  inputMode="numeric"
  pattern="[0-9 A-Z-]{6,20}"
  placeholder="6 raqamli kod yoki backup kod"
  value={code}
  onChange={(e) => setCode(e.target.value)}
/>
<button onClick={handleVerify2fa}>Tasdiqlash</button>
```

### Profil sahifasi — 2FA boshqaruv bo'limi

`/superadmin` va `/filadmin` profil sahifalarida yangi kartochka:

```
🔐 Ikki bosqichli autentifikatsiya (2FA)
─────────────────────────────────────────
Holat: [Yoqilmagan / Yoqilgan ✅]

[Yoqilmagan holda]:
  [2FA'ni yoqish] tugmasi
  → QR kod + "Google Authenticator'da skanerlang"
  → 6 raqamli kod kiritish
  → Tasdiqlash → backup kodlar sahifasi

[Yoqilgan holda]:
  [Backup kodlarni yangilash] tugmasi
  [2FA'ni o'chirish] tugmasi
```

---

## 6. Env Vars

```
# 2FA TOTP shifrlash kaliti
# openssl rand -base64 32
TOTP_ENCRYPTION_KEY=

# 2FA temp token signing secret
# openssl rand -base64 64
JWT_2FA_SECRET=
```

---

## 7. Xavfsizlik Nuances

| Xatarli holatlar | Yechim |
|---|---|
| Brute force TOTP | ThrottlerGuard (`@Throttle({ default: { ttl: 60_000, limit: 5 } })`) `/auth/verify-2fa`'da |
| Replay attack | TOTP 30s window, `otplib` bir martalik tekshirish |
| Secret leakage | `totpSecret` hech qachon API'dan qaytarilmaydi |
| Backup kod leakage | bcrypt hash — to'g'ridan-to'g'ri ko'rsatilmaydi DB'da |
| Admin abuse | Audit log'da `user.2fa_reset` yoziladi |

---

## 8. Test Strategiyasi

- Unit: `TotpService.generateSecret()`, `TotpService.verify()`
- Unit: `AuthService.verifyTwoFactor()` — TOTP va backup kod oqimlari
- Integration: full login → 2fa_required → verify → JWT oqimi
- Manual: Google Authenticator ilovasi bilan real TOTP kodi
