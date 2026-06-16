-- Preserve imported posts when Instagram no longer returns their media.
ALTER TYPE "PostStatus" ADD VALUE 'REMOVED';

ALTER TABLE "content_posts"
  ADD COLUMN "ig_removed_at" TIMESTAMP(3),
  ADD COLUMN "ig_removed_reason" TEXT;

CREATE INDEX "content_posts_ig_removed_at_idx" ON "content_posts"("ig_removed_at");
