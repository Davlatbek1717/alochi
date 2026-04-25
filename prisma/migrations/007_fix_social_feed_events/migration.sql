-- Drop existing index
DROP INDEX "social_feed_events_actor_id_created_at_idx";

-- Drop existing foreign key
ALTER TABLE "social_feed_events" DROP CONSTRAINT "social_feed_events_actor_id_fkey";

-- Add foreign key with ON DELETE CASCADE
ALTER TABLE "social_feed_events" ADD CONSTRAINT "social_feed_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create new index with DESC sort on createdAt
CREATE INDEX "social_feed_events_actor_id_created_at_idx" ON "social_feed_events"("actor_id", "created_at" DESC);
