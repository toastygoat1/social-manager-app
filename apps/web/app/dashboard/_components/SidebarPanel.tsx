"use client";

import type { ComponentType, MouseEvent, SVGProps } from "react";
import { useEffect, useState, useSyncExternalStore } from "react";
import {
  BarChart3,
  CalendarDays,
  ChevronDown,
  Columns2,
  FileText,
  Home,
  Inbox,
  LoaderCircle,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  Sparkles,
  Sun,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AvatarImage } from "@/app/_components/AvatarImage";
import {
  APP_THEME_COOKIE,
  APP_THEME_EVENT,
  APP_THEME_MAX_AGE,
  type ThemeMode,
} from "@/app/theme-preferences";
import { ApiError, apiFetchBrowser } from "@/lib/api/browser-client";
import type { UserProfile } from "@/lib/supabase/user-profile";
import type { Account } from "./data";
import {
  SIDEBAR_COLLAPSED_COOKIE,
  SIDEBAR_COLLAPSED_EVENT,
  SIDEBAR_COLLAPSED_MAX_AGE,
} from "./sidebar-preferences";

type LucideIcon = ComponentType<
  SVGProps<SVGSVGElement> & { strokeWidth?: number }
>;

export type SidebarKey =
  | "dashboard"
  | "posts"
  | "workspace"
  | "scheduling"
  | "analytics"
  | "chat"
  | "snow-ai"
  | "account";

type SidebarNavKey = Exclude<SidebarKey, "account">;

type NavItem = {
  key: SidebarNavKey;
  label: string;
  Icon: LucideIcon;
  href: string;
  badge?: string;
};

type BackfillResponse = {
  scanned: number;
  imported: number;
  updated: number;
  analyticsCreated: number;
  failed: number;
};

type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => void) => {
    finished: Promise<void>;
  };
};

type SidebarPanelProps = {
  active: SidebarKey;
  accounts: Account[];
  initialCollapsed?: boolean;
  initialTheme?: ThemeMode;
  profile?: UserProfile | null;
};

const NAV_ITEMS: NavItem[] = [
  { key: "dashboard", label: "Dashboard", Icon: Home, href: "/dashboard" },
  { key: "posts", label: "Posts", Icon: FileText, href: "/posts" },
  { key: "workspace", label: "Workspace", Icon: Columns2, href: "/workspace" },
  {
    key: "scheduling",
    label: "Scheduler",
    Icon: CalendarDays,
    href: "/scheduler",
  },
  { key: "analytics", label: "Insights", Icon: BarChart3, href: "/analytics" },
  { key: "chat", label: "Inbox", Icon: Inbox, href: "/chat" },
  { key: "snow-ai", label: "Snow AI", Icon: Sparkles, href: "/chat-ai" },
];

const VISIBLE_ACCOUNT_COUNT = 8;
const AVATAR_COLORS = [
  "#e8855b",
  "#7b6cd9",
  "#4f8f6f",
  "#d4a04b",
  "#b57ba6",
  "#4f6f8f",
  "#3daeb8",
  "#c96442",
];

const ACCOUNT_TONE_COLORS: Record<string, string> = {
  blue: "#4f6f8f",
  cyan: "#3daeb8",
  pink: "#b57ba6",
  yellow: "#d4a04b",
};

function SnowflakeLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="-50 -50 100 100"
      fill="none"
      role="img"
      aria-label="Snowflake logo"
      {...props}
    >
      <g fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="7">
        <g>
          <line x1="0" y1="-40" x2="0" y2="40" />
          <line x1="-10" y1="-30" x2="0" y2="-40" />
          <line x1="10" y1="-30" x2="0" y2="-40" />
          <line x1="-10" y1="30" x2="0" y2="40" />
          <line x1="10" y1="30" x2="0" y2="40" />
        </g>
        <g transform="rotate(60)">
          <line x1="0" y1="-40" x2="0" y2="40" />
          <line x1="-10" y1="-30" x2="0" y2="-40" />
          <line x1="10" y1="-30" x2="0" y2="-40" />
          <line x1="-10" y1="30" x2="0" y2="40" />
          <line x1="10" y1="30" x2="0" y2="40" />
        </g>
        <g transform="rotate(120)">
          <line x1="0" y1="-40" x2="0" y2="40" />
          <line x1="-10" y1="-30" x2="0" y2="-40" />
          <line x1="10" y1="-30" x2="0" y2="-40" />
          <line x1="-10" y1="30" x2="0" y2="40" />
          <line x1="10" y1="30" x2="0" y2="40" />
        </g>
      </g>
    </svg>
  );
}

function getInitials(label: string | null | undefined, fallback = "G") {
  const cleanLabel = label?.replace(/^@/, "").split("@")[0].trim();

  if (!cleanLabel) {
    return fallback;
  }

  const parts = cleanLabel.split(/[\s._-]+/).filter(Boolean);
  const initials =
    parts.length > 1
      ? parts
          .slice(0, 2)
          .map((part) => part.charAt(0))
          .join("")
      : cleanLabel.slice(0, 2);

  return initials.toUpperCase();
}

function getProfileName(profile?: UserProfile | null) {
  return profile?.name?.trim() || profile?.email?.split("@")[0] || "Growth";
}

function getProfileDetail(profile?: UserProfile | null) {
  return profile?.email ?? "Workspace owner";
}

function getAccountColor(account: Account, index: number) {
  return account.tone
    ? ACCOUNT_TONE_COLORS[account.tone]
    : AVATAR_COLORS[index % AVATAR_COLORS.length];
}

function getPlatformCode(platform: string) {
  const normalized = platform.toLowerCase();

  if (normalized.includes("instagram")) return "IG";
  if (normalized.includes("tiktok")) return "TT";
  if (normalized.includes("youtube")) return "YT";
  if (normalized.includes("linkedin")) return "LI";

  return platform
    .split(/\s+/)
    .map((part) => part.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function getAccountTitle(account: Account) {
  const displayName = account.displayName?.trim();

  if (displayName) {
    return displayName;
  }

  return account.name.replace(/^@/, "").trim() || account.name;
}

function getAccountHandle(account: Account) {
  const username =
    account.username?.replace(/^@/, "").trim() ||
    account.name.replace(/^@/, "").trim();

  return username.startsWith("@") ? username : `@${username}`;
}

function getApiErrorMessage(error: unknown) {
  if (!(error instanceof ApiError)) {
    return null;
  }

  const body = error.body as { message?: string | string[] } | null;
  const message = body?.message;

  return Array.isArray(message) ? message[0] : message;
}

function getBackfillErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return "Please sign in again before importing Instagram posts.";
    }

    if (error.status === 404) {
      return "This Instagram account is no longer connected.";
    }

    return (
      getApiErrorMessage(error) ??
      `Instagram posts could not be imported. API returned ${error.status}.`
    );
  }

  return "Instagram posts could not be imported. Please try again after the API finishes redeploying.";
}

function getBackfillSuccessMessage(result: BackfillResponse) {
  const parts = [
    `${result.imported} imported`,
    `${result.updated} updated`,
    `${result.analyticsCreated} analytics snapshots`,
  ];

  if (result.failed > 0) {
    parts.push(`${result.failed} failed`);
  }

  return `Backfill complete: ${parts.join(", ")}.`;
}

function getInsightsHref(accountId?: string | null) {
  if (!accountId) {
    return "/analytics";
  }

  const params = new URLSearchParams({ accountId });

  return `/analytics?${params.toString()}`;
}

function AccountAvatar({
  account,
  index,
}: {
  account: Account;
  index: number;
}) {
  const color = getAccountColor(account, index);

  return (
    <span
      className="dashboard-ui-meta flex size-[30px] shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold text-white"
      style={{
        background: `linear-gradient(135deg, ${color}, ${color}cc)`,
      }}
    >
      <AvatarImage
        src={account.avatarUrl}
        alt={account.name}
        width={30}
        height={30}
        className="size-full object-cover"
        fallback={getInitials(account.name, "I")}
      />
    </span>
  );
}

