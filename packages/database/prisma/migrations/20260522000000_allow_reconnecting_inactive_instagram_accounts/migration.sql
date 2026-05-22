DROP INDEX IF EXISTS "instagram_accounts_ig_user_id_key";

CREATE UNIQUE INDEX "instagram_accounts_active_ig_user_id_key"
  ON "instagram_accounts"("ig_user_id")
  WHERE "is_active" = true;
