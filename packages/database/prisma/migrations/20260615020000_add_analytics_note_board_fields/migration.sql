ALTER TABLE "analytics_notes"
  ADD COLUMN "board_x" INTEGER NOT NULL DEFAULT 32,
  ADD COLUMN "board_y" INTEGER NOT NULL DEFAULT 32,
  ADD COLUMN "board_width" INTEGER NOT NULL DEFAULT 240,
  ADD COLUMN "board_height" INTEGER NOT NULL DEFAULT 220,
  ADD COLUMN "color" TEXT NOT NULL DEFAULT 'yellow',
  ADD COLUMN "z_index" INTEGER NOT NULL DEFAULT 1;

WITH ordered_notes AS (
  SELECT
    "id",
    (row_number() OVER (
      PARTITION BY "user_id"
      ORDER BY "updated_at" DESC, "created_at" DESC, "id"
    ) - 1)::integer AS position
  FROM "analytics_notes"
)
UPDATE "analytics_notes"
SET
  "board_x" = 32 + ((ordered_notes.position % 4) * 268),
  "board_y" = 32 + ((ordered_notes.position / 4) * 248),
  "z_index" = ordered_notes.position + 1
FROM ordered_notes
WHERE "analytics_notes"."id" = ordered_notes."id";
