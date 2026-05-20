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