function AccountRow({
  account,
  index,
  isCollapsed = false,
}: {
  account: Account;
  index: number;
  isCollapsed?: boolean;
}) {
  const router = useRouter();
  const [isBackfilling, setIsBackfilling] = useState(false);
  const accountTitle = getAccountTitle(account);
  const accountHandle = getAccountHandle(account);

  async function backfillPosts() {
    const confirmed = window.confirm(
      `Import recent Instagram posts for ${account.name}? This will fetch up to 250 existing posts and current metrics.`,
    );
    if (!confirmed) return;

    setIsBackfilling(true);

    try {
      const result = await apiFetchBrowser<BackfillResponse>(
        `/instagram/accounts/${encodeURIComponent(account.id)}/backfill`,
        {
          method: "POST",
          body: { limit: 250 },
        },
      );
      window.alert(getBackfillSuccessMessage(result));
      router.refresh();
    } catch (error) {
      window.alert(getBackfillErrorMessage(error));
    } finally {
      setIsBackfilling(false);
    }
  }

  return (
    <li
      title={isCollapsed ? `${accountTitle} ${accountHandle}` : undefined}
      className="group flex min-h-8 w-full items-center gap-1 rounded-md px-[3px] py-0 transition-colors duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
    >
      <Link
        href={getInsightsHref(account.id)}
        aria-label={`View insights for ${account.name}`}
        className="flex min-w-0 flex-1 items-center gap-1"
      >
        <span
          className="grid size-8 shrink-0 place-items-center rounded-full"
        >
          <AccountAvatar account={account} index={index} />
        </span>
        <span
          className={`min-w-0 flex-1 overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-300 ease-out ${
            isCollapsed ? "max-w-0 opacity-0" : "max-w-[142px] opacity-100"
          }`}
        >
          <span className="dashboard-ui-label block truncate text-[var(--sidebar-text)]">
            {accountTitle}
          </span>
          <span className="dashboard-micro-text block truncate font-normal text-[var(--sidebar-dim)]">
            {accountHandle}
          </span>
        </span>
        <span
          className={`dashboard-micro-text shrink-0 overflow-hidden whitespace-nowrap font-semibold text-[var(--sidebar-dim)] transition-[max-width,opacity] duration-300 ease-out ${
            isCollapsed ? "max-w-0 opacity-0" : "max-w-[18px] opacity-100"
          }`}
        >
          {getPlatformCode(account.platform)}
        </span>
      </Link>
      <span
        className={`grid shrink-0 overflow-hidden transition-[width,opacity] duration-300 ease-out ${
          isCollapsed ? "w-0 opacity-0" : "w-6 opacity-100"
        }`}
      >
        <button
          type="button"
          onClick={backfillPosts}
          disabled={isBackfilling || isCollapsed}
          tabIndex={isCollapsed ? -1 : undefined}
          title="Import recent Instagram posts"
          aria-label={`Import recent Instagram posts for ${account.name}`}
          className="grid size-6 shrink-0 place-items-center rounded-md text-[var(--sidebar-dim)] transition-colors hover:bg-[var(--sidebar-success-bg)] hover:text-[var(--sidebar-success)] disabled:pointer-events-none disabled:opacity-60"
        >
          {isBackfilling ? (
            <LoaderCircle
              className="size-3.5 animate-spin"
              strokeWidth={1.8}
            />
          ) : (
            <RefreshCw className="size-3.5" strokeWidth={1.8} />
          )}
        </button>
      </span>
    </li>
  );
}

