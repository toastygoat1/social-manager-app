import type { ComponentType, SVGProps } from "react";
import {
  BarChart3,
  CalendarDays,
  ChevronDown,
  Home,
  Inbox,
  PenLine,
} from "lucide-react";
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
  href: string;
  badge?: string;
};

type Client = {
  name: string;
  summary: string;
  initials: string;
  channel: string;
  color: string;
};

type SidebarProps = {
  active?: SidebarKey;
  profile?: UserProfile | null;
};

const NAV_ITEMS: NavItem[] = [
  { key: "dashboard", label: "Overview", Icon: Home, href: "/dashboard" },
  { key: "scheduling", label: "Calendar", Icon: CalendarDays, href: "/calendar" },
  { key: "snow-ai", label: "Composer", Icon: PenLine, href: "/chat-ai" },
  { key: "chat", label: "Inbox", Icon: Inbox, href: "/chat", badge: "24" },
  { key: "analytics", label: "Insights", Icon: BarChart3, href: "/analytics" },
];

const CLIENTS: Client[] = [
  {
    name: "Ambacafe",
    summary: "F&B - 48.2K",
    initials: "A",
    channel: "IG",
    color: "bg-[#e88866]",
  },
  {
    name: "StarCoffee",
    summary: "F&B - 124.8K",
    initials: "S",
    channel: "IG",
    color: "bg-[#ce6248]",
  },
  {
    name: "Lume Studios",
    summary: "Creative - 22.1K",
    initials: "LS",
    channel: "IG",
    color: "bg-[#8585e4]",
  },
  {
    name: "North Bakery",
    summary: "F&B - 91.3K",
    initials: "NB",
    channel: "IG",
    color: "bg-[#cfac66]",
  },
  {
    name: "Nomad Tea Co",
    summary: "F&B - 18.9K",
    initials: "NT",
    channel: "IG",
    color: "bg-[#69a682]",
  },
  {
    name: "Maven Yoga",
    summary: "Wellness - 65.4K",
    initials: "MY",
    channel: "IG",
    color: "bg-[#b87aa9]",
  },
  {
    name: "Hive Hardware",
    summary: "Retail - 9.8K",
    initials: "HH",
    channel: "LI",
    color: "bg-[#d7a646]",
  },
  {
    name: "Tactile Print",
    summary: "Creative - 14.2K",
    initials: "TP",
    channel: "IG",
    color: "bg-[#57768d]",
  },
  {
    name: "Brume Skincare",
    summary: "Beauty - 32.1K",
    initials: "BS",
    channel: "IG",
    color: "bg-[#b3796d]",
  },
  {
    name: "Olive Studio",
    summary: "Creative - 8.2K",
    initials: "OS",
    channel: "IG",
    color: "bg-[#858c6d]",
  },
  {
    name: "Forge Fitness",
    summary: "Wellness - 51.7K",
    initials: "FF",
    channel: "IG",
    color: "bg-[#5b8790]",
  },
  {
    name: "Cove Living",
    summary: "Home - 11.9K",
    initials: "CL",
    channel: "LI",
    color: "bg-[#607ba9]",
  },
  {
    name: "Bloom Florals",
    summary: "Retail - 24.6K",
    initials: "BF",
    channel: "IG",
    color: "bg-[#c47b99]",
  },
  {
    name: "Atelier Home",
    summary: "Home - 17.4K",
    initials: "AH",
    channel: "IG",
    color: "bg-[#ad7c60]",
  },
];

const VISIBLE_CLIENT_COUNT = 8;

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
      className="h-[25px] w-[24px] shrink-0"
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

