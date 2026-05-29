CREATE TABLE "content_metadata_fields" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "content_metadata_fields_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "content_post_metadata_values" (
  "id" TEXT NOT NULL,
  "content_post_id" TEXT NOT NULL,
  "field_id" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "content_post_metadata_values_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "content_metadata_fields_user_id_label_key"
ON "content_metadata_fields"("user_id", "label");

CREATE INDEX "content_metadata_fields_user_id_sort_order_idx"
ON "content_metadata_fields"("user_id", "sort_order");

CREATE UNIQUE INDEX "content_post_metadata_values_content_post_id_field_id_key"
ON "content_post_metadata_values"("content_post_id", "field_id");

CREATE INDEX "content_post_metadata_values_field_id_idx"
ON "content_post_metadata_values"("field_id");

ALTER TABLE "content_metadata_fields"
ADD CONSTRAINT "content_metadata_fields_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "content_post_metadata_values"
ADD CONSTRAINT "content_post_metadata_values_content_post_id_fkey"
FOREIGN KEY ("content_post_id") REFERENCES "content_posts"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "content_post_metadata_values"
ADD CONSTRAINT "content_post_metadata_values_field_id_fkey"
FOREIGN KEY ("field_id") REFERENCES "content_metadata_fields"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
