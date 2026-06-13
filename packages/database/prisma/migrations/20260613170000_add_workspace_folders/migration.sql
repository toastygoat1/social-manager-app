-- CreateTable
CREATE TABLE "workspace_board_states" (
    "user_id" TEXT NOT NULL,
    "initialized_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workspace_board_states_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "workspace_folders" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_folders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_tasks" (
    "id" TEXT NOT NULL,
    "folder_id" TEXT NOT NULL,
    "instagram_account_id" TEXT,
    "task_name" TEXT NOT NULL,
    "assignee" TEXT NOT NULL,
    "urgency" TEXT NOT NULL DEFAULT 'Medium',
    "status" TEXT NOT NULL DEFAULT 'Not started',
    "deadline" TIMESTAMP(3) NOT NULL,
    "brief_execution" TEXT NOT NULL,
    "notes" TEXT NOT NULL,
    "input_from" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "workspace_folders_user_id_sort_order_idx" ON "workspace_folders"("user_id", "sort_order");

-- CreateIndex
CREATE INDEX "workspace_tasks_folder_id_sort_order_idx" ON "workspace_tasks"("folder_id", "sort_order");

-- CreateIndex
CREATE INDEX "workspace_tasks_instagram_account_id_idx" ON "workspace_tasks"("instagram_account_id");

-- CreateIndex
CREATE INDEX "workspace_tasks_deadline_idx" ON "workspace_tasks"("deadline");

-- AddForeignKey
ALTER TABLE "workspace_board_states" ADD CONSTRAINT "workspace_board_states_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_folders" ADD CONSTRAINT "workspace_folders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_tasks" ADD CONSTRAINT "workspace_tasks_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "workspace_folders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_tasks" ADD CONSTRAINT "workspace_tasks_instagram_account_id_fkey" FOREIGN KEY ("instagram_account_id") REFERENCES "instagram_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Supabase public-schema defense in depth. The app accesses these tables via
-- the authenticated Nest API using the server database connection.
ALTER TABLE "workspace_board_states" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "workspace_folders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "workspace_tasks" ENABLE ROW LEVEL SECURITY;
