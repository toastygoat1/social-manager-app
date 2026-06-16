-- AlterTable
ALTER TABLE "workspace_tasks" ADD COLUMN "start_date" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "workspace_tasks_start_date_idx" ON "workspace_tasks"("start_date");
