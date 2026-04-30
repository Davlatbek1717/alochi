-- Phase 19: Social Completeness

-- Branch.chatLocked
ALTER TABLE "branches" ADD COLUMN "chat_locked" BOOLEAN NOT NULL DEFAULT false;

-- DuelAnswer.answerMs
ALTER TABLE "duel_answers" ADD COLUMN "answer_ms" INTEGER;

-- FeedEventReaction
CREATE TABLE "feed_event_reactions" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "event_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "emoji" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "feed_event_reactions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "feed_event_reactions_event_id_user_id_key" ON "feed_event_reactions"("event_id", "user_id");
CREATE INDEX "feed_event_reactions_event_id_idx" ON "feed_event_reactions"("event_id");

ALTER TABLE "feed_event_reactions" ADD CONSTRAINT "feed_event_reactions_event_id_fkey"
    FOREIGN KEY ("event_id") REFERENCES "social_feed_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
