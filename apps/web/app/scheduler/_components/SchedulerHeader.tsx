"use client";

import { type ReactNode, useState } from "react";
import {
  CalendarDays,
  CalendarRange,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Image as ImageIcon,
  List,
  Plus,
  PlusSquare,
  SlidersHorizontal,
  Users,
  X,
} from "lucide-react";
import { AvatarImage } from "@/app/_components/AvatarImage";
import { CreatePostModal, type CreatePostType } from "./CreatePostModal";
import {
  formatPeriodLabel,
  type EventStatus,
  type SchedulerPostType,
} from "./data";
import {
  SCHEDULER_POST_TYPE_STYLE,
  SCHEDULER_STATUS_STYLE,
} from "./scheduler-styles";

export type SchedulerView = "month" | "week" | "list";

export type SchedulerFilterState = {
  postTypes: SchedulerPostType[];
  statuses: EventStatus[];
  accountIds: string[];
};

export type SchedulerFilterAccountOption = {
  id: string;
  label: string;
  avatarUrl: string | null;
};

type Props = {
  view: SchedulerView;
  onViewChange: (view: SchedulerView) => void;
  onPrev: () => void;
  onNext: () => void;
  onCreated: () => void;
  referenceIso: string;
  filters: SchedulerFilterState;
  filterAccounts: SchedulerFilterAccountOption[];
  onFilterToggle: (
    group: keyof SchedulerFilterState,
    value: SchedulerFilterState[keyof SchedulerFilterState][number],
  ) => void;
  onClearContentFilters: () => void;
  onClearAccountFilters: () => void;
};

const CREATE_OPTIONS: {
  Icon: typeof ImageIcon;
  label: string;
  body: string;
  type: CreatePostType;
}[] = [
  {
    Icon: ImageIcon,
    label: "Post",
    body: "Schedule a single feed image",
    type: "post",
  },
  {
    Icon: ImageIcon,
    label: "Carousel",
    body: "Schedule multiple images or mixed media",
    type: "carousel",
  },
  {
    Icon: PlusSquare,
    label: "Story",
    body: "Schedule an Instagram story",
    type: "story",
  },
  {
    Icon: Clapperboard,
    label: "Reel",
    body: "Schedule a short video",
    type: "reels",
  },
];

const VIEW_OPTIONS: {
  view: SchedulerView;
  label: string;
  Icon: typeof CalendarDays;
}[] = [
  { view: "month", label: "Month view", Icon: CalendarDays },
  { view: "week", label: "Week view", Icon: CalendarRange },
  { view: "list", label: "List view", Icon: List },
];

const POST_TYPE_OPTIONS: SchedulerPostType[] = [
  "FEED",
  "CAROUSEL",
  "REEL",
  "STORY",
];

const STATUS_OPTIONS: EventStatus[] = [
  "scheduled",
  "published",
  "pending",
  "draft",
  "removed",
];

