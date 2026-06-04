-- CreateEnum
CREATE TYPE "AiBatchStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- AlterTable
ALTER TABLE "instagram_stories"
  ADD COLUMN "impressions" INTEGER,
  ADD COLUMN "reach" INTEGER,
  ADD COLUMN "exits" INTEGER,
  ADD COLUMN "replies" INTEGER,
  ADD COLUMN "taps_forward" INTEGER,
  ADD COLUMN "taps_back" INTEGER,
  ADD COLUMN "profile_visits" INTEGER,
  ADD COLUMN "follows" INTEGER,
  ADD COLUMN "insights_fetched_at" TIMESTAMP(3),
  ADD COLUMN "insights_error" TEXT;

-- CreateTable
CREATE TABLE "ai_batch_reports" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "range" TEXT NOT NULL,
    "status" "AiBatchStatus" NOT NULL DEFAULT 'PENDING',
    "total_posts" INTEGER NOT NULL,
    "completed_posts" INTEGER NOT NULL DEFAULT 0,
    "failed_posts" INTEGER NOT NULL DEFAULT 0,
    "summary" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "ai_batch_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_knowledge" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "fact" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.8,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_knowledge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_procedures" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "strategy" TEXT NOT NULL,
    "outcome" TEXT,
    "engagement_delta" DOUBLE PRECISION,
    "saves_delta" DOUBLE PRECISION,
    "applied_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "ai_procedures_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_batch_reports_account_id_idx" ON "ai_batch_reports"("account_id");

-- CreateIndex
CREATE INDEX "ai_batch_reports_user_id_idx" ON "ai_batch_reports"("user_id");

-- CreateIndex
CREATE INDEX "ai_knowledge_account_id_idx" ON "ai_knowledge"("account_id");

-- CreateIndex
CREATE INDEX "ai_procedures_account_id_idx" ON "ai_procedures"("account_id");

-- AddForeignKey
ALTER TABLE "ai_batch_reports" ADD CONSTRAINT "ai_batch_reports_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "instagram_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_batch_reports" ADD CONSTRAINT "ai_batch_reports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_knowledge" ADD CONSTRAINT "ai_knowledge_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "instagram_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_procedures" ADD CONSTRAINT "ai_procedures_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "instagram_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
