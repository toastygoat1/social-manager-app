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

function BrandMark() {
  return (
    <span
      className="flex size-[22px] shrink-0 items-center justify-center rounded-[6px] bg-[#5b7cef] text-white"
      aria-hidden="true"
    >
      <svg viewBox="0 0 16 16" className="size-[13px]" fill="none">
        <path
          d="M8 3v10M3 8h10"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
        <circle cx="8" cy="3" r="1.2" fill="currentColor" />
        <circle cx="13" cy="8" r="1.2" fill="currentColor" />
        <circle cx="8" cy="13" r="1.2" fill="currentColor" />
        <circle cx="3" cy="8" r="1.2" fill="currentColor" />
      </svg>
    </span>
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
        <BrandMark />
        <div className="min-w-0">
          <p className="text-[11px] font-semibold leading-[12px] text-[#242321]">
            Halo
          </p>
          <p className="truncate text-[8px] leading-[10px] text-[#817d75]">
            Brightwater Agency
          </p>
        </div>
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
