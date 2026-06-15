-- CreateTable
CREATE TABLE "user_auth_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "browser" TEXT,
    "operating_system" TEXT,
    "ip_address_hash" TEXT,
    "ip_address_masked" TEXT,
    "user_agent" TEXT,
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),
    "signed_out_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_auth_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_auth_sessions_user_id_session_id_key" ON "user_auth_sessions"("user_id", "session_id");

-- CreateIndex
CREATE INDEX "user_auth_sessions_user_id_last_seen_at_idx" ON "user_auth_sessions"("user_id", "last_seen_at");

-- CreateIndex
CREATE INDEX "user_auth_sessions_user_id_signed_out_at_idx" ON "user_auth_sessions"("user_id", "signed_out_at");

-- AddForeignKey
ALTER TABLE "user_auth_sessions" ADD CONSTRAINT "user_auth_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
