ALTER TABLE "analytics_notes"
  DROP COLUMN IF EXISTS "board_x",
  DROP COLUMN IF EXISTS "board_y",
  DROP COLUMN IF EXISTS "board_width",
  DROP COLUMN IF EXISTS "board_height",
  DROP COLUMN IF EXISTS "z_index";

ALTER TABLE "analytics_notes"
  ALTER COLUMN "color" SET DEFAULT 'cream';
