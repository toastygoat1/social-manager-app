"use client";

import type { ComponentType, SVGProps } from "react";
import { useSyncExternalStore } from "react";
import {
  BarChart3,
  CalendarDays,
  ChevronDown,
  Home,
  Inbox,
  LayoutGrid,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Sparkles,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { UserProfile } from "@/lib/supabase/user-profile";
import type { Account } from "./data";
import {
  SIDEBAR_COLLAPSED_COOKIE,
  SIDEBAR_COLLAPSED_EVENT,
  SIDEBAR_COLLAPSED_MAX_AGE,
} from "./sidebar-preferences";

type LucideIcon = ComponentType<SVGProps<SVGSVGElement> & { strokeWidth?: number }>;

export type SidebarKey =
  | "dashboard"
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

type SidebarPanelProps = {
  active: SidebarKey;
  accounts: Account[];
  initialCollapsed?: boolean;
  profile?: UserProfile | null;
};

const NAV_ITEMS: NavItem[] = [
  { key: "dashboard", label: "Overview", Icon: Home, href: "/dashboard" },
  { key: "scheduling", label: "Calendar", Icon: CalendarDays, href: "/calendar" },
  { key: "snow-ai", label: "Snow AI", Icon: Sparkles, href: "/chat-ai" },
  { key: "chat", label: "Inbox", Icon: Inbox, href: "/chat", badge: "24" },
  { key: "analytics", label: "Insights", Icon: BarChart3, href: "/analytics" },
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
      <path d="M15.5 4.54004L15.5 27.8859" stroke="currentColor" strokeWidth="2.09452" />
      <circle cx="15.4993" cy="2.91824" r="1.87098" stroke="currentColor" strokeWidth="2.09452" />
      <path d="M15.499 27.6357C16.5322 27.6357 17.37 28.4736 17.3701 29.5068C17.3701 30.5401 16.5323 31.3779 15.499 31.3779C14.4658 31.3778 13.6279 30.5401 13.6279 29.5068C13.6281 28.4737 14.4659 27.6359 15.499 27.6357Z" stroke="currentColor" strokeWidth="2.09452" />
      <path d="M5.3916 10.375L25.6098 22.048" stroke="currentColor" strokeWidth="2.09452" />
      <circle cx="3.98639" cy="9.56466" r="1.87098" transform="rotate(-60 3.98639 9.56466)" stroke="currentColor" strokeWidth="2.09452" />
      <path d="M25.392 21.9232C25.9086 21.0284 27.0531 20.7218 27.9479 21.2383C28.8428 21.7549 29.1495 22.8994 28.6328 23.7943C28.1161 24.6889 26.9716 24.9957 26.0768 24.4791C25.1822 23.9624 24.8755 22.8179 25.392 21.9232Z" stroke="currentColor" strokeWidth="2.09452" />
      <path d="M25.6084 10.375L5.39025 22.048" stroke="currentColor" strokeWidth="2.09452" />
      <circle cx="2.91824" cy="2.91824" r="1.87098" transform="matrix(-0.5 -0.866025 -0.866025 0.5 30.999 10.6328)" stroke="currentColor" strokeWidth="2.09452" />
      <path d="M5.60705 21.9232C5.09044 21.0284 3.94593 20.7218 3.05109 21.2383C2.15621 21.7549 1.84957 22.8994 2.36622 23.7943C2.88294 24.6889 4.02739 24.9957 4.92218 24.4791C5.8168 23.9624 6.12347 22.8179 5.60705 21.9232Z" stroke="currentColor" strokeWidth="2.09452" />
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
      className="flex size-[22px] shrink-0 items-center justify-center overflow-hidden rounded-md text-[10px] font-semibold text-white"
      style={{
        background: `linear-gradient(135deg, ${color}, ${color}cc)`,
      }}
    >
      {account.avatarUrl ? (
        <Image
          src={account.avatarUrl}
          alt=""
          width={22}
          height={22}
          className="size-full object-cover"
        />
      ) : (
        getInitials(account.name, "I")
      )}
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
  return (
    <li
      title={isCollapsed ? account.name : undefined}
      className={`flex min-h-8 items-center rounded-md py-1.5 transition-colors hover:bg-[#f4f2ed] ${
        isCollapsed ? "justify-center px-0" : "gap-2 px-2"
      }`}
    >
      <AccountAvatar account={account} index={index} />
      {isCollapsed ? null : (
        <>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12.5px] font-medium leading-4 text-[#1a1814]">
              {account.name}
            </span>
            <span className="block truncate text-[10.5px] leading-4 text-[#8a847a]">
              {account.platform}
            </span>
          </span>
          <span className="shrink-0 font-mono text-[9.5px] font-semibold text-[#8a847a]">
            {getPlatformCode(account.platform)}
          </span>
        </>
      )}
    </li>
  );
}

function ProfileAvatar({
  profile,
  isCollapsed = false,
}: {
  profile?: UserProfile | null;
  isCollapsed?: boolean;
}) {
  const name = getProfileName(profile);

  return (
    <span
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-[7px] bg-[#5e6ad2] font-semibold text-white ${
        isCollapsed ? "size-8 text-xs" : "size-[26px] text-[10.5px]"
      }`}
    >
      {profile?.avatarUrl ? (
        <Image
          src={profile.avatarUrl}
          alt={`${name} profile picture`}
          width={isCollapsed ? 32 : 26}
          height={isCollapsed ? 32 : 26}
          className="size-full object-cover"
        />
      ) : (
        getInitials(name)
      )}
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

export function SidebarPanel({
  active,
  accounts,
  initialCollapsed = false,
  profile,
}: SidebarPanelProps) {
  const isCollapsed = useSyncExternalStore(
    subscribeToSidebarCollapsedPreference,
    () => readSidebarCollapsedCookie() ?? initialCollapsed,
    () => initialCollapsed,
  );
  const visibleAccounts = accounts.slice(0, VISIBLE_ACCOUNT_COUNT);
  const additionalAccounts = accounts.slice(VISIBLE_ACCOUNT_COUNT);
  const profileName = getProfileName(profile);
  const profileDetail = getProfileDetail(profile);

  function toggleSidebar() {
    const nextCollapsed = !isCollapsed;

    writeSidebarCollapsedCookie(nextCollapsed);
    window.dispatchEvent(new Event(SIDEBAR_COLLAPSED_EVENT));
  }

  return (
    <aside
      className={`sticky top-0 flex h-screen shrink-0 flex-col gap-[18px] overflow-y-auto border-r border-[#e7e3db] bg-[#fafaf8] pb-3 pt-3.5 font-inter text-[#1a1814] transition-[width,padding] duration-300 ease-in-out motion-reduce:transition-none ${
        isCollapsed ? "w-20 px-2" : "w-[232px] px-3"
      }`}
    >
      <header
        className={`flex h-[33px] items-center pb-1 transition-[gap,padding] duration-300 ${
          isCollapsed ? "justify-center gap-0 px-0" : "gap-3 px-1.5"
        }`}
      >
        <span className="flex shrink-0 items-center justify-center text-[#3ac1d6]">
          <SnowflakeLogo className="h-[33px] w-[31px]" />
        </span>
        <span
          className={`min-w-0 overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-200 ${
            isCollapsed ? "max-w-0 opacity-0" : "max-w-[120px] opacity-100"
          }`}
        >
          <span className="block truncate text-sm font-semibold leading-4 text-[#1a1814]">
            Snowflake
          </span>
        </span>
      </header>

      <nav aria-label="Primary" className="flex flex-col gap-px">
        {NAV_ITEMS.map(({ key, label, Icon, href, badge }) => {
          const isActive = key === active;

          return (
            <Link
              key={key}
              href={href}
              aria-current={isActive ? "page" : undefined}
              title={isCollapsed ? label : undefined}
              className={`relative flex min-h-7 items-center rounded-md py-1.5 text-[12.5px] leading-4 transition-[gap,padding,background-color,color] duration-300 ${
                isCollapsed ? "justify-center gap-0 px-0" : "gap-[9px] px-2"
              } ${
                isActive
                  ? `bg-[#f4f2ed] font-medium text-[#1a1814] before:absolute before:top-1.5 before:bottom-1.5 before:w-0.5 before:rounded-full before:bg-[#5e6ad2] ${
                      isCollapsed ? "before:left-0" : "before:-left-3"
                    }`
                  : "text-[#59544c] hover:bg-[#f4f2ed] hover:text-[#1a1814]"
              }`}
            >
              <span className="relative flex shrink-0 items-center justify-center">
                <Icon className="size-[15px]" strokeWidth={1.7} />
                {badge && isCollapsed ? (
                  <span
                    aria-hidden="true"
                    className="absolute -right-1 -top-1 size-1.5 rounded-full bg-[#8a847a]"
                  />
                ) : null}
              </span>
              <span
                className={`truncate transition-[max-width,opacity] duration-200 ${
                  isCollapsed ? "max-w-0 opacity-0" : "max-w-[110px] opacity-100"
                }`}
              >
                {label}
              </span>
              {badge && !isCollapsed ? (
                <span className="ml-auto rounded-full bg-[#e8e5dd] px-1.5 py-px text-[10.5px] leading-4 text-[#59544c]">
                  {badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <section aria-label="Clients" className="flex flex-col gap-1">
        <div
          className={`mb-1 flex items-center justify-between px-2 text-[10.5px] font-medium uppercase text-[#8a847a] ${
            isCollapsed ? "sr-only" : ""
          }`}
        >
          <h2>Clients</h2>
          <span>{accounts.length}</span>
        </div>

        <div
          title={isCollapsed ? "All clients" : undefined}
          className={`flex min-h-8 items-center rounded-md py-1.5 transition-[gap,padding,background-color,box-shadow] duration-300 ${
            isCollapsed
              ? "justify-center px-0"
              : "gap-2 bg-[#f4f2ed] px-2 shadow-[inset_0_0_0_1px_#e7e3db]"
          }`}
        >
          <span className="grid size-[22px] shrink-0 place-items-center rounded-md border border-dashed border-[#d3cec3] text-[#59544c]">
            <LayoutGrid className="size-[13px]" strokeWidth={1.7} />
          </span>
          {isCollapsed ? null : (
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12.5px] font-medium leading-4 text-[#1a1814]">
                All clients
              </span>
              <span className="block text-[10.5px] leading-4 text-[#8a847a]">
                {accounts.length} connected
              </span>
            </span>
          )}
        </div>

        {accounts.length === 0 && !isCollapsed ? (
          <p className="px-2 py-3 text-[12.5px] leading-5 text-[#8a847a]">
            No accounts connected yet
          </p>
        ) : (
          <ul className="flex flex-col gap-px">
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
            className="flex min-h-8 items-center justify-center rounded-md py-1.5 text-[11px] font-medium text-[#8a847a]"
          >
            +{additionalAccounts.length}
          </div>
        ) : null}

        {additionalAccounts.length > 0 && !isCollapsed ? (
          <details className="group">
            <summary className="flex min-h-8 cursor-pointer list-none items-center gap-2 rounded-md px-2 py-1.5 text-[12.5px] text-[#59544c] transition-colors hover:bg-[#f4f2ed] hover:text-[#1a1814] [&::-webkit-details-marker]:hidden">
              <span className="grid size-[22px] shrink-0 place-items-center rounded-md border border-dashed border-[#d3cec3] text-[#59544c]">
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
        aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        aria-expanded={!isCollapsed}
        onClick={toggleSidebar}
        title={isCollapsed ? "Expand sidebar" : undefined}
        className={`mt-auto flex min-h-8 items-center rounded-md py-1.5 text-[12.5px] text-[#59544c] transition-[gap,padding,background-color,color] duration-300 hover:bg-[#f4f2ed] hover:text-[#1a1814] ${
          isCollapsed ? "justify-center gap-0 px-0" : "gap-2 px-2"
        }`}
      >
        {isCollapsed ? (
          <PanelLeftOpen className="size-[15px] shrink-0" strokeWidth={1.7} />
        ) : (
          <PanelLeftClose className="size-[15px] shrink-0" strokeWidth={1.7} />
        )}
        <span
          className={`overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-200 ${
            isCollapsed ? "max-w-0 opacity-0" : "max-w-[132px] opacity-100"
          }`}
        >
          Collapse sidebar
        </span>
      </button>

      <footer
        className={`flex items-center border-t border-[#e7e3db] pb-1 pt-3 transition-[gap,padding] duration-300 ${
          isCollapsed ? "justify-center gap-0 px-0" : "gap-2 px-1.5"
        }`}
      >
        <ProfileAvatar profile={profile} isCollapsed={isCollapsed} />
        <span
          className={`min-w-0 flex-1 overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-200 ${
            isCollapsed ? "max-w-0 opacity-0" : "max-w-[140px] opacity-100"
          }`}
        >
          <span className="block truncate text-xs font-medium leading-4 text-[#1a1814]">
            {profileName}
          </span>
          <span className="block truncate text-[10.5px] leading-4 text-[#8a847a]">
            {profileDetail}
          </span>
        </span>
        {isCollapsed ? null : (
          <button
            type="button"
            aria-label="Settings"
            className="grid size-7 shrink-0 place-items-center rounded-md text-[#59544c] transition-colors hover:bg-[#f4f2ed] hover:text-[#1a1814]"
          >
            <Settings className="size-3.5" strokeWidth={1.7} />
          </button>
        )}
      </footer>
    </aside>
  );
}
