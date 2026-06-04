ALTER TABLE "content_posts"
  ADD COLUMN "comments_synced_at" TIMESTAMP(3);

CREATE TABLE "post_comments" (
  "id" TEXT NOT NULL,
  "content_post_id" TEXT NOT NULL,
  "ig_comment_id" TEXT NOT NULL,
  "parent_ig_comment_id" TEXT,
  "username" TEXT,
  "text" TEXT,
  "like_count" INTEGER,
  "hidden" BOOLEAN,
  "timestamp" TIMESTAMP(3),
  "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "post_comments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "post_comments_content_post_id_ig_comment_id_key"
  ON "post_comments"("content_post_id", "ig_comment_id");

CREATE INDEX "post_comments_content_post_id_timestamp_idx"
  ON "post_comments"("content_post_id", "timestamp");

CREATE INDEX "post_comments_parent_ig_comment_id_idx"
  ON "post_comments"("parent_ig_comment_id");

ALTER TABLE "post_comments"
  ADD CONSTRAINT "post_comments_content_post_id_fkey"
  FOREIGN KEY ("content_post_id") REFERENCES "content_posts"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
