import { redirect } from "next/navigation";
import { Sidebar } from "@/app/dashboard/_components/Sidebar";
import type { ContentRow } from "@/app/dashboard/_components/data";
import { getPostsData } from "@/lib/posts-data";
import { createClient } from "@/lib/supabase/server";
import { getUserProfile } from "@/lib/supabase/user-profile";
import { PostsTable } from "./_components/PostsTable";

type PostsPageProps = {
  searchParams: Promise<{
    status?: string | string[];
  }>;
};

const POST_STATUS_TABS = [
  { id: "all", label: "All Posts" },
  { id: "published", label: "Published" },
  { id: "removed", label: "Removed" },
  { id: "ready", label: "Ready" },
  { id: "pending", label: "Pendings" },
  { id: "draft", label: "Draft" },
] as const;

type PostStatusFilter = (typeof POST_STATUS_TABS)[number]["id"];

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function resolveStatusFilter(value: string | undefined): PostStatusFilter {
  const normalized = value?.toLowerCase();

  return POST_STATUS_TABS.some((tab) => tab.id === normalized)
    ? (normalized as PostStatusFilter)
    : "all";
}

function classifyStatus(status: string): Exclude<PostStatusFilter, "all"> {
  const normalized = status.toLowerCase();

  if (normalized.includes("removed")) return "removed";
  if (normalized.includes("publish")) return "published";
  if (
    normalized.includes("ready") ||
    normalized.includes("scheduled") ||
    normalized.includes("approved")
  ) {
    return "ready";
  }
  if (normalized.includes("pending") || normalized.includes("review")) {
    return "pending";
  }

  return "draft";
}

function filterRows(rows: ContentRow[], statusFilter: PostStatusFilter) {
  if (statusFilter === "all") return rows;
  return rows.filter((row) => classifyStatus(row.status) === statusFilter);
}

function getTabHref(statusFilter: PostStatusFilter) {
  if (statusFilter === "all") return "/posts";

  const params = new URLSearchParams({ status: statusFilter });
  return `/posts?${params.toString()}`;
}

export default async function PostsPage({ searchParams }: PostsPageProps) {
  const params = await searchParams;
  const selectedStatus = resolveStatusFilter(firstParam(params.status));

  const hasSupabaseEnv = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );

  if (!hasSupabaseEnv) {
    redirect("/?message=" + encodeURIComponent("no env variable"));
  }

  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/");
  }

  const data = await getPostsData();
  const filteredRows = filterRows(data.contentRows, selectedStatus);

  return (
    <div
      data-fit="screen"
      className="app-shell-frame flex h-screen items-start gap-[2px] overflow-hidden p-1 font-sans text-ink transition-colors duration-500"
    >
      <Sidebar
        active="posts"
        accounts={data.accounts}
        profile={getUserProfile(user)}
      />
      <main
        className="analytics-theme app-shell-panel flex min-w-0 flex-1 flex-col overflow-hidden font-inter text-ink"
        style={{ backgroundColor: "#fff" }}
      >
        <div className="app-shell-fill flex min-h-0 w-full flex-col">
          <PostsTable
            rows={filteredRows}
            metadataFields={data.metadataFields}
            statusTabs={POST_STATUS_TABS.map((tab) => ({
              id: tab.id,
              label: tab.label,
              href: getTabHref(tab.id),
              isActive: tab.id === selectedStatus,
            }))}
          />
        </div>
      </main>
    </div>
  );
}
