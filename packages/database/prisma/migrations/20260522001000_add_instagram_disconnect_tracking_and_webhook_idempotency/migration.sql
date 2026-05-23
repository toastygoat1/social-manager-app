ALTER TABLE "instagram_accounts"
  ADD COLUMN IF NOT EXISTS "disconnected_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "instagram_accounts_disconnected_at_idx"
  ON "instagram_accounts"("disconnected_at");

CREATE UNIQUE INDEX IF NOT EXISTS "webhook_events_source_external_event_id_key"
  ON "webhook_events"("source", "external_event_id")
  WHERE "external_event_id" IS NOT NULL;
