CREATE TABLE "analytics_notes" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "instagram_account_id" TEXT,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "analytics_notes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "analytics_notes_user_id_updated_at_idx" ON "analytics_notes"("user_id", "updated_at");
CREATE INDEX "analytics_notes_instagram_account_id_idx" ON "analytics_notes"("instagram_account_id");

ALTER TABLE "analytics_notes" ADD CONSTRAINT "analytics_notes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "analytics_notes" ADD CONSTRAINT "analytics_notes_instagram_account_id_fkey" FOREIGN KEY ("instagram_account_id") REFERENCES "instagram_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
