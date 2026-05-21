-- Faza 5: AI Analysis layer
-- Adds RiskScore, DailyBriefing, ParentMessage, AiInsightQuery, AiUsageLog

-- RiskScore: daily per-student risk score (0-100)
CREATE TABLE "RiskScore" (
  "id"         TEXT         NOT NULL PRIMARY KEY,
  "studentId"  TEXT         NOT NULL,
  "date"       DATE         NOT NULL,
  "totalScore" INT          NOT NULL,
  "components" JSONB        NOT NULL,
  "band"       TEXT         NOT NULL,
  "topReasons" TEXT[]       NOT NULL DEFAULT '{}',
  "trend"      TEXT         NOT NULL,
  "prevScore"  INT,
  "tenantId"   TEXT         NOT NULL
);
CREATE UNIQUE INDEX "RiskScore_studentId_date_key" ON "RiskScore" ("studentId", "date");
CREATE INDEX "RiskScore_band_date_idx"      ON "RiskScore" ("band", "date");
CREATE INDEX "RiskScore_tenantId_date_idx"  ON "RiskScore" ("tenantId", "date");

-- DailyBriefing: AI-generated morning briefing per user
CREATE TABLE "DailyBriefing" (
  "id"            TEXT         NOT NULL PRIMARY KEY,
  "tenantId"      TEXT         NOT NULL,
  "forUserId"     TEXT         NOT NULL,
  "date"          DATE         NOT NULL,
  "rawData"       JSONB        NOT NULL,
  "generatedText" TEXT         NOT NULL,
  "delivered"     BOOLEAN      NOT NULL DEFAULT FALSE,
  "deliveredAt"   TIMESTAMPTZ,
  "readAt"        TIMESTAMPTZ
);
CREATE UNIQUE INDEX "DailyBriefing_tenantId_forUserId_date_key"
  ON "DailyBriefing" ("tenantId", "forUserId", "date");

-- ParentMessage: weekly parent communication messages
CREATE TABLE "ParentMessage" (
  "id"          TEXT         NOT NULL PRIMARY KEY,
  "studentId"   TEXT         NOT NULL,
  "parentTgId"  TEXT         NOT NULL,
  "messageType" TEXT         NOT NULL,
  "content"     TEXT         NOT NULL,
  "generatedAt" TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "sentAt"      TIMESTAMPTZ,
  "readAt"      TIMESTAMPTZ,
  "replied"     BOOLEAN      NOT NULL DEFAULT FALSE,
  "tenantId"    TEXT         NOT NULL
);
CREATE INDEX "ParentMessage_studentId_sentAt_idx"  ON "ParentMessage" ("studentId", "sentAt");
CREATE INDEX "ParentMessage_messageType_sentAt_idx" ON "ParentMessage" ("messageType", "sentAt");

-- AiInsightQuery: log of AI insights queries
CREATE TABLE "AiInsightQuery" (
  "id"         TEXT         NOT NULL PRIMARY KEY,
  "userId"     TEXT         NOT NULL,
  "question"   TEXT         NOT NULL,
  "scope"      TEXT,
  "answer"     TEXT         NOT NULL,
  "dataRefs"   JSONB        NOT NULL DEFAULT '[]',
  "charts"     JSONB,
  "durationMs" INT          NOT NULL,
  "tokensUsed" INT,
  "cost"       DOUBLE PRECISION,
  "rating"     INT,
  "feedback"   TEXT,
  "createdAt"  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "tenantId"   TEXT         NOT NULL
);
CREATE INDEX "AiInsightQuery_userId_createdAt_idx"  ON "AiInsightQuery" ("userId", "createdAt");

-- AiUsageLog: cost/latency tracking for all AI calls
CREATE TABLE "AiUsageLog" (
  "id"               TEXT         NOT NULL PRIMARY KEY,
  "service"          TEXT         NOT NULL,
  "model"            TEXT         NOT NULL,
  "promptTokens"     INT          NOT NULL,
  "completionTokens" INT          NOT NULL,
  "cost"             DOUBLE PRECISION NOT NULL,
  "latencyMs"        INT          NOT NULL,
  "success"          BOOLEAN      NOT NULL,
  "errorMessage"     TEXT,
  "userId"           TEXT,
  "tenantId"         TEXT,
  "createdAt"        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX "AiUsageLog_service_createdAt_idx" ON "AiUsageLog" ("service", "createdAt");
CREATE INDEX "AiUsageLog_tenantId_createdAt_idx" ON "AiUsageLog" ("tenantId", "createdAt");
