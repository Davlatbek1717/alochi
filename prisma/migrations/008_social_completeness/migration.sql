-- AlterTable: add birth_date to users
ALTER TABLE "users" ADD COLUMN "birth_date" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "chat_keywords" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "tenant_id" UUID NOT NULL,
    "word" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_keywords_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "chat_keywords_tenant_id_word_key" ON "chat_keywords"("tenant_id", "word");
