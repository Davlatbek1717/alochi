-- CreateTable
CREATE TABLE "social_feed_events" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "tenant_id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "event_type" TEXT NOT NULL,
    "meta" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "social_feed_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "social_feed_events_actor_id_created_at_idx" ON "social_feed_events"("actor_id", "created_at");

-- AddForeignKey
ALTER TABLE "social_feed_events" ADD CONSTRAINT "social_feed_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
