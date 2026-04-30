# Faza 4 — ML Churn Prediction Design

**Goal:** Hozirgi rule-based churn scoring'ni ML modelga ko'chirish — Python FastAPI mikroservis, scikit-learn model (logistic regression yoki gradient boosting), historical event data'dan train, kunlik inference cron orqali barcha o'quvchilar uchun churn probability hisoblash.

**Scope:** Yangi Python mikroservis (Face ID kabi), training pipeline, inference endpoint, `ChurnService` ML inference'ga o'tadi (rule-based fallback bilan). Frontend o'zgarmaydi (mavjud `/superadmin/churn` bir xil schema bilan ishlaydi).

---

## 1. Maqsad va biznes mantiqi

**Holat:** Hozirgi `ChurnService.computeScore()` rule-based — 5 ta signal: absent3Days (+30), streakBroken (+20), passRateDrop (+25), redStatus (+25), noParentTg (+10). Aniq, predictable, lekin:
- Signal og'irliklari qo'lda tanlangan (subjective)
- Yangi signal qo'shish kod o'zgarishini talab qiladi
- Bashorat aniqligi o'lchanmaydi (precision/recall)

**ML afzalligi:** Training data'dan og'irliklarni o'rganadi. Yangi signallar ham xususiyat sifatida qo'shiladi. Precision/recall/F1 score bilan o'lchanadi.

