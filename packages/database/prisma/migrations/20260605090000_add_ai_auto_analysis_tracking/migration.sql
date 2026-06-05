ALTER TABLE "content_posts"
  ADD COLUMN "ai_analysis_queued_at" TIMESTAMP(3),
  ADD COLUMN "ai_analyzed_at" TIMESTAMP(3),
  ADD COLUMN "ai_analysis_source_fetched_at" TIMESTAMP(3);

CREATE INDEX "content_posts_ai_analysis_queued_at_idx"
  ON "content_posts"("ai_analysis_queued_at");

CREATE INDEX "content_posts_ai_analysis_source_fetched_at_idx"
  ON "content_posts"("ai_analysis_source_fetched_at");