function ProfileAvatar({
  profile,
}: {
  profile?: UserProfile | null;
}) {
  const name = getProfileName(profile);

  return (
    <span
      className="dashboard-ui-meta flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#5e6ad2] font-semibold text-white"
    >
      <AvatarImage
        src={profile?.avatarUrl}
        alt={`${name} profile picture`}
        width={32}
        height={32}
        className="size-full object-cover"
        fallback={getInitials(name)}
      />
    </span>
  );
}

function getSidebarNavKey(key: SidebarKey): SidebarNavKey | null {
  return key === "account" ? null : key;
}

function readSidebarCollapsedCookie() {
  const cookiePrefix = `${SIDEBAR_COLLAPSED_COOKIE}=`;
  const cookie = document.cookie
    .split("; ")
    .find((row) => row.startsWith(cookiePrefix));

  if (!cookie) {
    return null;
  }

  return cookie.slice(cookiePrefix.length) === "true";
}

function writeSidebarCollapsedCookie(isCollapsed: boolean) {
  document.cookie = [
    `${SIDEBAR_COLLAPSED_COOKIE}=${isCollapsed ? "true" : "false"}`,
    `Max-Age=${SIDEBAR_COLLAPSED_MAX_AGE}`,
    "Path=/",
    "SameSite=Lax",
  ].join("; ");
}

function subscribeToSidebarCollapsedPreference(onStoreChange: () => void) {
  window.addEventListener(SIDEBAR_COLLAPSED_EVENT, onStoreChange);

  return () => {
    window.removeEventListener(SIDEBAR_COLLAPSED_EVENT, onStoreChange);
  };
}

function readAppThemeCookie(): ThemeMode | null {
  const cookiePrefix = `${APP_THEME_COOKIE}=`;
  const cookie = document.cookie
    .split("; ")
    .find((row) => row.startsWith(cookiePrefix));

  if (!cookie) {
    return null;
  }

  return cookie.slice(cookiePrefix.length) === "dark" ? "dark" : "light";
}

function writeAppThemeCookie(theme: ThemeMode) {
  document.cookie = [
    `${APP_THEME_COOKIE}=${theme}`,
    `Max-Age=${APP_THEME_MAX_AGE}`,
    "Path=/",
    "SameSite=Lax",
  ].join("; ");
}

function applyDocumentTheme(theme: ThemeMode) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

function commitDocumentTheme(theme: ThemeMode) {
  writeAppThemeCookie(theme);
  applyDocumentTheme(theme);
  window.dispatchEvent(new Event(APP_THEME_EVENT));
}

function subscribeToAppThemePreference(onStoreChange: () => void) {
  window.addEventListener(APP_THEME_EVENT, onStoreChange);

  return () => {
    window.removeEventListener(APP_THEME_EVENT, onStoreChange);
  };
}

