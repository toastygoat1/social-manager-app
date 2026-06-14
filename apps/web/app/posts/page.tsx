import Link from "next/link";
import { redirect } from "next/navigation";
import { ContentRowsTable } from "@/app/_components/ContentRowsTable";
import { Sidebar } from "@/app/dashboard/_components/Sidebar";
import type { ContentRow } from "@/app/dashboard/_components/data";
import { getPostsData } from "@/lib/posts-data";
import { createClient } from "@/lib/supabase/server";
import { getUserProfile } from "@/lib/supabase/user-profile";

type PostsPageProps = {
  searchParams: Promise<{
    status?: string | string[];
  }>;
};

const POST_STATUS_TABS = [
  { id: "all", label: "All Posts" },
  { id: "published", label: "Published" },
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
  const selectedTab =
    POST_STATUS_TABS.find((tab) => tab.id === selectedStatus) ??
    POST_STATUS_TABS[0];

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
  const summaryScope =
    selectedStatus === "all" ? "all statuses" : selectedTab.label;

  return (
    <div className="app-shell-frame flex min-h-screen items-start gap-[2px] p-1 font-sans text-ink transition-colors duration-500">
      <Sidebar
        active="posts"
        accounts={data.accounts}
        profile={getUserProfile(user)}
      />
      <main className="analytics-theme app-shell-panel min-w-0 flex-1 overflow-y-auto bg-paper font-inter text-ink">
        <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-4 px-5 py-8 sm:px-7 sm:py-9">
          <header className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold leading-tight text-ink">
                Posts
              </h1>
              <p className="dashboard-section-subtitle mt-1 text-muted">
                {data.contentRows.length} total content stored across{" "}
                {data.accounts.length} connected account
                {data.accounts.length === 1 ? "" : "s"}
              </p>
            </div>
            <div className="rounded-lg border border-line bg-card px-4 py-3 text-right">
              <p className="dashboard-ui-meta text-muted">Current view</p>
              <p className="dashboard-card-title mt-0.5 text-ink">
                {filteredRows.length} posts
              </p>
            </div>
          </header>

          <nav
            aria-label="Post status"
            className="scrollbar-none flex min-w-0 overflow-x-auto border-b border-line bg-paper"
          >
            {POST_STATUS_TABS.map((tab) => {
              const isActive = tab.id === selectedStatus;

              return (
                <Link
                  key={tab.id}
                  href={getTabHref(tab.id)}
                  aria-current={isActive ? "page" : undefined}
                  className={`dashboard-ui-label relative flex h-11 shrink-0 items-center px-4 transition-colors ${
                    isActive ? "font-semibold text-ink" : "text-muted hover:text-ink"
                  }`}
                >
                  <span>{tab.label}</span>
                  {isActive ? (
                    <span
                      aria-hidden="true"
                      className="absolute inset-x-0 bottom-0 h-0.5 bg-ink"
                    />
                  ) : null}
                </Link>
              );
            })}
          </nav>

          <ContentRowsTable
            rows={filteredRows}
            metadataFields={data.metadataFields}
            title="Posts"
            summaryScope={summaryScope}
            itemLabel="posts"
            emptyLabel="No posts in this view yet"
            noSearchResultsLabel="No posts match your search"
            searchPlaceholder="Search posts, accounts, status..."
          />
        </div>
      </main>
    </div>
  );
}
