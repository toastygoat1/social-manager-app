-- Manual migration: add GoogleIntegration model
-- Run this in Supabase SQL Editor (https://supabase.com/dashboard/project/<ref>/sql/new)
-- or via psql when Prisma CLI cannot reach the DB from your machine.

CREATE TABLE IF NOT EXISTS "google_integrations" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "refresh_token_encrypted" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "connected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "google_integrations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "google_integrations_user_id_key"
    ON "google_integrations"("user_id");

ALTER TABLE "google_integrations"
    ADD CONSTRAINT "google_integrations_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "google_integrations" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "google_integrations" FROM anon;
REVOKE ALL ON TABLE "google_integrations" FROM authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "google_integrations" TO authenticated;

CREATE POLICY "Users can read their own Google integration"
    ON "google_integrations"
    FOR SELECT
    TO authenticated
    USING ((select auth.uid())::text = "user_id");

CREATE POLICY "Users can insert their own Google integration"
    ON "google_integrations"
    FOR INSERT
    TO authenticated
    WITH CHECK ((select auth.uid())::text = "user_id");

CREATE POLICY "Users can update their own Google integration"
    ON "google_integrations"
    FOR UPDATE
    TO authenticated
    USING ((select auth.uid())::text = "user_id")
    WITH CHECK ((select auth.uid())::text = "user_id");

CREATE POLICY "Users can delete their own Google integration"
    ON "google_integrations"
    FOR DELETE
    TO authenticated
    USING ((select auth.uid())::text = "user_id");
