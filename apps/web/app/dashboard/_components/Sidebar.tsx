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
import logo from "@/assets/img/logo.jpeg";
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
    <Image
      src={logo}
      alt="Logo"
      width={40}
      height={42}
      className="h-[42px] w-10 object-contain"
    />
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

      <nav className="flex flex-col items-center gap-3">
        {NAV_ITEMS.map(({ key, label, Icon, href }) => {
          const isActive = key === active;
          const className = `flex size-9 items-center justify-center rounded-xl transition ${
            isActive ? "bg-card text-ink" : "text-muted hover:bg-card"
          }`;
          if (href) {
            return (
              <Link key={key} href={href} aria-label={label} className={className}>
                <Icon className="size-[18px]" strokeWidth={1.6} />
              </Link>
            );
          }
          return (
            <button
              key={key}
              type="button"
              aria-label={label}
              className={className}
            >
              <Icon className="size-[18px]" strokeWidth={1.6} />
            </button>
          );
        })}
      </nav>

      <div className="flex-1" />

      <button
        type="button"
        aria-label="Settings"
        className="flex size-9 items-center justify-center rounded-xl text-muted hover:bg-card"
      >
        <Settings className="size-6" strokeWidth={1.6} />
      </button>
      <ProfilePicture profile={profile} />
    </aside>
  );
}
