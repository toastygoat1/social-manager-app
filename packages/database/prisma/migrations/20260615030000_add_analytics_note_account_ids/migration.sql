ALTER TABLE "analytics_notes"
  ADD COLUMN "account_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

UPDATE "analytics_notes"
SET "account_ids" = ARRAY["instagram_account_id"]
WHERE "instagram_account_id" IS NOT NULL;

CREATE INDEX "analytics_notes_account_ids_idx"
  ON "analytics_notes" USING GIN ("account_ids");
