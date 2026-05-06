# Phase 11b — Redis Caching + DB Indexes Dizayni

**Sana:** 2026-05-05
**Muallif:** Davlatbek + Claude
**Holat:** Tasdiqlangan ✅

---

## Maqsad

Adouptivo API'ning eng ko'p so'ratiladigan endpoint'larini Redis bilan keshlab, DB yukini kamaytirish va javob vaqtini tezlashtirish. Shuningdek, `EXPLAIN ANALYZE` orqali DB'dagi sekin so'rovlarni aniqlash va kerakli indekslarni qo'shish.

---

## Texnik Stack

- `cache-manager` v5+
- `cache-manager-redis-yet` (ioredis asosida)
- `@nestjs/cache-manager`
- Mavjud NestJS 10 + Prisma 5 stack

---

## 1. Redis Caching

### Kesh qilinadigan endpoint'lar

| Endpoint | Redis Kalit | TTL | Sabab |
|---|---|---|---|
| `GET /marketing/landing` | `mc:landing` | 60s | Public, eng ko'p so'ratiladigan, Next.js revalidate bilan mos |
| `GET /marketing/students?limit=50` | `mc:students:50:0` | 30s | Public, katta array, tez o'zgarmaydi |
| `GET /marketing/stats` | `mc:stats` | 60s | Public aggregate, DB join talab qiladi |
| `GET /marketing/regions` | `mc:regions` | 300s | Deyarli o'zgarmaydi |
| `GET /lessons` (per tenant) | `mc:lessons:{tenantId}` | 30s | Har tenant alohida, dars publish bo'lganda 30s ichida ko'rinadi |
| `GET /branding/:slug` | `mc:branding:{slug}` | 120s | Login sahifasi har yuklanishda so'raydi |

### Kesh qilinmaydigan endpoint'lar

- `POST`, `PATCH`, `DELETE` — hech qachon kesh qilinmaydi
- Auth endpoint'lar (`/auth/*`)
- Shaxsiy ma'lumotlar (`/users/my-profile`, `/progress/*`, `/gamification/*`)
- Webhook'lar

### Arxitektura

```
CacheModule.registerAsync({
  useFactory: (config) => ({
    store: redisStore,
    host: config.get('REDIS_HOST', 'localhost'),
    port: config.get('REDIS_PORT', 6379),
    password: config.get('REDIS_PASSWORD'),
    ttl: 30_000,  // default 30s (milliseconds in v5)
  }),
  inject: [ConfigService],
})
```

### Kesh strategiyasi

**Qo'lda (service darajasida):**
```typescript
// Marketing servisda
async getLandingContent() {
  const key = 'mc:landing';
  const cached = await this.cache.get(key);
  if (cached) return cached;
  
  const result = await this.computeLandingContent();
  await this.cache.set(key, result, 60_000);
  return result;
}
```

Marketing servis o'z cacheini boshqaradi — bu `@UseInterceptors(CacheInterceptor)` dan aniqroq, chunki kesh kalitini to'g'ri belgilash mumkin.

LessonsService'da tenant-scope'd kalit:
```typescript
const key = `mc:lessons:${tenantId}`;
```

### Redis ulanishi xatolik bo'lganda

Redis ishlamasa (network error, restart) → tizim avtomatik DB'dan o'qiydi. Kesh optional, hech qachon bloker emas:
```typescript
const cached = await this.cache.get(key).catch(() => null);
```

---

## 2. DB Indexes Audit

### Tekshiriladigan so'rovlar

Quyidagi Prisma so'rovlar eng ko'p ishlatiladigan — bularning execution plan'ini tekshiramiz:

**1. `StudentProgress` — akademiya tugash holati**
```sql
EXPLAIN ANALYZE
SELECT * FROM student_progress
WHERE student_id = $1 AND academy_completed = true;
```
→ Taklif: `CREATE INDEX CONCURRENTLY ON student_progress (student_id, academy_completed) WHERE academy_completed = true;`

**2. `User` — tenant bo'yicha rol filter**
```sql
EXPLAIN ANALYZE
SELECT * FROM users
WHERE tenant_id = $1 AND role = 'student' AND status = 'active';
```
→ Mavjud index tekshiriladi; partial index qo'shish kerak bo'lishi mumkin.

**3. `ExamPermission` — aktiv imtihon**
```sql
EXPLAIN ANALYZE
SELECT * FROM exam_permissions
WHERE student_id = $1 AND status = 'active';
```
→ Taklif: `CREATE INDEX CONCURRENTLY ON exam_permissions (student_id, status) WHERE status = 'active';`

**4. `LandingItem` — kind + ko'rinish**
```sql
EXPLAIN ANALYZE
SELECT * FROM landing_items
WHERE kind = 'prize' AND is_visible = true
ORDER BY order_index ASC;
```
→ Allaqachon `@@index([kind, isVisible, orderIndex])` bor — tekshirish.

**5. `RefreshToken` — token hash**
```sql
EXPLAIN ANALYZE
SELECT * FROM refresh_tokens WHERE token = $1;
```
→ `@id`-like field — tekshirish.

### Migration

Yangi indekslar migration orqali qo'shiladi:
- `0047_performance_indexes`
- `CONCURRENTLY` kalit so'z bilan (production'da jadval locklanmaydi)

---

## Xavfsizlik / Risk

| Risk | Yechim |
|---|---|
| Redis down → kesh ishlamaydi | `try/catch` → DB fallback |
| Stale data (eskirgan ma'lumot) | TTL qisqa (30-60s), hech qachon 5 minutdan ko'p emas |
| Memory overflow | Redis `maxmemory` + `allkeys-lru` policy |
| Tenant ma'lumot leakage | Har tenant uchun alohida kalit `mc:lessons:{tenantId}` |

---

## Test Strategiyasi

- Unit: `CacheService` mock bilan
- Integration: Redis Test Container yoki `cache-manager` in-memory store bilan
- Manual: `redis-cli MONITOR` bilan kesh hit/miss tekshirish
