-- CreateTable
CREATE TABLE "workspace_task_accounts" (
    "task_id" TEXT NOT NULL,
    "instagram_account_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workspace_task_accounts_pkey" PRIMARY KEY ("task_id","instagram_account_id")
);

-- Backfill existing single-account task selections.
INSERT INTO "workspace_task_accounts" ("task_id", "instagram_account_id")
SELECT "id", "instagram_account_id"
FROM "workspace_tasks"
WHERE "instagram_account_id" IS NOT NULL
ON CONFLICT DO NOTHING;

-- CreateIndex
CREATE INDEX "workspace_task_accounts_instagram_account_id_idx" ON "workspace_task_accounts"("instagram_account_id");

-- AddForeignKey
ALTER TABLE "workspace_task_accounts" ADD CONSTRAINT "workspace_task_accounts_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "workspace_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_task_accounts" ADD CONSTRAINT "workspace_task_accounts_instagram_account_id_fkey" FOREIGN KEY ("instagram_account_id") REFERENCES "instagram_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- EnableRls
ALTER TABLE "workspace_task_accounts" ENABLE ROW LEVEL SECURITY;
