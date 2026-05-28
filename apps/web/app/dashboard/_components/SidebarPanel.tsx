"use client";

import type { ComponentType, SVGProps } from "react";
import {
  BarChart3,
  CalendarDays,
  ChevronDown,
  Home,
  Inbox,
  LayoutGrid,
  Settings,
  Sparkles,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { UserProfile } from "@/lib/supabase/user-profile";
import type { Account } from "./data";

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
}: {
  account: Account;
  index: number;
}) {
  return (
    <li className="flex min-h-8 items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-[#f4f2ed]">
      <AccountAvatar account={account} index={index} />
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
    </li>
  );
}

function ProfileAvatar({ profile }: { profile?: UserProfile | null }) {
  const name = getProfileName(profile);

  return (
    <span className="flex size-[26px] shrink-0 items-center justify-center overflow-hidden rounded-[7px] bg-[#5e6ad2] text-[10.5px] font-semibold text-white">
      {profile?.avatarUrl ? (
        <Image
          src={profile.avatarUrl}
          alt={`${name} profile picture`}
          width={26}
          height={26}
          className="size-full object-cover"
        />
      ) : (
        getInitials(name)
      )}
    </span>
  );
}

export function SidebarPanel({
  active,
  accounts,
  profile,
}: SidebarPanelProps) {
  const visibleAccounts = accounts.slice(0, VISIBLE_ACCOUNT_COUNT);
  const additionalAccounts = accounts.slice(VISIBLE_ACCOUNT_COUNT);
  const profileName = getProfileName(profile);
  const profileDetail = getProfileDetail(profile);

  return (
    <aside className="sticky top-0 flex h-screen w-[232px] shrink-0 flex-col gap-[18px] overflow-y-auto border-r border-[#e7e3db] bg-[#fafaf8] px-3 pb-3 pt-3.5 font-inter text-[#1a1814]">
      <header className="flex items-center gap-2.5 px-1.5 pb-1">
        <span className="grid size-6 shrink-0 place-items-center rounded-md bg-[#5e6ad2] text-[#fafaf8]">
          <SnowflakeLogo className="size-4" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold leading-4 text-[#1a1814]">
            Snowflake
          </span>
          <span className="block truncate text-[11px] leading-3 text-[#8a847a]">
            Social manager
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
              className={`relative flex min-h-7 items-center gap-[9px] rounded-md px-2 py-1.5 text-[12.5px] leading-4 transition-colors ${
                isActive
                  ? "bg-[#f4f2ed] font-medium text-[#1a1814] before:absolute before:-left-3 before:top-1.5 before:bottom-1.5 before:w-0.5 before:rounded-full before:bg-[#5e6ad2]"
                  : "text-[#59544c] hover:bg-[#f4f2ed] hover:text-[#1a1814]"
              }`}
            >
              <Icon className="size-[15px] shrink-0" strokeWidth={1.7} />
              <span className="truncate">{label}</span>
              {badge ? (
                <span className="ml-auto rounded-full bg-[#e8e5dd] px-1.5 py-px text-[10.5px] leading-4 text-[#59544c]">
                  {badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <section aria-label="Clients" className="flex flex-col gap-1">
        <div className="mb-1 flex items-center justify-between px-2 text-[10.5px] font-medium uppercase text-[#8a847a]">
          <h2>Clients</h2>
          <span>{accounts.length}</span>
        </div>

        <div className="flex min-h-8 items-center gap-2 rounded-md bg-[#f4f2ed] px-2 py-1.5 shadow-[inset_0_0_0_1px_#e7e3db]">
          <span className="grid size-[22px] shrink-0 place-items-center rounded-md border border-dashed border-[#d3cec3] text-[#59544c]">
            <LayoutGrid className="size-[13px]" strokeWidth={1.7} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12.5px] font-medium leading-4 text-[#1a1814]">
              All clients
            </span>
            <span className="block text-[10.5px] leading-4 text-[#8a847a]">
              {accounts.length} connected
            </span>
          </span>
        </div>

        {accounts.length === 0 ? (
          <p className="px-2 py-3 text-[12.5px] leading-5 text-[#8a847a]">
            No accounts connected yet
          </p>
        ) : (
          <ul className="flex flex-col gap-px">
            {visibleAccounts.map((account, index) => (
              <AccountRow key={account.id} account={account} index={index} />
            ))}
          </ul>
        )}

        {additionalAccounts.length > 0 ? (
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

      <footer className="mt-auto flex items-center gap-2 border-t border-[#e7e3db] px-1.5 pb-1 pt-3">
        <ProfileAvatar profile={profile} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-medium leading-4 text-[#1a1814]">
            {profileName}
          </span>
          <span className="block truncate text-[10.5px] leading-4 text-[#8a847a]">
            {profileDetail}
          </span>
        </span>
        <button
          type="button"
          aria-label="Settings"
          className="grid size-7 shrink-0 place-items-center rounded-md text-[#59544c] transition-colors hover:bg-[#f4f2ed] hover:text-[#1a1814]"
        >
          <Settings className="size-3.5" strokeWidth={1.7} />
        </button>
      </footer>
    </aside>
  );
}
