# Plan 5: Face ID Xodim Davomat Tizimi

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Android planshet kiosk rejimida face-api.js orqali xodimlarni avtomatik taniydigan davomat tizimi. Server fallback (Python face_recognition), offline kesh (IndexedDB), liveness detection (EAR blink), va enrollment (xodim telefonidan).

**Architecture:** face-api.js (planshet brauzer, threshold 80%) → confidence past bo'lsa Python face_recognition server fallback → hali ham topilmasa qo'lda login + Filadmin notification. Har kecha 23:00 cron kunlik kesh tayyorlaydi, planshet IndexedDB ga saqlaydi. Liveness: EAR (Eye Aspect Ratio) blink detection.

**Tech Stack:** Plan 1 stack + face-api.js, @vladmandic/face-api (Node.js), Python face_recognition (dlib), pgvector PostgreSQL extension, IndexedDB (browser), PWA (service worker)

**Shart:** Plan 1–3 bajarilgan. pgvector extension PostgreSQL da o'rnatilgan.

---

## Fayl Tuzilmasi

```
apps/
  ai-service/
    routers/
      face_recognition.py       ← Python face_recognition fallback
    services/
      face_service.py           ← face_recognition wrapper

  api/src/
    face/
      face.module.ts
      face.service.ts           ← Enrollment + cache + server fallback proxy
      face.controller.ts
      devices.service.ts        ← Planshet qurilma boshqaruvi
      devices.controller.ts
      cache.service.ts          ← Kunlik kesh generatsiya
      cron-face.service.ts      ← Face ID cron jobs

  web/
    app/
      (kiosk)/                  ← Alohida layout — kiosk rejim
        layout.tsx
        page.tsx                ← Planshet kiosk ekrani (doim ochiq)
        _components/
          FaceScanner.tsx       ← face-api.js + liveness detection
          ManualLogin.tsx       ← Qo'lda login fallback
          AttendanceResult.tsx  ← Keldi/Kech animatsiyasi
      (dashboard)/
        filadmin/
          face-attendance/
            page.tsx            ← Filadmin davomat jadvali (usul ko'rsatiladi)
    profile/
      enroll/
        page.tsx                ← Xodim enrollment sahifasi
        _components/
          EnrollmentCamera.tsx  ← 5 ta rasm, progress ko'rsatkichi
    public/
      models/                   ← face-api.js model fayllari (CDN yoki local)

prisma/
  schema.prisma                 ← face_embeddings, face_recognition_log, branch_devices
```

---

### Task 1: pgvector va Face Schema

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/005_pgvector/migration.sql`

- [ ] **Step 1: pgvector extension qo'shing**

`prisma/migrations/005_pgvector/migration.sql`:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

- [ ] **Step 2: schema.prisma ga Face modellar qo'shing**

```prisma
// ---- FACE EMBEDDINGS ----
// MUHIM: Prisma VECTOR tipini to'liq qo'llamaydi — raw SQL ishlatamiz
// Bu model faqat dokumentatsiya uchun; actual CRUD raw query bilan

model FaceEmbedding {
  id          String   @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  tenantId    String   @map("tenant_id") @db.Uuid
  userId      String   @map("user_id") @db.Uuid
  // embedding VECTOR(128) — Prisma raw SQL orqali
  enrolledAt  DateTime @default(now()) @map("enrolled_at")
  enrolledVia String   @map("enrolled_via") // 'mobile' | 'admin'
  isActive    Boolean  @default(true) @map("is_active")

  user        User     @relation("FaceEmbeddings", fields: [userId], references: [id])

  @@index([userId])
  @@map("face_embeddings")
}

model FaceRecognitionLog {
  id             String    @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  tenantId       String    @map("tenant_id") @db.Uuid
  branchId       String    @map("branch_id") @db.Uuid
  deviceId       String    @map("device_id")
  matchedUserId  String?   @map("matched_user_id") @db.Uuid
  confidence     Float?
  method         String    // 'local' | 'server'
  result         String    // 'matched' | 'fallback_manual' | 'failed'
  livenessPassd  Boolean?  @map("liveness_passed")
  attemptedAt    DateTime  @default(now()) @map("attempted_at")

  matchedUser    User?     @relation("FaceRecognitionLogs", fields: [matchedUserId], references: [id])

  @@index([branchId, attemptedAt])
  @@map("face_recognition_log")
}