export function SchedulerHeader({
  view,
  onViewChange,
  onPrev,
  onNext,
  onCreated,
  referenceIso,
  filters,
  filterAccounts,
  onFilterToggle,
  onClearContentFilters,
  onClearAccountFilters,
}: Props) {
  const [createOpen, setCreateOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [accountsOpen, setAccountsOpen] = useState(false);
  const [modalType, setModalType] = useState<CreatePostType | null>(null);
  const periodLabel = formatPeriodLabel(view, new Date(referenceIso));
  const activeFilterCount = filters.postTypes.length + filters.statuses.length;
  const activeAccountCount = filters.accountIds.length;

  return (
    <header className="relative z-20 shrink-0 border-b border-[#e8e3da] bg-[#fffdf9]">
      <div className="grid min-h-[74px] grid-cols-1 items-center gap-3 px-4 py-3 md:grid-cols-[minmax(180px,1fr)_auto_minmax(180px,1fr)] lg:px-6">
        <DateHeader referenceIso={referenceIso} />

        <div className="flex items-center justify-center gap-1.5">
          <button
            type="button"
            aria-label="Previous period"
            onClick={onPrev}
            className="flex size-8 items-center justify-center rounded-md border border-[#e7e1d6] bg-paper text-[#6d665d] hover:bg-[#f4f1eb]"
          >
            <ChevronLeft className="size-3.5" />
          </button>
          <h1 className="min-w-[168px] text-center text-[20px] font-normal tracking-[-0.01em] text-[#171510] [font-family:Georgia,serif]">
            {periodLabel}
          </h1>
          <button
            type="button"
            aria-label="Next period"
            onClick={onNext}
            className="flex size-8 items-center justify-center rounded-md border border-[#e7e1d6] bg-paper text-[#6d665d] hover:bg-[#f4f1eb]"
          >
            <ChevronRight className="size-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-2 md:justify-end">
          <div className="flex h-8 overflow-hidden rounded-md border border-[#e7e1d6] bg-paper">
            {VIEW_OPTIONS.map(({ view: optionView, label, Icon }, index) => (
              <ViewButton
                key={optionView}
                label={label}
                Icon={Icon}
                selected={view === optionView}
                onClick={() => onViewChange(optionView)}
                divided={index > 0}
              />
            ))}
          </div>

          <div className="relative">
            <button
              type="button"
              aria-expanded={filterOpen}
              onClick={() => {
                setFilterOpen((open) => !open);
                setAccountsOpen(false);
                setCreateOpen(false);
              }}
              className={`flex h-8 items-center gap-1.5 rounded-md border px-3 text-[11px] font-semibold transition-colors ${
                activeFilterCount > 0
                  ? "border-[#171510] bg-[#171510] text-white"
                  : "border-[#d8d8d8] bg-[#f8f8f8] text-[#3f3f3f] hover:bg-[#eeeeee]"
              }`}
            >
              <SlidersHorizontal className="size-3.5" strokeWidth={2} />
              Filter
              {activeFilterCount > 0 ? (
                <span className="flex min-w-4 items-center justify-center rounded-full bg-white px-1 text-[9px] font-bold text-[#171510]">
                  {activeFilterCount}
                </span>
              ) : null}
            </button>

            {filterOpen ? (
              <div className="scheduler-create-menu absolute right-0 top-[38px] z-30 w-[292px] rounded-lg border border-[#d8d8d8] bg-paper p-3 shadow-lg">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold text-[#171510]">
                    Filter posts
                  </p>
                  {activeFilterCount > 0 ? (
                    <button
                      type="button"
                      onClick={onClearContentFilters}
                      className="flex h-7 items-center gap-1 rounded-md border border-[#d8d8d8] px-2 text-[10px] font-medium text-[#555555] hover:bg-[#f3f3f3]"
                    >
                      <X className="size-3" />
                      Clear
                    </button>
                  ) : null}
                </div>

                <FilterGroup title="Post type">
                  {POST_TYPE_OPTIONS.map((postType) => {
                    const style = SCHEDULER_POST_TYPE_STYLE[postType];
                    return (
                      <FilterChip
                        key={postType}
                        label={style.label}
                        selected={filters.postTypes.includes(postType)}
                        color={style.color}
                        onClick={() => onFilterToggle("postTypes", postType)}
                      />
                    );
                  })}
                </FilterGroup>

                <FilterGroup title="Status">
                  {STATUS_OPTIONS.map((status) => {
                    const style = SCHEDULER_STATUS_STYLE[status];
                    return (
                      <FilterChip
                        key={status}
                        label={style.label}
                        selected={filters.statuses.includes(status)}
                        selectedClassName={style.chip}
                        onClick={() => onFilterToggle("statuses", status)}
                      />
                    );
                  })}
                </FilterGroup>
              </div>
            ) : null}
          </div>

          <div className="relative">
            <button
              type="button"
              aria-expanded={accountsOpen}
              onClick={() => {
                setAccountsOpen((open) => !open);
                setFilterOpen(false);
                setCreateOpen(false);
              }}
              className={`flex h-8 items-center gap-1.5 rounded-md border px-3 text-[11px] font-semibold transition-colors ${
                activeAccountCount > 0
                  ? "border-[#171510] bg-[#171510] text-white"
                  : "border-[#d8d8d8] bg-[#f8f8f8] text-[#3f3f3f] hover:bg-[#eeeeee]"
              }`}
            >
              <Users className="size-3.5" strokeWidth={2} />
              Accounts
              {activeAccountCount > 0 ? (
                <span className="flex min-w-4 items-center justify-center rounded-full bg-white px-1 text-[9px] font-bold text-[#171510]">
                  {activeAccountCount}
                </span>
              ) : null}
            </button>

            {accountsOpen ? (
              <div className="scheduler-create-menu absolute right-0 top-[38px] z-30 w-[292px] rounded-lg border border-[#d8d8d8] bg-paper p-3 shadow-lg">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold text-[#171510]">
                    Filter accounts
                  </p>
                  {activeAccountCount > 0 ? (
                    <button
                      type="button"
                      onClick={onClearAccountFilters}
                      className="flex h-7 items-center gap-1 rounded-md border border-[#d8d8d8] px-2 text-[10px] font-medium text-[#555555] hover:bg-[#f3f3f3]"
                    >
                      <X className="size-3" />
                      Clear
                    </button>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {filterAccounts.length > 0 ? (
                    filterAccounts.map((account) => (
                      <AccountFilterChip
                        key={account.id}
                        account={account}
                        selected={filters.accountIds.includes(account.id)}
                        onClick={() => onFilterToggle("accountIds", account.id)}
                      />
                    ))
                  ) : (
                    <span className="text-[11px] text-[#777777]">
                      No accounts in this period
                    </span>
                  )}
                </div>
              </div>
            ) : null}
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setCreateOpen((open) => !open);
                setFilterOpen(false);
                setAccountsOpen(false);
              }}
              className="flex h-8 items-center gap-1.5 rounded-md bg-[#141310] px-3 text-[11px] font-semibold text-white transition-transform duration-150 active:scale-[0.97]"
            >
              <Plus className="size-3" strokeWidth={2.5} />
              Create
              <ChevronDown
                className={`size-3 transition-transform duration-150 ${
                  createOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {createOpen ? (
              <div className="scheduler-create-menu absolute right-0 top-[38px] z-30 flex w-[256px] flex-col gap-1 rounded-lg border border-[#e8e3da] bg-paper p-2 shadow-lg">
                {CREATE_OPTIONS.map(({ Icon, label, body, type }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => {
                      setModalType(type);
                      setCreateOpen(false);
                    }}
                    className="flex items-center gap-3 rounded-md px-3 py-2.5 text-left hover:bg-[#f7f5f0]"
                  >
                    <Icon className="size-4 text-[#514b42]" strokeWidth={1.8} />
                    <span className="flex flex-col gap-0.5">
                      <span className="text-xs font-semibold text-ink">
                        {label}
                      </span>
                      <span className="text-[10px] text-muted">{body}</span>
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <CreatePostModal
        open={modalType !== null}
        type={modalType ?? "post"}
        defaultScheduledIso={referenceIso}
        onClose={() => setModalType(null)}
        onCreated={onCreated}
      />
    </header>
  );
}

function DateHeader({ referenceIso }: { referenceIso: string }) {
  const reference = new Date(referenceIso);
  const month = reference
    .toLocaleDateString("en-US", { month: "short" })
    .toUpperCase();
  const day = reference.toLocaleDateString("en-US", { day: "numeric" });
  const fullDate = reference.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const weekday = reference.toLocaleDateString("en-US", { weekday: "long" });

  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="flex h-[56px] w-[56px] shrink-0 flex-col overflow-hidden rounded-md border border-[#e4dfd6] bg-[#fffdf9] text-center">
        <span className="flex h-6 items-center justify-center bg-[#f1f0ed] text-[13px] font-medium tracking-[0.03em] text-[#5f5a52]">
          {month}
        </span>
        <span className="flex flex-1 items-center justify-center text-[18px] font-semibold text-[#15130f]">
          {day}
        </span>
      </div>
      <div className="min-w-0">
        <h1 className="truncate text-[18px] font-semibold tracking-[-0.02em] text-[#171510]">
          {fullDate}
        </h1>
        <p className="mt-0.5 truncate text-sm text-[#5f5a52]">{weekday}</p>
      </div>
    </div>
  );
}

function ViewButton({
  label,
  Icon,
  selected,
  onClick,
  divided = false,
}: {
  label: string;
  Icon: typeof CalendarDays;
  selected: boolean;
  onClick: () => void;
  divided?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={selected}
      onClick={onClick}
      title={label}
      className={`flex size-8 items-center justify-center ${divided ? "border-l border-[#e7e1d6]" : ""} ${
        selected
          ? "bg-[#f5f1e9] font-semibold text-[#27231c]"
          : "bg-paper text-[#736c62]"
      }`}
    >
      <Icon className="size-4" strokeWidth={1.8} />
    </button>
  );
}

function FilterGroup({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="border-t border-[#eeeeee] py-3 first:border-t-0 first:pt-0 last:pb-0">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#777777]">
        {title}
      </p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function FilterChip({
  label,
  selected,
  color,
  selectedClassName,
  onClick,
}: {
  label: string;
  selected: boolean;
  color?: string;
  selectedClassName?: string;
  onClick: () => void;
}) {
  const colorStyle =
    color && selected
      ? { backgroundColor: color, borderColor: color, color: "#ffffff" }
      : color
        ? {
            backgroundColor: `${color}12`,
            borderColor: `${color}55`,
            color,
          }
        : undefined;

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`rounded-full border px-2.5 py-1 text-[10px] font-medium transition-colors ${
        selected
          ? (selectedClassName ?? "border-[#171510] bg-[#171510] text-white")
          : "border-[#d8d8d8] bg-[#f8f8f8] text-[#555555] hover:bg-[#eeeeee]"
      }`}
      style={colorStyle}
    >
      {label}
    </button>
  );
}

function AccountFilterChip({
  account,
  selected,
  onClick,
}: {
  account: SchedulerFilterAccountOption;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`inline-flex max-w-full items-center gap-1.5 rounded-full border py-1 pl-1 pr-2.5 text-[10px] font-medium transition-colors ${
        selected
          ? "border-[#171510] bg-[#171510] text-white"
          : "border-[#d8d8d8] bg-[#f8f8f8] text-[#555555] hover:bg-[#eeeeee]"
      }`}
      title={account.label}
    >
      <AvatarImage
        src={account.avatarUrl}
        alt={account.label}
        width={20}
        height={20}
        className="size-5 rounded-full object-cover"
        fallback={account.label}
      />
      <span className="max-w-[116px] truncate">{account.label}</span>
    </button>
  );
}