export function SidebarPanel({
  active,
  accounts,
  initialCollapsed = false,
  initialTheme = "light",
  profile,
}: SidebarPanelProps) {
  const isCollapsed = useSyncExternalStore(
    subscribeToSidebarCollapsedPreference,
    () => readSidebarCollapsedCookie() ?? initialCollapsed,
    () => initialCollapsed,
  );
  const theme = useSyncExternalStore(
    subscribeToAppThemePreference,
    () => readAppThemeCookie() ?? initialTheme,
    () => initialTheme,
  );
  const [selectedNavKey, setSelectedNavKey] = useState<SidebarNavKey | null>(
    () => getSidebarNavKey(active),
  );
  const [isNarrowViewport, setIsNarrowViewport] = useState(false);
  const visibleAccounts = accounts.slice(0, VISIBLE_ACCOUNT_COUNT);
  const additionalAccounts = accounts.slice(VISIBLE_ACCOUNT_COUNT);
  const profileName = getProfileName(profile);
  const profileDetail = getProfileDetail(profile);
  const isCompact = isCollapsed || isNarrowViewport;
  const isDarkTheme = theme === "dark";
  const activeNavIndex = NAV_ITEMS.findIndex(
    (item) => item.key === selectedNavKey,
  );

  useEffect(() => {
    applyDocumentTheme(theme);
  }, [theme]);

  useEffect(() => {
    setSelectedNavKey(getSidebarNavKey(active));
  }, [active]);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 767px)");
    const syncViewport = () => setIsNarrowViewport(query.matches);

    syncViewport();
    query.addEventListener("change", syncViewport);

    return () => query.removeEventListener("change", syncViewport);
  }, []);

  function toggleSidebar() {
    const nextCollapsed = !isCollapsed;

    writeSidebarCollapsedCookie(nextCollapsed);
    window.dispatchEvent(new Event(SIDEBAR_COLLAPSED_EVENT));
  }

  function toggleTheme(event: MouseEvent<HTMLButtonElement>) {
    const nextTheme = isDarkTheme ? "light" : "dark";
    const transitionDocument = document as ViewTransitionDocument;
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (!transitionDocument.startViewTransition || reduceMotion) {
      commitDocumentTheme(nextTheme);
      return;
    }

    const origin =
      event.currentTarget.querySelector<HTMLElement>(
        "[data-theme-toggle-origin]",
      ) ?? event.currentTarget;
    const { left, top, width, height } = origin.getBoundingClientRect();
    const root = document.documentElement;

    root.style.setProperty("--theme-transition-x", `${left + width / 2}px`);
    root.style.setProperty("--theme-transition-y", `${top + height / 2}px`);
    root.classList.add("theme-circle-transition");

    const transition = transitionDocument.startViewTransition(() => {
      commitDocumentTheme(nextTheme);
    });

    void transition.finished
      .catch(() => undefined)
      .finally(() => {
        root.classList.remove("theme-circle-transition");
        root.style.removeProperty("--theme-transition-x");
        root.style.removeProperty("--theme-transition-y");
      });
  }

  return (
    <aside
      data-theme={theme}
      className={`app-shell-sidebar flex shrink-0 flex-col gap-4 overflow-y-auto px-3 pb-3 pt-4 font-inter text-[var(--sidebar-text)] transition-[width,background-color,border-color,color,box-shadow] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
        isCompact ? "w-16" : "w-[218px]"
      }`}
    >
      <header
        className={`flex h-[33px] items-center pb-1 transition-[gap,padding] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          isCompact ? "gap-1 px-[3px]" : "gap-4 px-[3px]"
        }`}
      >
        <span className="grid size-8 shrink-0 place-items-center text-[var(--sidebar-accent)] transition-colors duration-500">
          <SnowflakeLogo className="size-8" />
        </span>
        <span
          className={`min-w-0 overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-300 ease-out ${
            isCompact ? "max-w-0 opacity-0" : "max-w-[120px] opacity-100"
          }`}
        >
          <span className="dashboard-ui-label block truncate font-semibold text-[var(--sidebar-text)]">
            Snowflake
          </span>
        </span>
      </header>

      <nav aria-label="Primary" className="relative mt-4 flex flex-col gap-1">
        {activeNavIndex >= 0 ? (
          <span
            aria-hidden="true"
            className="sidebar-selected-shadow absolute left-[3px] top-0 z-0 h-8 rounded-[7px] bg-[var(--sidebar-accent)] transition-[transform,width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
            style={{
              transform: `translateY(${activeNavIndex * 36}px)`,
              width: isCompact ? "32px" : "calc(100% - 6px)",
            }}
          />
        ) : null}
        {NAV_ITEMS.map(({ key, label, Icon, href, badge }) => {
          const isActive = key === selectedNavKey;

          return (
            <Link
              key={key}
              href={href}
              aria-current={key === active ? "page" : undefined}
              onClick={() => setSelectedNavKey(key)}
              title={isCompact ? label : undefined}
              className={`dashboard-ui-label group relative z-10 flex min-h-8 w-full items-center gap-1 rounded-md px-[3px] py-0 transition-colors duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                isActive
                  ? "font-medium text-[var(--sidebar-active-foreground)]"
                  : `text-[var(--sidebar-muted)] ${
                      isCompact ? "" : "hover:bg-[var(--sidebar-hover)]"
                    } hover:text-[var(--sidebar-text)]`
              }`}
            >
              <span
                className={`relative grid size-8 shrink-0 place-items-center rounded-[5px] transition-colors duration-200 ${
                  !isActive && isCompact
                    ? "group-hover:bg-[var(--sidebar-hover-strong)]"
                    : ""
                }`}
              >
                <Icon
                  className={`size-[18px] translate-y-[1px] transition-colors duration-300 ${
                    isActive ? "text-[var(--sidebar-active-foreground)]" : ""
                  }`}
                  strokeWidth={1.8}
                />
                {badge && isCompact ? (
                  <span
                    aria-hidden="true"
                    className="absolute -right-1 -top-1 size-1.5 rounded-full bg-[var(--sidebar-dim)]"
                  />
                ) : null}
              </span>
              <span
                className={`truncate transition-[max-width,opacity] duration-300 ease-out ${
                  isCompact
                    ? "max-w-0 opacity-0"
                    : "max-w-[110px] opacity-100"
                }`}
              >
                {label}
              </span>
              {badge && !isCompact ? (
                <span className="dashboard-micro-text ml-auto rounded-full bg-[var(--sidebar-hover-strong)] px-1.5 py-px text-[var(--sidebar-muted)] transition-colors duration-500">
                  {badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <section
        aria-label="Accounts"
        className="flex flex-col gap-4 border-t border-[var(--sidebar-dashed)] pt-3"
      >
        {accounts.length === 0 && !isCompact ? (
          <p className="dashboard-ui-label px-2 py-3 text-[var(--sidebar-dim)]">
            No accounts connected yet
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {visibleAccounts.map((account, index) => (
              <AccountRow
                key={account.id}
                account={account}
                index={index}
                isCollapsed={isCompact}
              />
            ))}
          </ul>
        )}

        {additionalAccounts.length > 0 && isCompact ? (
          <div
            title={`${additionalAccounts.length} more connected accounts`}
            className="dashboard-ui-meta mx-auto flex size-8 items-center justify-center rounded-[5px] text-[var(--sidebar-dim)]"
          >
            +{additionalAccounts.length}
          </div>
        ) : null}

        {additionalAccounts.length > 0 && !isCompact ? (
          <details className="group">
            <summary className="dashboard-ui-label flex min-h-8 cursor-pointer list-none items-center gap-2 rounded-md px-2 py-1.5 text-[var(--sidebar-muted)] transition-colors hover:bg-[var(--sidebar-hover)] hover:text-[var(--sidebar-text)] [&::-webkit-details-marker]:hidden">
              <span className="grid size-[22px] shrink-0 place-items-center rounded-md border border-dashed border-[var(--sidebar-dashed)] text-[var(--sidebar-muted)]">
                <ChevronDown
                  className="size-[13px] transition-transform group-open:rotate-180"
                  strokeWidth={1.7}
                />
              </span>
              <span className="group-open:hidden">
                Show {additionalAccounts.length} more
              </span>
              <span className="hidden group-open:inline">Show less</span>
            </summary>
            <ul className="mt-px flex flex-col gap-px">
              {additionalAccounts.map((account, index) => (
                <AccountRow
                  key={account.id}
                  account={account}
                  index={VISIBLE_ACCOUNT_COUNT + index}
                />
              ))}
            </ul>
          </details>
        ) : null}
      </section>

      <div className="mt-auto flex flex-col gap-1">
        <button
          type="button"
          role="switch"
          aria-checked={isDarkTheme}
          aria-label={isDarkTheme ? "Use light mode" : "Use dark mode"}
          onClick={toggleTheme}
          title={
            isCompact ? (isDarkTheme ? "Light mode" : "Dark mode") : undefined
          }
          className={`dashboard-ui-label group flex min-h-8 w-full items-center text-[var(--sidebar-muted)] transition-colors duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:text-[var(--sidebar-text)] ${
            isCompact
              ? "gap-1 px-[3px] py-0"
              : "gap-1 rounded-md px-[3px] py-0 hover:bg-[var(--sidebar-hover)]"
          }`}
        >
          <span
            data-theme-toggle-origin
            className={`relative grid size-8 shrink-0 place-items-center overflow-hidden rounded-[5px] transition-colors duration-200 ${
              isCompact
                ? "group-hover:bg-[var(--sidebar-hover-strong)]"
                : ""
            }`}
          >
            <Sun
              className={`absolute size-[15px] text-[var(--sidebar-switch-icon)] transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                isDarkTheme
                  ? "scale-50 rotate-90 opacity-0"
                  : "scale-100 rotate-0 opacity-100"
              }`}
              strokeWidth={1.7}
            />
            <Moon
              className={`absolute size-[15px] text-[var(--sidebar-accent)] transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                isDarkTheme
                  ? "scale-100 rotate-0 opacity-100"
                  : "scale-50 -rotate-90 opacity-0"
              }`}
              strokeWidth={1.7}
            />
          </span>
          <span
            className={`overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-300 ease-out ${
              isCompact ? "max-w-0 opacity-0" : "max-w-[92px] opacity-100"
            }`}
          >
            {isDarkTheme ? "Dark mode" : "Light mode"}
          </span>
        </button>

        <button
          type="button"
          aria-label={isCompact ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!isCompact}
          onClick={toggleSidebar}
          title={isCompact ? "Expand sidebar" : undefined}
          className={`dashboard-ui-label group flex min-h-8 w-full items-center text-[var(--sidebar-muted)] transition-colors duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:text-[var(--sidebar-text)] ${
            isCompact
              ? "gap-1 px-[3px] py-0"
              : "gap-1 rounded-md px-[3px] py-0 hover:bg-[var(--sidebar-hover)]"
          }`}
        >
          <span
            className={`grid size-8 shrink-0 place-items-center rounded-[5px] transition-colors duration-200 ${
              isCompact
                ? "group-hover:bg-[var(--sidebar-hover-strong)]"
                : ""
            }`}
          >
            {isCompact ? (
              <PanelLeftOpen className="size-[15px]" strokeWidth={1.7} />
            ) : (
              <PanelLeftClose className="size-[15px]" strokeWidth={1.7} />
            )}
          </span>
          <span
            className={`overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-300 ease-out ${
              isCompact ? "max-w-0 opacity-0" : "max-w-[132px] opacity-100"
            }`}
          >
            Collapse sidebar
          </span>
        </button>

        <footer
          className={`transition-[background-color,border-color,margin,padding,width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            isCompact
              ? "mx-auto w-full p-0"
              : "sidebar-profile-card-shadow -mx-1.5 w-[calc(100%+0.75rem)] rounded-[14px] border border-line bg-paper p-1.5"
          }`}
        >
          <Link
            href="/account"
            title={isCompact ? "Account" : undefined}
            className={`flex min-h-8 w-full items-center text-left transition-[gap,padding,color] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              isCompact ? "gap-1 px-[3px] py-0" : "gap-2 rounded-lg px-2 py-2"
            }`}
          >
            <span className="grid size-8 shrink-0 place-items-center rounded-[5px]">
              <ProfileAvatar profile={profile} />
            </span>
            <span
              className={`min-w-0 flex-1 overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-300 ease-out ${
                isCompact ? "max-w-0 opacity-0" : "max-w-[150px] opacity-100"
              }`}
            >
              <span className="dashboard-ui-label block truncate text-[var(--sidebar-text)]">
                {profileName}
              </span>
              <span className="dashboard-micro-text block truncate font-normal text-[var(--sidebar-dim)]">
                {profileDetail}
              </span>
            </span>
          </Link>
        </footer>
      </div>
    </aside>
  );
}
