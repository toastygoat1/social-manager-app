import type { ComponentType, SVGProps } from "react";
import {
  BarChart3,
  CalendarDays,
  ChevronDown,
  Home,
  Inbox,
  Sparkles,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { apiFetch } from "@/lib/api/client";
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

type SidebarProps = {
  active?: SidebarKey;
  accounts?: Account[];
  profile?: UserProfile | null;
};

const NAV_ITEMS: NavItem[] = [
  { key: "dashboard", label: "Overview", Icon: Home, href: "/dashboard" },
  { key: "scheduling", label: "Calendar", Icon: CalendarDays, href: "/calendar" },
  { key: "snow-ai", label: "Snow AI", Icon: Sparkles, href: "/chat-ai" },
  { key: "chat", label: "Inbox", Icon: Inbox, href: "/chat", badge: "24" },
  { key: "analytics", label: "Insights", Icon: BarChart3, href: "/analytics" },
];

type InstagramAccountResponse = {
  id: string;
  username: string;
  accountType: "PERSONAL" | "BUSINESS" | "CREATOR";
  avatarUrl?: string | null;
  isActive: boolean;
};

const VISIBLE_ACCOUNT_COUNT = 8;

function SnowflakeLogo() {
  return (
    <svg
      width="31"
      height="33"
      viewBox="0 0 31 33"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Snowflake logo"
      className="h-[33px] w-[31px] shrink-0"
    >
      <path d="M15.5 4.54004L15.5 27.8859" stroke="#3AC1D6" strokeWidth="2.09452" />
      <circle cx="15.4993" cy="2.91824" r="1.87098" stroke="#3AC1D6" strokeWidth="2.09452" />
      <path d="M15.499 27.6357C16.5322 27.6357 17.37 28.4736 17.3701 29.5068C17.3701 30.5401 16.5323 31.3779 15.499 31.3779C14.4658 31.3778 13.6279 30.5401 13.6279 29.5068C13.6281 28.4737 14.4659 27.6359 15.499 27.6357Z" stroke="#3AC1D6" strokeWidth="2.09452" />
      <path d="M5.3916 10.375L25.6098 22.048" stroke="#3AC1D6" strokeWidth="2.09452" />
      <circle cx="3.98639" cy="9.56466" r="1.87098" transform="rotate(-60 3.98639 9.56466)" stroke="#3AC1D6" strokeWidth="2.09452" />
      <path d="M25.392 21.9232C25.9086 21.0284 27.0531 20.7218 27.9479 21.2383C28.8428 21.7549 29.1495 22.8994 28.6328 23.7943C28.1161 24.6889 26.9716 24.9957 26.0768 24.4791C25.1822 23.9624 24.8755 22.8179 25.392 21.9232Z" stroke="#3AC1D6" strokeWidth="2.09452" />
      <path d="M25.6084 10.375L5.39025 22.048" stroke="#3AC1D6" strokeWidth="2.09452" />
      <circle cx="2.91824" cy="2.91824" r="1.87098" transform="matrix(-0.5 -0.866025 -0.866025 0.5 30.999 10.6328)" stroke="#3AC1D6" strokeWidth="2.09452" />
      <path d="M5.60705 21.9232C5.09044 21.0284 3.94593 20.7218 3.05109 21.2383C2.15621 21.7549 1.84957 22.8994 2.36622 23.7943C2.88294 24.6889 4.02739 24.9957 4.92218 24.4791C5.8168 23.9624 6.12347 22.8179 5.60705 21.9232Z" stroke="#3AC1D6" strokeWidth="2.09452" />
    </svg>
  );
}

function getAccountInitial(name: string) {
  return name.replace(/^@/, "").trim().charAt(0).toUpperCase() || "I";
}

function getProfileInitial(profile?: UserProfile | null) {
  const label = profile?.name ?? profile?.email;
  return label?.trim().charAt(0).toUpperCase() || "G";
}

async function getConnectedAccounts() {
  try {
    const accounts = await apiFetch<InstagramAccountResponse[]>("/instagram/accounts");

    return accounts
      .filter((account) => account.isActive)
      .map((account) => ({
        id: account.id,
        name: `@${account.username}`,
        platform:
          account.accountType === "CREATOR" ? "Instagram Creator" : "Instagram",
        avatarUrl: account.avatarUrl ?? null,
      }));
  } catch {
    return [];
  }
}

function AccountRow({ account }: { account: Account }) {
  return (
    <li className="flex h-12 items-center gap-3 rounded-lg px-2 transition-colors hover:bg-[#f7f5f1]">
      <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#3ac1d6] text-xs font-semibold text-white">
        {account.avatarUrl ? (
          <Image
            src={account.avatarUrl}
            alt=""
            width={32}
            height={32}
            className="size-full object-cover"
          />
        ) : (
          getAccountInitial(account.name)
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium leading-5 text-[#292824]">
          {account.name}
        </span>
        <span className="block truncate text-xs leading-4 text-[#817d75]">
          {account.platform}
        </span>
      </span>
      <span className="text-[10px] font-medium text-[#8e8a82]">
        IG
      </span>
    </li>
  );
}

function GoogleAccount({ profile }: { profile?: UserProfile | null }) {
  const name = profile?.name ?? profile?.email ?? "Google account";

  return (
    <footer className="mt-auto border-t border-[#eeeae4] pt-4">
      <div className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-[#f7f5f1]">
        <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#f1eeea] text-sm font-semibold text-[#57524b]">
          {profile?.avatarUrl ? (
            <Image
              src={profile.avatarUrl}
              alt={`${name} profile picture`}
              width={40}
              height={40}
              className="size-full object-cover"
            />
          ) : (
            getProfileInitial(profile)
          )}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium leading-5 text-[#292824]">
            {name}
          </span>
          {profile?.email && profile.name ? (
            <span className="block truncate text-xs leading-4 text-[#817d75]">
              {profile.email}
            </span>
          ) : null}
        </span>
      </div>
    </footer>
  );
}

export async function Sidebar({
  active = "dashboard",
  accounts: providedAccounts,
  profile,
}: SidebarProps) {
  const accounts = providedAccounts ?? (await getConnectedAccounts());
  const visibleAccounts = accounts.slice(0, VISIBLE_ACCOUNT_COUNT);
  const additionalAccounts = accounts.slice(VISIBLE_ACCOUNT_COUNT);

  return (
    <aside className="sticky top-0 flex h-screen w-[236px] shrink-0 flex-col overflow-y-auto border-r border-[#eeeae4] bg-[#fffefa] px-4 py-5 font-sans">
      <header className="mb-8 flex items-center gap-3 px-2">
        <SnowflakeLogo />
        <p className="text-lg font-semibold leading-none text-[#242321]">
          Snowflake
        </p>
      </header>

      <nav aria-label="Primary" className="flex flex-col gap-1.5">
        {NAV_ITEMS.map(({ key, label, Icon, href, badge }) => {
          const isActive = key === active;

          return (
            <Link
              key={key}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={`relative flex h-11 items-center gap-3 rounded-lg px-3 text-sm transition-colors ${
                isActive
                  ? "bg-[#f5f3ef] font-medium text-[#292824]"
                  : "text-[#5d5953] hover:bg-[#f7f5f1] hover:text-[#292824]"
              }`}
            >
              {isActive ? (
                <span className="absolute -left-4 top-1/2 h-7 w-[3px] -translate-y-1/2 rounded-r-full bg-[#5b7cef]" />
              ) : null}
              <Icon className="size-[18px] shrink-0" strokeWidth={1.8} />
              <span>{label}</span>
              {badge ? (
                <span className="ml-auto rounded-full bg-[#ede9e0] px-2 py-0.5 text-xs leading-4 text-[#77726b]">
                  {badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <section className="mt-8" aria-label="Accounts">
        <div className="mb-3 flex items-center justify-between px-2">
          <h2 className="text-xs font-medium tracking-[0.13em] text-[#8a867e]">
            ACCOUNTS
          </h2>
          <span className="text-xs text-[#8a867e]">{accounts.length}</span>
        </div>
        <div className="mb-2 flex h-14 items-center gap-3 rounded-lg border border-[#e6e1da] bg-[#f8f6f2] px-3">
          <span className="flex size-8 items-center justify-center rounded-lg border border-[#e1dcd4] text-sm font-semibold text-[#756f66]">
            #
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium leading-5 text-[#292824]">
              All accounts
            </p>
            <p className="text-xs leading-4 text-[#817d75]">
              {accounts.length} connected
            </p>
          </div>
        </div>

        {accounts.length === 0 ? (
          <p className="px-2 py-4 text-sm leading-5 text-[#817d75]">
            No accounts connected yet
          </p>
        ) : (
          <ul>
            {visibleAccounts.map((account) => (
              <AccountRow key={account.id} account={account} />
            ))}
          </ul>
        )}

        {additionalAccounts.length > 0 ? (
          <details className="group mt-2">
            <summary className="flex h-10 cursor-pointer list-none items-center gap-2 rounded-lg px-2 text-sm text-[#393733] transition-colors hover:bg-[#f7f5f1] [&::-webkit-details-marker]:hidden">
              <ChevronDown
                className="size-4 shrink-0 transition-transform group-open:rotate-180"
                strokeWidth={1.8}
              />
              <span className="group-open:hidden">
                Show {additionalAccounts.length} more
              </span>
              <span className="hidden group-open:inline">Show less</span>
            </summary>
            <ul className="mt-1">
              {additionalAccounts.map((account) => (
                <AccountRow key={account.id} account={account} />
              ))}
            </ul>
          </details>
        ) : null}
      </section>

      <GoogleAccount profile={profile} />
    </aside>
  );
}