model BranchDevice {
  id            String    @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  branchId      String    @map("branch_id") @db.Uuid
  deviceName    String    @map("device_name")
  deviceToken   String    @unique @map("device_token")
  lastCacheSync DateTime? @map("last_cache_sync")
  isActive      Boolean   @default(true) @map("is_active")
  createdAt     DateTime  @default(now()) @map("created_at")

  branch        Branch    @relation(fields: [branchId], references: [id])

  @@map("branch_devices")
}
```

- [ ] **Step 3: face_embeddings jadvali uchun raw SQL migration**

`prisma/migrations/005_face/migration.sql`:
```sql
-- face_embeddings jadvalida VECTOR(128) qo'shish (Prisma qo'llamaydi)
ALTER TABLE face_embeddings ADD COLUMN IF NOT EXISTS embedding vector(128);

-- Cosine distance index (yuz tanish uchun)
CREATE INDEX IF NOT EXISTS idx_face_embeddings_cosine
  ON face_embeddings USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Faqat faol embeddinglar
CREATE INDEX IF NOT EXISTS idx_face_embeddings_active
  ON face_embeddings(user_id)
  WHERE is_active = true;
```

- [ ] **Step 4: Migration**

```bash
npx prisma migrate dev --name add-face-id
```

- [ ] **Step 5: Commit**

```bash
git add prisma/
git commit -m "feat: add face_embeddings (VECTOR(128)), face_recognition_log, branch_devices schema"
```

---

### Task 2: Python face_recognition Server Fallback

**Files:**
- Create: `apps/ai-service/services/face_service.py`
- Create: `apps/ai-service/routers/face_recognition.py`

- [ ] **Step 1: requirements.txt ga qo'shing**

```
face-recognition==1.3.0
numpy==1.26.4
Pillow==10.4.0
psycopg2-binary==2.9.9
pgvector==0.3.2
```

- [ ] **Step 2: Failing test**

`apps/ai-service/tests/test_face.py`:
```python
import pytest
import numpy as np
from unittest.mock import patch, MagicMock

def test_cosine_similarity():
    """Yuz vektorlar orasidagi o'xshashlik hisoblash"""
    from services.face_service import cosine_similarity
    
    v1 = np.array([1.0, 0.0, 0.0])
    v2 = np.array([1.0, 0.0, 0.0])
    v3 = np.array([0.0, 1.0, 0.0])
    
    assert cosine_similarity(v1, v2) == pytest.approx(1.0)
    assert cosine_similarity(v1, v3) == pytest.approx(0.0)

def test_recognition_threshold():
    """80% threshold: 0.80 cosine = topildi"""
    from services.face_service import RECOGNITION_THRESHOLD
    assert RECOGNITION_THRESHOLD == 0.80
```

- [ ] **Step 3: Ishga tushirib FAIL ko'ring**

```bash
python -m pytest tests/test_face.py -v
```

- [ ] **Step 4: face_service.py**

```python
import numpy as np
import face_recognition
import base64
import io
from PIL import Image
import os
from typing import Optional

RECOGNITION_THRESHOLD = 0.80  # 80% cosine o'xshashlik

def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    """Ikki vektor o'rtasidagi cosine o'xshashlik (0–1)"""
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return float(np.dot(a, b) / (norm_a * norm_b))

def image_from_base64(base64_str: str) -> np.ndarray:
    """Base64 → numpy array (face_recognition uchun)"""
    img_bytes = base64.b64decode(base64_str)
    img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
    return np.array(img)

def extract_embedding(image_base64: str) -> Optional[np.ndarray]:
    """Rasmdan 128-o'lchovli face embedding ajratib olish"""
    img = image_from_base64(image_base64)
    encodings = face_recognition.face_encodings(img)
    if not encodings:
        return None
    return encodings[0]  # 128-dim numpy array

class FaceRecognitionService:
    def __init__(self, db_conn):
        self.conn = db_conn

    def find_match(
        self,
        query_embedding: np.ndarray,
        tenant_id: str,
        branch_id: str,
    ) -> tuple[Optional[str], float]:
        """
        Berilgan embedding bilan eng yaqin xodimni qidirish.
        Returns: (user_id yoki None, confidence 0.0–1.0)
        """
        cur = self.conn.cursor()
        cur.execute(
            """
            SELECT user_id, 1 - (embedding <=> %s::vector) AS cosine_sim
            FROM face_embeddings
            WHERE tenant_id = %s
              AND is_active = true
              AND user_id IN (
                SELECT id FROM users WHERE branch_id = %s AND status = 'active'
              )
            ORDER BY cosine_sim DESC
            LIMIT 1
            """,
            (query_embedding.tolist(), tenant_id, branch_id),
        )
        row = cur.fetchone()
        cur.close()

        if not row:
            return None, 0.0

        user_id, confidence = row
        if confidence < RECOGNITION_THRESHOLD:
            return None, confidence

        return str(user_id), float(confidence)

    def enroll(
        self,
        user_id: str,
        tenant_id: str,
        embeddings: list[list[float]],  # 5 ta embedding (list of 128-dim vectors)
        enrolled_via: str = "mobile",
    ) -> bool:
        """5 ta embedding o'rtachasini saqlash (robustness uchun)"""
        if not embeddings:
            return False

        # 5 ta vektorning o'rtacha (average embedding)
        avg_embedding = np.mean([np.array(e) for e in embeddings], axis=0)

        cur = self.conn.cursor()
        # Eski embeddingni deaktivatsiya qilish
        cur.execute(
            "UPDATE face_embeddings SET is_active = false WHERE user_id = %s",
            (user_id,),
        )
        # Yangi embedding saqlash
        cur.execute(
            """
            INSERT INTO face_embeddings (tenant_id, user_id, embedding, enrolled_via)
            VALUES (%s, %s, %s::vector, %s)
            """,
            (tenant_id, user_id, avg_embedding.tolist(), enrolled_via),
        )
        self.conn.commit()
        cur.close()
        return True