function ClientRow({ client }: { client: Client }) {
  return (
    <li className="flex h-[31px] items-center gap-2 px-1">
      <span
        className={`flex size-[18px] shrink-0 items-center justify-center rounded-[5px] text-[7px] font-semibold text-white ${client.color}`}
      >
        {client.initials}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[10px] font-medium leading-[12px] text-[#292824]">
          {client.name}
        </span>
        <span className="block truncate text-[8px] leading-[10px] text-[#817d75]">
          {client.summary}
        </span>
      </span>
      <span className="self-start pt-[6px] text-[7px] font-medium text-[#8e8a82]">
        {client.channel}
      </span>
    </li>
  );
}

export function Sidebar({ active = "dashboard" }: SidebarProps) {
  const visibleClients = CLIENTS.slice(0, VISIBLE_CLIENT_COUNT);
  const additionalClients = CLIENTS.slice(VISIBLE_CLIENT_COUNT);

  return (
    <aside className="sticky top-0 flex h-screen w-[180px] shrink-0 flex-col overflow-y-auto border-r border-[#eeeae4] bg-[#fffefa] px-[13px] py-4 font-sans">
      <header className="mb-[21px] flex items-center gap-2 px-0.5">
        <SnowflakeLogo />
        <p className="text-[12px] font-semibold leading-none text-[#242321]">
          Snowflake
        </p>
      </header>

      <nav aria-label="Primary" className="flex flex-col gap-1">
        {NAV_ITEMS.map(({ key, label, Icon, href, badge }) => {
          const isActive = key === active;

          return (
            <Link
              key={key}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={`relative flex h-[25px] items-center gap-[9px] rounded-[5px] px-[7px] text-[10px] transition-colors ${
                isActive
                  ? "bg-[#f5f3ef] font-medium text-[#292824]"
                  : "text-[#5d5953] hover:bg-[#f7f5f1] hover:text-[#292824]"
              }`}
            >
              {isActive ? (
                <span className="absolute -left-[13px] top-1/2 h-[17px] w-[2px] -translate-y-1/2 rounded-r-full bg-[#5b7cef]" />
              ) : null}
              <Icon className="size-[12px] shrink-0" strokeWidth={1.8} />
              <span>{label}</span>
              {badge ? (
                <span className="ml-auto rounded-full bg-[#ede9e0] px-[5px] py-[1px] text-[8px] leading-[10px] text-[#77726b]">
                  {badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <section className="mt-[24px]" aria-label="Clients">
        <div className="mb-2 flex items-center justify-between px-1">
          <h2 className="text-[8px] font-medium tracking-[0.13em] text-[#8a867e]">
            CLIENTS
          </h2>
          <span className="text-[8px] text-[#8a867e]">{CLIENTS.length}</span>
        </div>
        <div className="mb-[5px] flex h-[35px] items-center gap-2 rounded-[6px] border border-[#e6e1da] bg-[#f8f6f2] px-[7px]">
          <span className="flex size-[18px] items-center justify-center rounded-[5px] border border-[#e1dcd4] text-[9px] font-semibold text-[#756f66]">
            #
          </span>
          <div className="min-w-0">
            <p className="truncate text-[10px] font-medium leading-[12px] text-[#292824]">
              All clients
            </p>
            <p className="text-[8px] leading-[10px] text-[#817d75]">
              14 accounts
            </p>
          </div>
        </div>

        <ul>
          {visibleClients.map((client) => (
            <ClientRow key={client.name} client={client} />
          ))}
        </ul>

        <details className="group mt-1">
          <summary className="flex h-[27px] cursor-pointer list-none items-center gap-[7px] rounded-[5px] px-1 text-[9px] text-[#393733] transition-colors hover:bg-[#f7f5f1] [&::-webkit-details-marker]:hidden">
            <ChevronDown
              className="size-[12px] shrink-0 transition-transform group-open:rotate-180"
              strokeWidth={1.8}
            />
            <span className="group-open:hidden">
              Show {additionalClients.length} more
            </span>
            <span className="hidden group-open:inline">Show less</span>
          </summary>
          <ul className="mt-1">
            {additionalClients.map((client) => (
              <ClientRow key={client.name} client={client} />
            ))}
          </ul>
        </details>
      </section>
    </aside>
  );
}
