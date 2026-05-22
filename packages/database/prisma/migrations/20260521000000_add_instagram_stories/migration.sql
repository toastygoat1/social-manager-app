-- CreateTable
CREATE TABLE "instagram_stories" (
    "id" TEXT NOT NULL,
    "instagram_account_id" TEXT NOT NULL,
    "ig_story_id" TEXT NOT NULL,
    "media_type" TEXT,
    "media_product_type" TEXT,
    "permalink" TEXT,
    "timestamp" TIMESTAMP(3),
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "instagram_stories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "instagram_stories_ig_story_id_key" ON "instagram_stories"("ig_story_id");

-- CreateIndex
CREATE INDEX "instagram_stories_instagram_account_id_idx" ON "instagram_stories"("instagram_account_id");

-- CreateIndex
CREATE INDEX "instagram_stories_timestamp_idx" ON "instagram_stories"("timestamp");

-- CreateIndex
CREATE INDEX "instagram_stories_expires_at_idx" ON "instagram_stories"("expires_at");

-- AddForeignKey
ALTER TABLE "instagram_stories" ADD CONSTRAINT "instagram_stories_instagram_account_id_fkey" FOREIGN KEY ("instagram_account_id") REFERENCES "instagram_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