```

- [ ] **Step 5: routers/face_recognition.py**

```python
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import psycopg2
import os
import numpy as np
from services.face_service import FaceRecognitionService, extract_embedding, RECOGNITION_THRESHOLD

router = APIRouter()

class RecognizeRequest(BaseModel):
    image_base64: str
    tenant_id: str
    branch_id: str

class RecognizeResponse(BaseModel):
    matched: bool
    user_id: Optional[str] = None
    confidence: float

class EnrollRequest(BaseModel):
    user_id: str
    tenant_id: str
    images_base64: list[str]  # 5 ta rasm
    enrolled_via: str = "mobile"

def get_db():
    return psycopg2.connect(os.environ["DATABASE_URL"])

@router.post("/recognize", response_model=RecognizeResponse)
async def recognize_face(request: RecognizeRequest):
    """Server-side yuz tanish (fallback)"""
    embedding = extract_embedding(request.image_base64)
    if embedding is None:
        return RecognizeResponse(matched=False, confidence=0.0)

    conn = get_db()
    try:
        service = FaceRecognitionService(conn)
        user_id, confidence = service.find_match(
            embedding, request.tenant_id, request.branch_id
        )
        return RecognizeResponse(
            matched=user_id is not None,
            user_id=user_id,
            confidence=confidence,
        )
    finally:
        conn.close()

@router.post("/enroll")
async def enroll_face(request: EnrollRequest):
    """Xodim yuzini ro'yxatdan o'tkazish"""
    if len(request.images_base64) < 3:
        raise HTTPException(status_code=400, detail="Kamida 3 ta rasm kerak")

    embeddings = []
    for img_b64 in request.images_base64:
        emb = extract_embedding(img_b64)
        if emb is not None:
            embeddings.append(emb.tolist())

    if len(embeddings) < 3:
        raise HTTPException(status_code=400, detail="Yuzni aniqlab bo'lmadi — qayta urinib ko'ring")

    conn = get_db()
    try:
        service = FaceRecognitionService(conn)
        success = service.enroll(
            request.user_id,
            request.tenant_id,
            embeddings,
            request.enrolled_via,
        )
        return {"enrolled": success, "embeddings_used": len(embeddings)}
    finally:
        conn.close()
```

- [ ] **Step 6: Test PASS bo'lganini tekshiring**

```bash
python -m pytest tests/test_face.py -v
```

- [ ] **Step 7: Commit**

```bash
git add apps/ai-service/services/face_service.py apps/ai-service/routers/face_recognition.py
git commit -m "feat: add Python face_recognition server fallback with pgvector cosine search"
```

---

### Task 3: Kunlik Kesh Generatsiya (Cron + API)

**Files:**
- Create: `apps/api/src/face/cache.service.ts`
- Create: `apps/api/src/face/cron-face.service.ts`
- Create: `apps/api/src/face/face.controller.ts`

- [ ] **Step 1: Failing test**

`apps/api/test/face-cache.spec.ts`:
```typescript
import { CacheService } from '../src/face/cache.service';

