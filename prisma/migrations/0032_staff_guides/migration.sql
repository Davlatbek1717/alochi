-- Phase 20.6: Staff video guides
CREATE TABLE "staff_video_guides" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "tenant_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "video_url" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "staff_video_guides_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "staff_video_guides_tenant_id_role_idx" ON "staff_video_guides"("tenant_id", "role");

ALTER TABLE "staff_video_guides" ADD CONSTRAINT "staff_video_guides_created_by_fkey"
    FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
