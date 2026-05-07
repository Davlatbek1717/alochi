-- Drop three features removed end-to-end: adaptive difficulty, churn
-- prediction monitor, and chat keyword moderation. Idempotent so it
-- works on dev DBs that may have already lost some of these tables.
DROP TABLE IF EXISTS "adaptive_difficulty_logs";
DROP TABLE IF EXISTS "adaptive_difficulty_configs";
DROP TABLE IF EXISTS "churn_scores";
DROP TABLE IF EXISTS "chat_keywords";