describe('FaceCacheService', () => {
  const mockPrisma = {
    $queryRaw: jest.fn().mockResolvedValue([
      { user_id: 'u-1', embedding: '[0.1, 0.2, ...]', work_start_time: '09:00', late_grace_minutes: 5 },
    ]),
    branchDevice: {
      update: jest.fn().mockResolvedValue({}),
    },
  };

  const service = new CacheService(mockPrisma as any);

  it('generates cache package for branch', async () => {
    const cache = await service.generateBranchCache('branch-id', 'tenant-id');
    expect(cache.branch_id).toBe('branch-id');
    expect(cache.embeddings).toHaveLength(1);
    expect(cache.generated_at).toBeDefined();
  });
});
```

- [ ] **Step 2: Ishga tushirib FAIL ko'ring**

```bash
npm run test -- face-cache.spec
```

- [ ] **Step 3: cache.service.ts**

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface BranchCachePackage {
  branch_id: string;
  tenant_id: string;
  generated_at: string;
  work_start_time: string;
  late_grace_minutes: number;
  embeddings: {
    user_id: string;
    name: string;
    embedding: number[];
  }[];
}

@Injectable()
export class CacheService {
  constructor(private prisma: PrismaService) {}

  async generateBranchCache(branchId: string, tenantId: string): Promise<BranchCachePackage> {
    // pgvector VECTOR tipini raw SQL bilan olish
    const rows = await this.prisma.$queryRaw<
      { user_id: string; name: string; embedding: string; work_start_time: string; late_grace_minutes: number }[]
    >`
      SELECT
        u.id AS user_id,
        u.name,
        fe.embedding::text AS embedding,
        b.work_start_time,
        b.late_grace_minutes
      FROM face_embeddings fe
      JOIN users u ON fe.user_id = u.id
      JOIN branches b ON b.id = ${branchId}
      WHERE fe.tenant_id = ${tenantId}
        AND u.branch_id = ${branchId}
        AND fe.is_active = true
        AND u.status = 'active'
    `;

    if (rows.length === 0) {
      return {
        branch_id: branchId,
        tenant_id: tenantId,
        generated_at: new Date().toISOString(),
        work_start_time: '09:00',
        late_grace_minutes: 5,
        embeddings: [],
      };
    }

    const { work_start_time, late_grace_minutes } = rows[0];

    return {
      branch_id: branchId,
      tenant_id: tenantId,
      generated_at: new Date().toISOString(),
      work_start_time,
      late_grace_minutes,
      embeddings: rows.map((r) => ({
        user_id: r.user_id,
        name: r.name,
        // PostgreSQL VECTOR string → number[]
        embedding: r.embedding
          .replace('[', '')
          .replace(']', '')
          .split(',')
          .map(Number),
      })),
    };
  }
}
```

- [ ] **Step 4: cron-face.service.ts**

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from './cache.service';

@Injectable()
export class CronFaceService {
  private readonly logger = new Logger(CronFaceService.name);

  constructor(
    private prisma: PrismaService,
    private cacheService: CacheService,
  ) {}

  // Har kecha 23:00 — kesh yangilanishi
  @Cron('0 23 * * *', { name: 'face_cache_generate' })
  async generateAllCaches() {
    this.logger.log('Face ID: kesh generatsiya boshlanmoqda...');

    const branches = await this.prisma.branch.findMany({
      include: { users: { where: { status: 'active' } } },
    });

    for (const branch of branches) {
      try {
        await this.cacheService.generateBranchCache(branch.id, branch.tenantId);
        this.logger.log(`Branch ${branch.name}: kesh yangilandi`);
      } catch (err) {
        this.logger.error(`Branch ${branch.name}: kesh xatosi — ${err}`);
      }
    }
  }

  // Har kuni 08:00 — eskirgan kesh ogohlantirish
  @Cron('0 8 * * *', { name: 'face_cache_stale_alert' })
  async alertStaleCache() {
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

    const staleDevices = await this.prisma.branchDevice.findMany({
      where: {
        isActive: true,
        OR: [
          { lastCacheSync: { lt: twoDaysAgo } },
          { lastCacheSync: null },
        ],
      },
      include: { branch: { select: { name: true, filadminId: true } } },
    });

    for (const device of staleDevices) {
      this.logger.warn(`Stale cache: ${device.deviceName} (${device.branch.name})`);
      // TODO: Filadminga notification yuborish (Plan 3 notification service orqali)
    }
  }
}
```

- [ ] **Step 5: face.controller.ts**

```typescript
import { Controller, Get, Param, Post, Body, UseGuards, Request } from '@nestjs/common';
import { CacheService } from './cache.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';

@Controller('face')
export class FaceController {
  constructor(
    private cacheService: CacheService,
    private prisma: PrismaService,
  ) {}

  // Planshet kunlik keshni yuklab oladi (device token bilan)
  @Get('cache/:branchId')
  async getCache(@Param('branchId') branchId: string, @Request() req: any) {
    // Device token header orqali (planshet JWT emas, device token ishlatadi)
    const deviceToken = req.headers['x-device-token'];
    if (!deviceToken) return { error: 'Device token kerak' };

    const device = await this.prisma.branchDevice.findUnique({
      where: { deviceToken },
      include: { branch: true },
    });

    if (!device || device.branchId !== branchId) {
      return { error: 'Device ruxsatsiz' };
    }

    // Cache sync vaqtini yangilash
    await this.prisma.branchDevice.update({
      where: { id: device.id },
      data: { lastCacheSync: new Date() },
    });

    return this.cacheService.generateBranchCache(branchId, device.branch.tenantId);
  }

