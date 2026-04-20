-- CreateEnum
CREATE TYPE "InstagramAccountType" AS ENUM ('PERSONAL', 'BUSINESS', 'CREATOR');

-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('IMAGE', 'VIDEO');

-- CreateEnum
CREATE TYPE "PostType" AS ENUM ('FEED', 'REEL', 'STORY', 'CAROUSEL');

-- CreateEnum
CREATE TYPE "PostStatus" AS ENUM ('DRAFT', 'PENDING', 'READY', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "PublishTrigger" AS ENUM ('MANUAL', 'SCHEDULED', 'RETRY');

-- CreateEnum
CREATE TYPE "PublishAttemptStatus" AS ENUM ('STARTED', 'SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "WebhookSource" AS ENUM ('INSTAGRAM', 'FACEBOOK');

-- CreateEnum
CREATE TYPE "WebhookProcessingStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'FAILED');

-- CreateEnum
CREATE TYPE "DmSenderType" AS ENUM ('USER', 'PARTICIPANT');

-- CreateEnum
CREATE TYPE "ChatbotMessageRole" AS ENUM ('USER', 'ASSISTANT');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "full_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "instagram_accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "ig_user_id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "account_type" "InstagramAccountType" NOT NULL,
    "access_token_encrypted" TEXT NOT NULL,
    "page_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "token_expires_at" TIMESTAMP(3),
    "connected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "instagram_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_assets" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "storage_path" TEXT NOT NULL,
    "file_type" "MediaType" NOT NULL,
    "mime_type" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "duration_seconds" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_posts" (
    "id" TEXT NOT NULL,
    "instagram_account_id" TEXT NOT NULL,
    "title" TEXT,
    "caption" TEXT,
    "post_type" "PostType" NOT NULL,
    "status" "PostStatus" NOT NULL DEFAULT 'DRAFT',
    "scheduled_for" TIMESTAMP(3),
    "published_at" TIMESTAMP(3),
    "ig_media_id" TEXT,
    "ig_media_container_id" TEXT,
    "ig_permalink" TEXT,
    "is_ai_generated" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_media" (
    "id" TEXT NOT NULL,
    "content_post_id" TEXT NOT NULL,
    "media_asset_id" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "post_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "publish_attempts" (
    "id" TEXT NOT NULL,
    "content_post_id" TEXT NOT NULL,
    "trigger" "PublishTrigger" NOT NULL,
    "status" "PublishAttemptStatus" NOT NULL DEFAULT 'STARTED',
    "attempt_number" INTEGER NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),
    "error_code" TEXT,
    "error_message" TEXT,
    "response_json" JSONB,
    "job_reference" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "publish_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_events" (
    "id" TEXT NOT NULL,
    "instagram_account_id" TEXT,
    "source" "WebhookSource" NOT NULL,
    "event_type" TEXT NOT NULL,
    "external_event_id" TEXT,
    "payload" JSONB NOT NULL,
    "processing_status" "WebhookProcessingStatus" NOT NULL DEFAULT 'RECEIVED',
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),
    "error_message" TEXT,

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dm_conversations" (
    "id" TEXT NOT NULL,
    "instagram_account_id" TEXT NOT NULL,
    "ig_conversation_id" TEXT NOT NULL,
    "participant_ig_id" TEXT NOT NULL,
    "participant_username" TEXT,
    "last_message_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dm_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dm_messages" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "ig_message_id" TEXT NOT NULL,
    "sender_type" "DmSenderType" NOT NULL,
    "message_text" TEXT,
    "sent_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dm_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_snapshots" (
    "id" TEXT NOT NULL,
    "instagram_account_id" TEXT NOT NULL,
    "snapshot_date" DATE NOT NULL,
    "followers_count" INTEGER NOT NULL,
    "following_count" INTEGER NOT NULL,
    "media_count" INTEGER NOT NULL,
    "reach" INTEGER,
    "impressions" INTEGER,
    "profile_views" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_analytics" (
    "id" TEXT NOT NULL,
    "content_post_id" TEXT NOT NULL,
    "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "like_count" INTEGER,
    "comments_count" INTEGER,
    "shares_count" INTEGER,
    "saves_count" INTEGER,
    "reach" INTEGER,
    "impressions" INTEGER,
    "engagement" INTEGER,

    CONSTRAINT "post_analytics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_settings" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "preferred_tone" TEXT,
    "preferred_language" TEXT NOT NULL DEFAULT 'en',
    "custom_instructions" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chatbot_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "instagram_account_id" TEXT,
    "title" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_active_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chatbot_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chatbot_messages" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "role" "ChatbotMessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "tokens_used" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chatbot_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "instagram_accounts_ig_user_id_key" ON "instagram_accounts"("ig_user_id");

-- CreateIndex
CREATE INDEX "instagram_accounts_user_id_idx" ON "instagram_accounts"("user_id");

-- CreateIndex
CREATE INDEX "instagram_accounts_is_active_idx" ON "instagram_accounts"("is_active");

-- CreateIndex
CREATE INDEX "media_assets_user_id_idx" ON "media_assets"("user_id");

-- CreateIndex
CREATE INDEX "content_posts_instagram_account_id_idx" ON "content_posts"("instagram_account_id");

-- CreateIndex
CREATE INDEX "content_posts_status_idx" ON "content_posts"("status");

-- CreateIndex
CREATE INDEX "content_posts_scheduled_for_idx" ON "content_posts"("scheduled_for");

-- CreateIndex
CREATE INDEX "content_posts_instagram_account_id_status_scheduled_for_idx" ON "content_posts"("instagram_account_id", "status", "scheduled_for");

-- CreateIndex
CREATE INDEX "post_media_media_asset_id_idx" ON "post_media"("media_asset_id");

-- CreateIndex
CREATE UNIQUE INDEX "post_media_content_post_id_sort_order_key" ON "post_media"("content_post_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "post_media_content_post_id_media_asset_id_key" ON "post_media"("content_post_id", "media_asset_id");

-- CreateIndex
CREATE INDEX "publish_attempts_content_post_id_idx" ON "publish_attempts"("content_post_id");

-- CreateIndex
CREATE INDEX "publish_attempts_status_idx" ON "publish_attempts"("status");

-- CreateIndex
CREATE INDEX "publish_attempts_started_at_idx" ON "publish_attempts"("started_at");

-- CreateIndex
CREATE UNIQUE INDEX "publish_attempts_content_post_id_attempt_number_key" ON "publish_attempts"("content_post_id", "attempt_number");

-- CreateIndex
CREATE INDEX "webhook_events_instagram_account_id_idx" ON "webhook_events"("instagram_account_id");

-- CreateIndex
CREATE INDEX "webhook_events_source_event_type_idx" ON "webhook_events"("source", "event_type");

-- CreateIndex
CREATE INDEX "webhook_events_processing_status_idx" ON "webhook_events"("processing_status");

-- CreateIndex
CREATE INDEX "webhook_events_received_at_idx" ON "webhook_events"("received_at");

-- CreateIndex
CREATE UNIQUE INDEX "dm_conversations_ig_conversation_id_key" ON "dm_conversations"("ig_conversation_id");

-- CreateIndex
CREATE INDEX "dm_conversations_instagram_account_id_idx" ON "dm_conversations"("instagram_account_id");

-- CreateIndex
CREATE INDEX "dm_conversations_last_message_at_idx" ON "dm_conversations"("last_message_at");

-- CreateIndex
CREATE UNIQUE INDEX "dm_messages_ig_message_id_key" ON "dm_messages"("ig_message_id");

-- CreateIndex
CREATE INDEX "dm_messages_conversation_id_idx" ON "dm_messages"("conversation_id");

-- CreateIndex
CREATE INDEX "dm_messages_sent_at_idx" ON "dm_messages"("sent_at");

-- CreateIndex
CREATE INDEX "analytics_snapshots_snapshot_date_idx" ON "analytics_snapshots"("snapshot_date");

-- CreateIndex
CREATE UNIQUE INDEX "analytics_snapshots_instagram_account_id_snapshot_date_key" ON "analytics_snapshots"("instagram_account_id", "snapshot_date");

-- CreateIndex
CREATE INDEX "post_analytics_content_post_id_idx" ON "post_analytics"("content_post_id");

-- CreateIndex
CREATE INDEX "post_analytics_fetched_at_idx" ON "post_analytics"("fetched_at");

-- CreateIndex
CREATE UNIQUE INDEX "post_analytics_content_post_id_fetched_at_key" ON "post_analytics"("content_post_id", "fetched_at");

-- CreateIndex
CREATE UNIQUE INDEX "ai_settings_user_id_key" ON "ai_settings"("user_id");

-- CreateIndex
CREATE INDEX "chatbot_sessions_user_id_idx" ON "chatbot_sessions"("user_id");

-- CreateIndex
CREATE INDEX "chatbot_sessions_instagram_account_id_idx" ON "chatbot_sessions"("instagram_account_id");

-- CreateIndex
CREATE INDEX "chatbot_sessions_last_active_at_idx" ON "chatbot_sessions"("last_active_at");

-- CreateIndex
CREATE INDEX "chatbot_messages_session_id_idx" ON "chatbot_messages"("session_id");

-- CreateIndex
CREATE INDEX "chatbot_messages_created_at_idx" ON "chatbot_messages"("created_at");

-- AddForeignKey
ALTER TABLE "instagram_accounts" ADD CONSTRAINT "instagram_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_posts" ADD CONSTRAINT "content_posts_instagram_account_id_fkey" FOREIGN KEY ("instagram_account_id") REFERENCES "instagram_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_media" ADD CONSTRAINT "post_media_content_post_id_fkey" FOREIGN KEY ("content_post_id") REFERENCES "content_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_media" ADD CONSTRAINT "post_media_media_asset_id_fkey" FOREIGN KEY ("media_asset_id") REFERENCES "media_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publish_attempts" ADD CONSTRAINT "publish_attempts_content_post_id_fkey" FOREIGN KEY ("content_post_id") REFERENCES "content_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_events" ADD CONSTRAINT "webhook_events_instagram_account_id_fkey" FOREIGN KEY ("instagram_account_id") REFERENCES "instagram_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dm_conversations" ADD CONSTRAINT "dm_conversations_instagram_account_id_fkey" FOREIGN KEY ("instagram_account_id") REFERENCES "instagram_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dm_messages" ADD CONSTRAINT "dm_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "dm_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_snapshots" ADD CONSTRAINT "analytics_snapshots_instagram_account_id_fkey" FOREIGN KEY ("instagram_account_id") REFERENCES "instagram_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_analytics" ADD CONSTRAINT "post_analytics_content_post_id_fkey" FOREIGN KEY ("content_post_id") REFERENCES "content_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_settings" ADD CONSTRAINT "ai_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chatbot_sessions" ADD CONSTRAINT "chatbot_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chatbot_sessions" ADD CONSTRAINT "chatbot_sessions_instagram_account_id_fkey" FOREIGN KEY ("instagram_account_id") REFERENCES "instagram_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chatbot_messages" ADD CONSTRAINT "chatbot_messages_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "chatbot_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
