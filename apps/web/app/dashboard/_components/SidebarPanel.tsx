"use client";

import type { ComponentType, MouseEvent, SVGProps } from "react";
import { useEffect, useState, useSyncExternalStore } from "react";
import {
  BarChart3,
  CalendarDays,
  ChevronDown,
  Columns2,
  Home,
  Inbox,
  LoaderCircle,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  Settings,
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
  | "workspace"
  | "scheduling"
  | "analytics"
  | "chat"
  | "snow-ai";

type NavItem = {
  key: SidebarKey;
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
      viewBox="0 0 31 33"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Snowflake logo"
      {...props}
    >
      <path
        d="M15.5 4.54004L15.5 27.8859"
        stroke="currentColor"
        strokeWidth="2.09452"
      />
      <circle
        cx="15.4993"
        cy="2.91824"
        r="1.87098"
        stroke="currentColor"
        strokeWidth="2.09452"
      />
      <path
        d="M15.499 27.6357C16.5322 27.6357 17.37 28.4736 17.3701 29.5068C17.3701 30.5401 16.5323 31.3779 15.499 31.3779C14.4658 31.3778 13.6279 30.5401 13.6279 29.5068C13.6281 28.4737 14.4659 27.6359 15.499 27.6357Z"
        stroke="currentColor"
        strokeWidth="2.09452"
      />
      <path
        d="M5.3916 10.375L25.6098 22.048"
        stroke="currentColor"
        strokeWidth="2.09452"
      />
      <circle
        cx="3.98639"
        cy="9.56466"
        r="1.87098"
        transform="rotate(-60 3.98639 9.56466)"
        stroke="currentColor"
        strokeWidth="2.09452"
      />
      <path
        d="M25.392 21.9232C25.9086 21.0284 27.0531 20.7218 27.9479 21.2383C28.8428 21.7549 29.1495 22.8994 28.6328 23.7943C28.1161 24.6889 26.9716 24.9957 26.0768 24.4791C25.1822 23.9624 24.8755 22.8179 25.392 21.9232Z"
        stroke="currentColor"
        strokeWidth="2.09452"
      />
      <path
        d="M25.6084 10.375L5.39025 22.048"
        stroke="currentColor"
        strokeWidth="2.09452"
      />
      <circle
        cx="2.91824"
        cy="2.91824"
        r="1.87098"
        transform="matrix(-0.5 -0.866025 -0.866025 0.5 30.999 10.6328)"
        stroke="currentColor"
        strokeWidth="2.09452"
      />
      <path
        d="M5.60705 21.9232C5.09044 21.0284 3.94593 20.7218 3.05109 21.2383C2.15621 21.7549 1.84957 22.8994 2.36622 23.7943C2.88294 24.6889 4.02739 24.9957 4.92218 24.4791C5.8168 23.9624 6.12347 22.8179 5.60705 21.9232Z"
        stroke="currentColor"
        strokeWidth="2.09452"
      />
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
      className="flex size-[26px] shrink-0 items-center justify-center overflow-hidden rounded-[7px] text-[11px] font-semibold text-white"
      style={{
        background: `linear-gradient(135deg, ${color}, ${color}cc)`,
      }}
    >
      <AvatarImage
        src={account.avatarUrl}
        alt=""
        width={26}
        height={26}
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
      className={`group flex min-h-8 w-full items-center transition-[gap,padding,background-color] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
        isCollapsed ? "gap-1 rounded-md px-[3px] py-0" : "gap-1 rounded-md px-[3px] py-0"
      }`}
    >
      <Link
        href={getInsightsHref(account.id)}
        aria-label={`View insights for ${account.name}`}
        className={`flex min-w-0 flex-1 items-center transition-[gap] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          isCollapsed ? "gap-0" : "gap-1"
        }`}
      >
        <span
          className="grid size-8 shrink-0 place-items-center rounded-[5px]"
        >
          <AccountAvatar account={account} index={index} />
        </span>
        <span
          className={`min-w-0 flex-1 overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-300 ease-out ${
            isCollapsed ? "max-w-0 opacity-0" : "max-w-[142px] opacity-100"
          }`}
        >
          <span className="block truncate text-[12.5px] font-medium leading-4 text-[var(--sidebar-text)]">
            {accountTitle}
          </span>
          <span className="block truncate text-[10.5px] leading-4 text-[var(--sidebar-dim)]">
            {accountHandle}
          </span>
        </span>
        <span
          className={`shrink-0 overflow-hidden whitespace-nowrap font-mono text-[9.5px] font-semibold text-[var(--sidebar-dim)] transition-[max-width,opacity] duration-300 ease-out ${
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
      className="flex size-[26px] shrink-0 items-center justify-center overflow-hidden rounded-[7px] bg-[#5e6ad2] text-[10.5px] font-semibold text-white"
    >
      <AvatarImage
        src={profile?.avatarUrl}
        alt={`${name} profile picture`}
        width={26}
        height={26}
        className="size-full object-cover"
        fallback={getInitials(name)}
      />
    </span>
  );
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
  const [selectedNavKey, setSelectedNavKey] = useState<SidebarKey>(active);
  const visibleAccounts = accounts.slice(0, VISIBLE_ACCOUNT_COUNT);
  const additionalAccounts = accounts.slice(VISIBLE_ACCOUNT_COUNT);
  const profileName = getProfileName(profile);
  const profileDetail = getProfileDetail(profile);
  const isDarkTheme = theme === "dark";
  const activeNavIndex = Math.max(
    0,
    NAV_ITEMS.findIndex((item) => item.key === selectedNavKey),
  );

  useEffect(() => {
    applyDocumentTheme(theme);
  }, [theme]);

  useEffect(() => {
    setSelectedNavKey(active);
  }, [active]);

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
      className={`app-shell-sidebar flex shrink-0 flex-col gap-[18px] overflow-y-auto pb-3 pt-3.5 font-inter text-[var(--sidebar-text)] transition-[width,padding,background-color,border-color,color,box-shadow] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
        isCollapsed ? "w-16 px-3" : "w-[232px] px-3"
      }`}
    >
      <header
        className={`flex h-[33px] items-center pb-1 transition-[gap,padding] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          isCollapsed ? "gap-1 px-[3px]" : "gap-4 px-[3px]"
        }`}
      >
        <span className="grid size-8 shrink-0 place-items-center text-[var(--sidebar-accent)] transition-colors duration-500">
          <SnowflakeLogo className="h-[33px] w-[31px]" />
        </span>
        <span
          className={`min-w-0 overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-300 ease-out ${
            isCollapsed ? "max-w-0 opacity-0" : "max-w-[120px] opacity-100"
          }`}
        >
          <span className="block truncate text-sm font-semibold leading-4 text-[var(--sidebar-text)]">
            Snowflake
          </span>
        </span>
      </header>

      <nav aria-label="Primary" className="relative mt-2 flex flex-col gap-1">
        <span
          aria-hidden="true"
          className="absolute left-[3px] top-0 z-0 h-8 rounded-[7px] bg-[var(--sidebar-accent)] transition-[transform,width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
          style={{
            transform: `translateY(${activeNavIndex * 36}px)`,
            width: isCollapsed ? "32px" : "calc(100% - 6px)",
          }}
        />
        {NAV_ITEMS.map(({ key, label, Icon, href, badge }) => {
          const isActive = key === selectedNavKey;

          return (
            <Link
              key={key}
              href={href}
              aria-current={key === active ? "page" : undefined}
              onClick={() => setSelectedNavKey(key)}
              title={isCollapsed ? label : undefined}
              className={`group relative z-10 flex min-h-8 w-full items-center rounded-md text-[12.5px] leading-4 transition-[gap,padding,background-color,color] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                isCollapsed
                  ? "gap-1 px-[3px] py-0"
                  : "gap-1 px-[3px] py-0"
              } ${
                isActive
                  ? "font-medium text-white"
                  : `text-[var(--sidebar-muted)] ${
                      isCollapsed ? "" : "hover:bg-[var(--sidebar-hover)]"
                    } hover:text-[var(--sidebar-text)]`
              }`}
            >
              <span
                className={`relative grid size-8 shrink-0 place-items-center rounded-[5px] transition-colors duration-200 ${
                  !isActive && isCollapsed
                    ? "group-hover:bg-[var(--sidebar-hover-strong)]"
                    : ""
                }`}
              >
                <Icon
                  className={`size-[18px] translate-y-[1px] transition-colors duration-300 ${
                    isActive ? "text-white" : ""
                  }`}
                  strokeWidth={1.8}
                />
                {badge && isCollapsed ? (
                  <span
                    aria-hidden="true"
                    className="absolute -right-1 -top-1 size-1.5 rounded-full bg-[var(--sidebar-dim)]"
                  />
                ) : null}
              </span>
              <span
                className={`truncate transition-[max-width,opacity] duration-300 ease-out ${
                  isCollapsed
                    ? "max-w-0 opacity-0"
                    : "max-w-[110px] opacity-100"
                }`}
              >
                {label}
              </span>
              {badge && !isCollapsed ? (
                <span className="ml-auto rounded-full bg-[var(--sidebar-hover-strong)] px-1.5 py-px text-[10.5px] leading-4 text-[var(--sidebar-muted)] transition-colors duration-500">
                  {badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <section aria-label="Accounts" className="flex flex-col gap-4">
        <div
          aria-hidden="true"
          className="sidebar-dash-rule w-full transition-[width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
        />

        {accounts.length === 0 && !isCollapsed ? (
          <p className="px-2 py-3 text-[12.5px] leading-5 text-[var(--sidebar-dim)]">
            No accounts connected yet
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {visibleAccounts.map((account, index) => (
              <AccountRow
                key={account.id}
                account={account}
                index={index}
                isCollapsed={isCollapsed}
              />
            ))}
          </ul>
        )}

        {additionalAccounts.length > 0 && isCollapsed ? (
          <div
            title={`${additionalAccounts.length} more connected accounts`}
            className="mx-auto flex size-8 items-center justify-center rounded-[5px] text-[11px] font-medium text-[var(--sidebar-dim)]"
          >
            +{additionalAccounts.length}
          </div>
        ) : null}

        {additionalAccounts.length > 0 && !isCollapsed ? (
          <details className="group">
            <summary className="flex min-h-8 cursor-pointer list-none items-center gap-2 rounded-md px-2 py-1.5 text-[12.5px] text-[var(--sidebar-muted)] transition-colors hover:bg-[var(--sidebar-hover)] hover:text-[var(--sidebar-text)] [&::-webkit-details-marker]:hidden">
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

      <button
        type="button"
        role="switch"
        aria-checked={isDarkTheme}
        aria-label={isDarkTheme ? "Use light mode" : "Use dark mode"}
        onClick={toggleTheme}
        title={
          isCollapsed ? (isDarkTheme ? "Light mode" : "Dark mode") : undefined
        }
        className={`group mt-auto flex min-h-8 w-full items-center text-[12.5px] text-[var(--sidebar-muted)] transition-[gap,padding,background-color,color] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:text-[var(--sidebar-text)] ${
          isCollapsed
            ? "gap-1 px-[3px] py-0"
            : "gap-1 rounded-md px-[3px] py-0 hover:bg-[var(--sidebar-hover)]"
        }`}
      >
        <span
          data-theme-toggle-origin
          className={`relative grid size-8 shrink-0 place-items-center overflow-hidden rounded-[5px] transition-colors duration-200 ${
            isCollapsed
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
            isCollapsed ? "max-w-0 opacity-0" : "max-w-[92px] opacity-100"
          }`}
        >
          {isDarkTheme ? "Dark mode" : "Light mode"}
        </span>
      </button>

      <button
        type="button"
        aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        aria-expanded={!isCollapsed}
        onClick={toggleSidebar}
        title={isCollapsed ? "Expand sidebar" : undefined}
        className={`group flex min-h-8 w-full items-center text-[12.5px] text-[var(--sidebar-muted)] transition-[gap,padding,background-color,color] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:text-[var(--sidebar-text)] ${
          isCollapsed
            ? "gap-1 px-[3px] py-0"
            : "gap-1 rounded-md px-[3px] py-0 hover:bg-[var(--sidebar-hover)]"
        }`}
      >
        <span
          className={`grid size-8 shrink-0 place-items-center rounded-[5px] transition-colors duration-200 ${
            isCollapsed
              ? "group-hover:bg-[var(--sidebar-hover-strong)]"
              : ""
          }`}
        >
          {isCollapsed ? (
            <PanelLeftOpen className="size-[15px]" strokeWidth={1.7} />
          ) : (
            <PanelLeftClose className="size-[15px]" strokeWidth={1.7} />
          )}
        </span>
        <span
          className={`overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-300 ease-out ${
            isCollapsed ? "max-w-0 opacity-0" : "max-w-[132px] opacity-100"
          }`}
        >
          Collapse sidebar
        </span>
      </button>

      <footer
        className={`sidebar-dash-rule-top flex items-center pb-1 pt-3 transition-[gap,padding] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          isCollapsed ? "gap-1 px-[3px]" : "gap-1 px-[3px]"
        }`}
      >
        <span className="grid size-8 shrink-0 place-items-center">
          <ProfileAvatar profile={profile} />
        </span>
        <span
          className={`min-w-0 flex-1 overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-300 ease-out ${
            isCollapsed ? "max-w-0 opacity-0" : "max-w-[140px] opacity-100"
          }`}
        >
          <span className="block truncate text-xs font-medium leading-4 text-[var(--sidebar-text)]">
            {profileName}
          </span>
          <span className="block truncate text-[10.5px] leading-4 text-[var(--sidebar-dim)]">
            {profileDetail}
          </span>
        </span>
        <button
          type="button"
          aria-hidden={isCollapsed}
          aria-label="Settings"
          tabIndex={isCollapsed ? -1 : undefined}
          className={`grid h-7 shrink-0 place-items-center overflow-hidden rounded-md text-[var(--sidebar-muted)] transition-[opacity,width,color,background-color] duration-300 hover:bg-[var(--sidebar-hover)] hover:text-[var(--sidebar-text)] ${
            isCollapsed ? "w-0 opacity-0" : "w-7 opacity-100"
          }`}
        >
          <Settings className="size-3.5" strokeWidth={1.7} />
        </button>
      </footer>
    </aside>
  );
}
