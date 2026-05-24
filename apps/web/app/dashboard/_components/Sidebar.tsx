import type { ComponentType, SVGProps } from "react";
import {
  CalendarClock,
  LayoutDashboard,
  Lightbulb,
  MessageSquareText,
  PieChart,
  Settings,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { UserProfile } from "@/lib/supabase/user-profile";

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
  href?: string;
};

const NAV_ITEMS: NavItem[] = [
  { key: "dashboard", label: "Dashboard", Icon: LayoutDashboard, href: "/dashboard" },
  { key: "scheduling", label: "Scheduling", Icon: CalendarClock, href: "/calendar" },
  { key: "analytics", label: "Analytics", Icon: PieChart, href: "/analytics" },
  { key: "chat", label: "Chat", Icon: MessageSquareText, href: "/chat" },
  { key: "snow-ai", label: "Snow AI", Icon: Lightbulb, href: "/chat-ai" },
];

function SnowflakeLogo() {
  return (
    <svg
      width="31"
      height="33"
      viewBox="0 0 31 33"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Logo"
      className="h-[33px] w-[31px]"
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

function getProfileInitial(profile?: UserProfile | null) {
  const label = profile?.name ?? profile?.email;
  return label?.trim().charAt(0).toUpperCase() || "G";
}

function ProfilePicture({ profile }: { profile?: UserProfile | null }) {
  const label = profile?.name ?? profile?.email ?? "Google account";

  return (
    <div
      className="flex size-9 items-center justify-center overflow-hidden rounded-full border border-card bg-card text-[13px] font-semibold text-ink"
      title={label}
    >
      {profile?.avatarUrl ? (
        <Image
          src={profile.avatarUrl}
          alt={`${label} profile picture`}
          width={36}
          height={36}
          className="size-full object-cover"
        />
      ) : (
        <span aria-hidden="true">{getProfileInitial(profile)}</span>
      )}
    </div>
  );
}

export function Sidebar({
  active = "dashboard",
  profile,
}: {
  active?: SidebarKey;
  profile?: UserProfile | null;
}) {
  return (
    <aside className="sticky top-0 flex h-screen w-[60px] shrink-0 flex-col items-center gap-3 bg-paper px-5 py-4">
      <div className="flex flex-col items-center justify-center pt-2 pb-6 text-cta">
        <SnowflakeLogo />
      </div>

      <nav aria-label="Primary" className="flex flex-col items-center gap-3">
        {NAV_ITEMS.map(({ key, label, Icon, href }) => {
          const isActive = key === active;
          const className = `flex size-9 items-center justify-center rounded-xl transition ${
            isActive ? "bg-card text-ink" : "text-muted hover:bg-card"
          }`;
          if (href) {
            return (
              <Link
                key={key}
                href={href}
                aria-label={label}
                aria-current={isActive ? "page" : undefined}
                className={className}
              >
                <Icon
                  className="size-[18px]"
                  strokeWidth={1.6}
                  aria-hidden="true"
                />
              </Link>
            );
          }
          return (
            <button
              key={key}
              type="button"
              aria-label={label}
              aria-current={isActive ? "page" : undefined}
              className={className}
            >
              <Icon
                className="size-[18px]"
                strokeWidth={1.6}
                aria-hidden="true"
              />
            </button>
          );
        })}
      </nav>

      <div className="flex-1" />

      <button
        type="button"
        aria-label="Settings (coming soon)"
        title="Settings (coming soon)"
        disabled
        aria-disabled="true"
        className="flex size-9 cursor-not-allowed items-center justify-center rounded-xl text-muted opacity-50"
      >
        <Settings className="size-6" strokeWidth={1.6} aria-hidden="true" />
      </button>
      <ProfilePicture profile={profile} />
    </aside>
  );
}