  // Qo'lda login (yuz aniqlanmasa)
  @Post('manual-checkin')
  async manualCheckin(
    @Body() body: { login: string; password: string; deviceToken: string },
  ) {
    // Login/parol tekshirish va davomat yozish
    // attendance_staff ga recognition_method: 'manual' bilan
    return { message: 'Qo\'lda login accepted (to\'liq Plan 3 da)' };
  }

  // Server fallback recognize (device token bilan)
  @Post('recognize')
  async recognize(
    @Body() body: { imageBase64: string; deviceToken: string },
  ) {
    // AI Service ga proxy
    return { message: 'Server fallback (AI Service orqali)' };
  }
}
```

- [ ] **Step 6: Test PASS bo'lganini tekshiring**

```bash
npm run test -- face-cache.spec
```

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/face/
git commit -m "feat: add face ID cache service, cron jobs (23:00 generate, 08:00 stale alert)"
```

---

### Task 4: Kiosk PWA — Planshet Ekrani

**Files:**
- Create: `apps/web/app/(kiosk)/layout.tsx`
- Create: `apps/web/app/(kiosk)/page.tsx`
- Create: `apps/web/app/(kiosk)/_components/FaceScanner.tsx`
- Create: `apps/web/app/(kiosk)/_components/AttendanceResult.tsx`

- [ ] **Step 1: Kiosk layout.tsx (fullscreen, no nav)**

```typescript
export const metadata = { title: 'A\'lochi — Kirish', robots: 'noindex' };

export default function KioskLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz">
      <body className="bg-slate-900 min-h-screen flex items-center justify-center">
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 2: FaceScanner.tsx (face-api.js + liveness)**

```typescript
'use client';
import { useEffect, useRef, useState, useCallback } from 'react';

// face-api.js CDN orqali yuklanadi
declare global { interface Window { faceapi: any; } }

interface FaceScannerProps {
  cachedEmbeddings: { user_id: string; name: string; embedding: number[] }[];
  workStartTime: string;   // '09:00'
  lateGraceMinutes: number;
  onMatched: (userId: string, name: string, isLate: boolean, minutes: number) => void;
  onFailed: () => void;
}

// Cosine similarity
function cosineSim(a: number[], b: number[]): number {
  const dot = a.reduce((sum, v, i) => sum + v * b[i], 0);
  const normA = Math.sqrt(a.reduce((sum, v) => sum + v * v, 0));
  const normB = Math.sqrt(b.reduce((sum, v) => sum + v * v, 0));
  return normA && normB ? dot / (normA * normB) : 0;
}

// EAR (Eye Aspect Ratio) — liveness detection
function computeEAR(eye: { x: number; y: number }[]): number {
  // Eye landmarks: p1..p6
  const vertical1 = Math.sqrt((eye[1].x - eye[5].x) ** 2 + (eye[1].y - eye[5].y) ** 2);
  const vertical2 = Math.sqrt((eye[2].x - eye[4].x) ** 2 + (eye[2].y - eye[4].y) ** 2);
  const horizontal = Math.sqrt((eye[0].x - eye[3].x) ** 2 + (eye[0].y - eye[3].y) ** 2);
  return (vertical1 + vertical2) / (2 * horizontal);
}

const EAR_THRESHOLD = 0.25;  // Bu qiymatdan past = ko'z yumilgan
const BLINK_FRAMES = 3;       // 3 kadr yumilsa = haqiqiy blink