**Cheklov:** Training data hozir cheklangan (3-6 oy event log'i). Birinchi versiya rule-based bilan parallel ishlaydi (A/B comparison). Model "yetarli" bo'lganda rule-based o'chiriladi.

**YAGNI:**
- Real-time online learning **yo'q** — kunlik batch retraining
- Deep learning **yo'q** — tabular data uchun gradient boosting yetarli
- Model versioning + A/B traffic split **yo'q** — bitta model production'da
- Hyperparameter tuning UI **yo'q** — defaultlar
- Feature importance dashboard **yo'q** — superadmin uchun JSON endpoint yetarli

---

## 2. Arxitektura

```
┌─────────────────────────────────────┐
│  PostgreSQL (training data)         │
│  - analytics_events (event log)     │
│  - student_progress, attendance     │
│  - student_xp, student_status       │
│  - churn_scores (label history)     │  ← target labels
└─────────────────────────────────────┘
              │
              │  Daily training job (06:00 cron)
              ▼
┌─────────────────────────────────────┐
│  Python ML service (FastAPI)        │
│  - /train POST → retrain model      │
│  - /predict POST → probability      │
│  - Persistent model: model.pkl      │
│  - scikit-learn GradientBoosting    │
└─────────────────────────────────────┘
              ▲
              │  HTTP inference
              │
┌─────────────────────────────────────┐
│  NestJS API                         │
│  - ChurnService.computeScore        │
│      → Hybrid: ML primary, rule fallback│
│  - Cron 06:00: predict all students │
│  - Existing /churn endpoints        │
└─────────────────────────────────────┘
```

**Hybrid scoring strategy:**
- ChurnService.computeScore() avval ML inference ga so'rov yuboradi
- ML service down/error → rule-based fallback (existing logic)
- Logging: qaysi method ishlatilgan
- Score format bir xil (0-100), frontend o'zgarmaydi

---

## 3. Python ML service

**Joylashuv:** `apps/ml-service/` (Face ID `apps/ai-service/` bilan parallel).

**Tech stack:**
- Python 3.11
- FastAPI (HTTP framework)
- scikit-learn 1.5+ (GradientBoostingClassifier)
- pandas (data manipulation)
- joblib (model serialization)
- asyncpg (PostgreSQL async client for training data extraction)

**Endpoints:**

```
POST /train
  → Retrains model from PostgreSQL data
  → Returns: { trainedAt, samples, accuracy, precision, recall, f1, modelVersion }

POST /predict
  body: { features: { absent_days, streak_value, pass_rate_change, has_red_status, has_parent_tg, lessons_completed_30d, avg_session_count } }
  → Returns: { probability: 0.0-1.0, score: 0-100, modelVersion }

GET /health
  → Returns: { status, modelLoaded, modelVersion }

GET /metrics
  → Returns: latest training metrics (accuracy, precision, recall, F1)
```

**Model yo'q bo'lsa** (cold start): `/predict` 503 qaytaradi, NestJS rule-based fallback ishlatadi.

**Persistence:** `model.pkl` Docker volume'da (`/app/models/`).

---

## 4. Training pipeline

**`train.py` — kunlik 05:00'da chaqiriladi:**

1. PostgreSQL'dan oxirgi 90 kun data ekstrakt:
   - Har student uchun feature vector (snapshot 30 kun oldingi)
   - Target label: keyingi 30 kunda 7+ kun absent bo'lganmi (boolean)

2. Feature engineering:
   ```
   absent_days_30d        — oxirgi 30 kunda absent bo'lgan kunlar soni
   streak_value           — joriy streak
   pass_rate_30d          — 30 kunlik pass rate
   pass_rate_drop         — pass rate o'zgarishi (delta last_week vs prev_week)
   has_red_status         — boolean
   has_parent_tg          — boolean
   lessons_completed_30d  — 30 kun ichida tugatilgan darslar
   avg_session_count      — dars o'rtacha sessiya
   xp_gained_7d           — oxirgi 7 kun XP
   ```

3. Train/test split (80/20 stratified)

4. GradientBoostingClassifier(n_estimators=100, max_depth=4, random_state=42)

5. Train + cross-validation

6. Save model.pkl + metrics.json

**Cold start (data kam):**
- Minimum 100 ta labeled sample kerak
- Yo'q bo'lsa: training fail qiladi, oldingi model qoladi (rule-based fallback ishlatiladi)

---

## 5. NestJS integration

### 5.1 ChurnService.computeScore — hybrid

```ts
async computeScoreML(studentId: string): Promise<{ score: number; signals: object; method: 'ml' | 'rule_fallback' }> {
  // 1. Build feature vector from PostgreSQL
  const features = await this.buildFeatures(studentId);
  
  // 2. Try ML service
  try {
    const response = await this.httpService.post(
      `${this.config.get('ML_SERVICE_URL')}/predict`,
      { features },
      { timeout: 2000 },
    );
    return {
      score: response.data.score,
      signals: { ...features, ml_probability: response.data.probability },
      method: 'ml',
    };
  } catch (e) {
    // 3. ML down → rule-based fallback
    this.logger.warn(`ML service down, falling back to rules: ${e.message}`);
    return {
      ...this.computeScoreRuleBased(studentId),
      method: 'rule_fallback',
    };
  }
}
```

`computeScoreRuleBased` — mavjud `computeScore` logikasi (5 signal hardcoded weights), nomi o'zgartiriladi.

### 5.2 Daily cron — barcha o'quvchilar

Mavjud `runDailyScoring(tenantId)` `computeScoreML` ga o'tadi (saqlash mantig'i o'zgarmaydi).

### 5.3 Yangi endpoint: model metrics (superadmin)

```
GET /churn/model-metrics
@Roles(superadmin)
```
Returns latest training metrics — frontend ko'rsatish uchun (kelajakda, hozir API only).

---

## 6. Docker integration

**`docker-compose.yml` ga qo'shiladi:**
```yaml
  ml-service:
    build:
      context: apps/ml-service
      dockerfile: Dockerfile
    container_name: alochi_ml
    ports:
      - '8001:8001'
    environment:
      DATABASE_URL: postgresql://postgres:password@db:5432/alochi
      MODEL_PATH: /app/models/churn_model.pkl
    volumes:
      - ml_models:/app/models
    depends_on:
      db:
        condition: service_healthy

volumes:
  ml_models:
```

**`apps/ml-service/Dockerfile`:**
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
RUN mkdir -p /app/models
EXPOSE 8001
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]
```

**`apps/ml-service/requirements.txt`:**
```
fastapi==0.115.0
uvicorn==0.30.6
scikit-learn==1.5.2
pandas==2.2.3
joblib==1.4.2
asyncpg==0.30.0
pydantic==2.9.2
python-dateutil==2.9.0
```

**API .env qo'shiladi:**
```
ML_SERVICE_URL=http://localhost:8001
ML_SERVICE_TIMEOUT_MS=2000
```

---

## 7. Fayl strukturasi

**Yaratish:**
- `apps/ml-service/Dockerfile`
- `apps/ml-service/requirements.txt`
- `apps/ml-service/main.py` — FastAPI app
- `apps/ml-service/train.py` — training script
- `apps/ml-service/features.py` — feature engineering
- `apps/ml-service/db.py` — asyncpg helper
- `apps/ml-service/model_store.py` — load/save model
- `apps/ml-service/.env.example`

**O'zgartirish:**
- `docker-compose.yml` — ml-service, ml_models volume
- `apps/api/.env` + `.env.example` — ML_SERVICE_URL
- `apps/api/src/churn/churn.service.ts` — `computeScoreML`, `computeScoreRuleBased` rename, hybrid logic
- `apps/api/src/churn/churn.module.ts` — `HttpModule` import
- `apps/api/src/churn/churn.controller.ts` — `/model-metrics` endpoint
- `apps/api/src/cron/cron.service.ts` — `runMlTraining` cron at 05:00 (POST /train)
- `apps/api/test/churn.spec.ts` — extend tests

---

## 8. Acceptance Criteria

- [ ] `apps/ml-service/` directory with all 7 Python files
- [ ] `docker compose up ml-service` — service healthy, FastAPI listening on 8001
- [ ] `POST /train` succeeds (or returns 503 if no data)
- [ ] `POST /predict` returns probability for valid features
- [ ] `GET /health` returns 200
- [ ] NestJS ChurnService hybrid: ML first, rule-based fallback
- [ ] Cron 05:00 retrains daily; cron 06:00 (existing) uses ML scores
- [ ] Sacred quality bar: typecheck 0 (api), lint 0 (api), build OK
- [ ] Python tests: 3 unit tests (feature extraction, model save/load, prediction shape)
- [ ] Frontend `/superadmin/churn` o'zgarmaydi — ishlashi davom etadi
