CREATE TABLE "tournaments" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "tenant_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT '1v1',
    "status" TEXT NOT NULL DEFAULT 'upcoming',
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tournaments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tournament_registrations" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "tournament_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "registered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tournament_registrations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tournament_registrations_tournament_id_student_id_key"
  ON "tournament_registrations"("tournament_id", "student_id");
CREATE INDEX "tournaments_tenant_id_status_idx" ON "tournaments"("tenant_id", "status");

ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tournament_registrations" ADD CONSTRAINT "tournament_registrations_tournament_id_fkey"
  FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tournament_registrations" ADD CONSTRAINT "tournament_registrations_student_id_fkey"
  FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