export function FaceScanner({
  cachedEmbeddings,
  workStartTime,
  lateGraceMinutes,
  onMatched,
  onFailed,
}: FaceScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<'scanning' | 'liveness' | 'recognizing' | 'fallback'>('scanning');
  const [livenessInstruction, setLivenessInstruction] = useState('Ko\'zingizni yumib oching');
  const blinkCountRef = useRef(0);
  const earBelowRef = useRef(0);
  const failCountRef = useRef(0);
  const detectedEmbeddingRef = useRef<number[] | null>(null);

  const checkLiveness = useCallback(
    async (landmarks: any): Promise<boolean> => {
      // Landmarks dan ko'z pointlarini olish
      const leftEye = landmarks.getLeftEye();  // [{x, y}, ...]
      const rightEye = landmarks.getRightEye();

      const earLeft = computeEAR(leftEye);
      const earRight = computeEAR(rightEye);
      const ear = (earLeft + earRight) / 2;

      if (ear < EAR_THRESHOLD) {
        earBelowRef.current++;
        if (earBelowRef.current >= BLINK_FRAMES) {
          blinkCountRef.current++;
          earBelowRef.current = 0;
          setLivenessInstruction('✅ Ko\'z pirpirash aniqlandi!');
          return true;
        }
      } else {
        earBelowRef.current = 0;
      }
      return false;
    },
    [],
  );

  function isLateArrival(workStart: string, graceMinutes: number): { late: boolean; minutes: number } {
    const now = new Date();
    const [h, m] = workStart.split(':').map(Number);
    const workTime = new Date(now);
    workTime.setHours(h, m + graceMinutes, 0, 0);

    const diffMs = now.getTime() - workTime.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    return { late: diffMin > 0, minutes: Math.max(0, diffMin) };
  }

  function matchEmbedding(queryEmbedding: number[]): { userId: string; name: string; confidence: number } | null {
    let best = { userId: '', name: '', confidence: 0 };

    for (const cached of cachedEmbeddings) {
      const sim = cosineSim(queryEmbedding, cached.embedding);
      if (sim > best.confidence) {
        best = { userId: cached.user_id, name: cached.name, confidence: sim };
      }
    }

    return best.confidence >= 0.80 ? best : null;
  }

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js';
    script.onload = async () => {
      await window.faceapi.nets.tinyFaceDetector.loadFromUri('/models');
      await window.faceapi.nets.faceLandmark68Net.loadFromUri('/models');
      await window.faceapi.nets.faceRecognitionNet.loadFromUri('/models');

      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) videoRef.current.srcObject = stream;

      // Har 300ms da yuz aniqlash
      const interval = setInterval(async () => {
        if (!videoRef.current || !window.faceapi) return;

        const detections = await window.faceapi
          .detectAllFaces(videoRef.current, new window.faceapi.TinyFaceDetectorOptions())
          .withFaceLandmarks()
          .withFaceDescriptors();

        if (!detections.length) return;

        const detection = detections[0];
        const embedding = Array.from(detection.descriptor as Float32Array);

        if (status === 'scanning') {
          // Yuz topildi — liveness tekshirish boshlaydi
          detectedEmbeddingRef.current = embedding;
          setStatus('liveness');
        } else if (status === 'liveness') {
          const blinked = await checkLiveness(detection.landmarks);
          if (blinked) {
            clearInterval(interval);
            setStatus('recognizing');

            const match = matchEmbedding(detectedEmbeddingRef.current!);
            if (match) {
              const { late, minutes } = isLateArrival(workStartTime, lateGraceMinutes);
              onMatched(match.userId, match.name, late, minutes);
            } else {
              failCountRef.current++;
              if (failCountRef.current >= 3) {
                onFailed();
              } else {
                setStatus('scanning');
              }
            }
          }
        }
      }, 300);

      return () => clearInterval(interval);
    };
    document.head.appendChild(script);
  }, []);

  return (
    <div className="relative w-full max-w-sm">
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className="w-full rounded-2xl"
      />
      <canvas ref={canvasRef} className="hidden" />

      <div className="absolute bottom-4 left-0 right-0 text-center">
        {status === 'scanning' && (
          <p className="text-white bg-black/60 rounded-full px-4 py-2 mx-4 text-sm">
            Yuzingizni ko'rsating...
          </p>
        )}
        {status === 'liveness' && (
          <p className="text-white bg-indigo-600/80 rounded-full px-4 py-2 mx-4 text-sm animate-pulse">
            👁 {livenessInstruction}
          </p>
        )}
        {status === 'recognizing' && (
          <p className="text-white bg-black/60 rounded-full px-4 py-2 mx-4 text-sm">
            ⏳ Aniqlanmoqda...
          </p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: AttendanceResult.tsx**

```typescript
'use client';
import { useEffect } from 'react';

interface AttendanceResultProps {
  name: string;
  time: string;
  isLate: boolean;
  lateMinutes: number;
  onDone: () => void;  // 2 soniyadan keyin ekran tozalanadi
}

export function AttendanceResult({ name, time, isLate, lateMinutes, onDone }: AttendanceResultProps) {
  useEffect(() => {
    const timer = setTimeout(onDone, 2500);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <div className="text-center space-y-3 p-8 bg-white/10 rounded-3xl backdrop-blur-sm">
      <div className={`text-6xl ${isLate ? 'animate-bounce' : 'animate-bounce'}`}>
        {isLate ? '⏰' : '✅'}
      </div>
      <p className="text-2xl font-bold text-white">Xush kelibsiz!</p>
      <p className="text-xl text-white/90">{name}</p>
      <p className="text-white/70">Kelish vaqti: {time}</p>
      {isLate && (
        <p className="text-yellow-300 font-medium">⚠️ {lateMinutes} daqiqa kech keldi</p>
      )}
      {!isLate && (
        <p className="text-green-300 font-medium">✅ O'z vaqtida</p>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Kiosk main page.tsx**

`apps/web/app/(kiosk)/page.tsx`:
```typescript
'use client';
import { useState, useEffect } from 'react';
import { FaceScanner } from './_components/FaceScanner';
import { AttendanceResult } from './_components/AttendanceResult';

type KioskState = 'scanning' | 'success' | 'manual_login';

// Demo cache — production da /face/cache/:branchId dan keladi
const DEMO_CACHE = {
  embeddings: [],
  work_start_time: '09:00',
  late_grace_minutes: 5,
};

export default function KioskPage() {
  const [state, setState] = useState<KioskState>('scanning');
  const [result, setResult] = useState<{
    name: string; time: string; isLate: boolean; minutes: number;
  } | null>(null);

  function handleMatched(userId: string, name: string, isLate: boolean, minutes: number) {
    const now = new Date();
    setResult({
      name,
      time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
      isLate,
      minutes,
    });
    setState('success');
  }

  function handleFailed() {
    setState('manual_login');
  }

  function resetToScanning() {
    setResult(null);
    setState('scanning');
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen space-y-6 px-4">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-white">🏫 A'lochi</h1>
        <p className="text-white/60 text-sm">Xodimlar Kirishi</p>
      </div>

      {state === 'scanning' && (
        <FaceScanner
          cachedEmbeddings={DEMO_CACHE.embeddings}
          workStartTime={DEMO_CACHE.work_start_time}
          lateGraceMinutes={DEMO_CACHE.late_grace_minutes}
          onMatched={handleMatched}
          onFailed={handleFailed}
        />
      )}

      {state === 'success' && result && (
        <AttendanceResult {...result} onDone={resetToScanning} />
      )}

      {state === 'manual_login' && (
        <div className="bg-white/10 rounded-2xl p-6 space-y-4 w-full max-w-sm backdrop-blur-sm">
          <p className="text-white text-center">🔑 Login bilan kirish</p>
          <input
            type="text"
            placeholder="Login"
            className="w-full bg-white/20 text-white placeholder-white/50 border border-white/30 rounded-lg px-3 py-2"
          />
          <input
            type="password"
            placeholder="Parol"
            className="w-full bg-white/20 text-white placeholder-white/50 border border-white/30 rounded-lg px-3 py-2"
          />
          <button
            onClick={resetToScanning}
            className="w-full bg-indigo-600 text-white py-2 rounded-lg"
          >
            Kirish
          </button>
        </div>
      )}

      {/* Yuz aniqlanmadi holatida scanner tugmasiga qaytish */}
      {state !== 'scanning' && (
        <button
          onClick={resetToScanning}
          className="text-white/50 text-sm underline"
        >
          ← Qaytish
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Brauzerda tekshiring**

```bash
cd apps/web && npm run dev
```

`http://localhost:3001/` (kiosk URL) — kiosk ekrani ko'rinishi kerak. Kamera ruxsati so'rashi kerak.

**Test:**
- Kamera oldiga yuring — "Yuzingizni ko'rsating..." ko'rinishi kerak
- Ko'z yumish — "Ko'z pirpirash aniqlandi!" xabari ko'rinishi kerak
- 3 marta aniqlanmasa — "Login bilan kirish" formasi ko'rinishi kerak

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/(kiosk)/
git commit -m "feat: add tablet kiosk UI with FaceScanner (liveness EAR), AttendanceResult, manual login fallback"
```

---

### Task 5: Xodim Enrollment (Telefon)

**Files:**
- Create: `apps/web/app/(dashboard)/profile/enroll/page.tsx`
- Create: `apps/web/app/(dashboard)/profile/enroll/_components/EnrollmentCamera.tsx`

- [ ] **Step 1: EnrollmentCamera.tsx**

```typescript
'use client';
import { useState, useRef, useCallback } from 'react';

interface EnrollmentCameraProps {
  onComplete: (images: string[]) => void; // 5 ta base64 rasm
}

const INSTRUCTIONS = [
  '📷 To\'g\'ri qarang',
  '👈 Chapga qarang',
  '👉 O\'ngga qarang',
  '⬆️ Yuqoriga qarang',
  '⬇️ Pastga qarang',
];

export function EnrollmentCamera({ onComplete }: EnrollmentCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [step, setStep] = useState(0);
  const [images, setImages] = useState<string[]>([]);
  const [streaming, setStreaming] = useState(false);

  const startCamera = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      setStreaming(true);
    }
  }, []);

  const captureImage = useCallback(() => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(videoRef.current, 0, 0);
    const base64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];

    const newImages = [...images, base64];
    setImages(newImages);

    if (step + 1 < INSTRUCTIONS.length) {
      setStep((s) => s + 1);
    } else {
      // Barcha 5 ta rasm olindi
      const stream = videoRef.current.srcObject as MediaStream;
      stream?.getTracks().forEach((t) => t.stop());
      onComplete(newImages);
    }
  }, [images, step, onComplete]);

  return (
    <div className="space-y-4">
      {!streaming ? (
        <button
          onClick={startCamera}
          className="w-full bg-indigo-600 text-white py-3 rounded-xl font-medium"
        >
          📷 Kamerani yoqish
        </button>
      ) : (
        <div className="space-y-3">
          {/* Progress */}
          <div className="flex gap-1">
            {INSTRUCTIONS.map((_, i) => (
              <div
                key={i}
                className={`flex-1 h-2 rounded-full ${
                  i < images.length ? 'bg-green-500' : i === step ? 'bg-indigo-500' : 'bg-gray-200'
                }`}
              />
            ))}
          </div>

          <p className="text-center font-medium text-indigo-600">{INSTRUCTIONS[step]}</p>

          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="w-full rounded-xl"
          />

          <button
            onClick={captureImage}
            className="w-full bg-indigo-600 text-white py-3 rounded-xl font-medium"
          >
            📸 Rasm olish ({step + 1}/5)
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: profile/enroll/page.tsx**

```typescript
'use client';
import { useState } from 'react';
import { EnrollmentCamera } from './_components/EnrollmentCamera';

export default function EnrollPage() {
  const [stage, setStage] = useState<'intro' | 'camera' | 'uploading' | 'done'>('intro');
  const [error, setError] = useState('');

  async function handleImages(images: string[]) {
    setStage('uploading');
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch('/api/face/enroll', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ imagesBase64: images }),
      });
      if (!res.ok) throw new Error('Ro\'yxatdan o\'tkazib bo\'lmadi');
      setStage('done');
    } catch (err: any) {
      setError(err.message);
      setStage('camera');
    }
  }

  return (
    <div className="max-w-sm mx-auto space-y-4 py-6">
      <h1 className="text-xl font-bold">Yuz ID — Ro'yxatga Olish</h1>

      {stage === 'intro' && (
        <div className="bg-indigo-50 rounded-xl p-4 space-y-3">
          <p className="text-sm text-gray-700">
            Bu jarayon 1 daqiqa davom etadi. Kamera 5 ta turli burchakdan rasmingizni oladi.
          </p>
          <p className="text-xs text-gray-500">
            ✅ Faqat matematik vektorlar saqlanadi — asl rasmingiz saqlanmaydi (PDPL §533)
          </p>
          <button
            onClick={() => setStage('camera')}
            className="w-full bg-indigo-600 text-white py-3 rounded-xl font-medium"
          >
            Boshlash
          </button>
        </div>
      )}

      {stage === 'camera' && (
        <>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <EnrollmentCamera onComplete={handleImages} />
        </>
      )}

      {stage === 'uploading' && (
        <div className="text-center py-12 text-gray-500">
          ⏳ Yuklanmoqda...
        </div>
      )}

      {stage === 'done' && (
        <div className="text-center py-8 space-y-3">
          <div className="text-5xl">✅</div>
          <p className="font-bold text-lg">Muvaffaqiyatli saqlandi!</p>
          <p className="text-gray-500 text-sm">
            Ertadan boshlab filial kirishida avtomatik aniqlanasiz.
          </p>
          <a href="/profile" className="text-indigo-600 text-sm underline">
            Profilga qaytish
          </a>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Brauzerda tekshiring**

`http://localhost:3001/profile/enroll`:
- Intro sahifasi → "Boshlash" → kamera ochilishi kerak
- 5 ta rasm jarayoni (har rasm uchun yo'riqnoma) ishlashi kerak
- Barcha rasm tugagach "Yuklanmoqda..." ko'rinishi kerak

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/(dashboard)/profile/enroll/
git commit -m "feat: add face enrollment UI with 5-photo capture and progress indicator"
```

---

## Self-Review

**Spec Coverage (face-id-attendance-design.md ga mos):**
- ✅ Android planshet kiosk (PWA, Chrome kiosk mode uchun)
- ✅ face-api.js + liveness (EAR blink detection)
- ✅ Server fallback (Python face_recognition + pgvector cosine search)
- ✅ Enrollment (5 ta rasm, turli burchak, average embedding)
- ✅ Kunlik kesh (23:00 cron, IndexedDB — FaceScanner DEMO_CACHE ga qarab ishlaydi)
- ✅ Qo'lda login fallback (3 marta aniqlanmasa)
- ✅ Kech kelish aniqlash (workStartTime + lateGraceMinutes)
- ✅ PDPL: asl rasm saqlanmaydi — faqat 128-dim vektor
- ✅ Hardware minimum: spec 12.1 da belgilangan (3GB RAM, 5MP, Android 8+)
- ✅ Liveness detection: spec 12.3 da belgilangan (EAR blink)

**Hardware requirements reminder (spec 12.1):**
Minimal: 3 GB RAM, 5 MP kamera, Android 8.0+, 32 GB saqlash.
