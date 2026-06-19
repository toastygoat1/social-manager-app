"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
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
  Search,
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

const HEADER_ACTION_BUTTON_MOTION =
  "transition-[color,background-color,border-color,transform] duration-150 active:scale-[0.97]";

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
  const [accountSearch, setAccountSearch] = useState("");
  const [modalType, setModalType] = useState<CreatePostType | null>(null);
  const filterRef = useRef<HTMLDivElement>(null);
  const accountsRef = useRef<HTMLDivElement>(null);
  const createRef = useRef<HTMLDivElement>(null);
  const periodLabel = formatPeriodLabel(view, new Date(referenceIso));
  const activeFilterCount = filters.postTypes.length + filters.statuses.length;
  const activeAccountCount = filters.accountIds.length;
  const selectedFilterAccounts = filterAccounts.filter((account) =>
    filters.accountIds.includes(account.id),
  );
  const accountButtonPreviewAccounts = selectedFilterAccounts.slice(0, 1);
  const hiddenAccountCount = Math.max(
    activeAccountCount - accountButtonPreviewAccounts.length,
    0,
  );
  const normalizedAccountSearch = accountSearch.trim().toLowerCase();
  const visibleFilterAccounts = normalizedAccountSearch
    ? filterAccounts.filter((account) => {
        const label = account.label.toLowerCase();
        return (
          label.includes(normalizedAccountSearch) ||
          label.replace(/^@/, "").includes(normalizedAccountSearch)
        );
      })
    : filterAccounts;

  useEffect(() => {
    if (!createOpen && !filterOpen && !accountsOpen) return;

    function closeMenus() {
      setCreateOpen(false);
      setFilterOpen(false);
      setAccountsOpen(false);
      setAccountSearch("");
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;

      if (
        filterRef.current?.contains(target) ||
        accountsRef.current?.contains(target) ||
        createRef.current?.contains(target)
      ) {
        return;
      }

      closeMenus();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeMenus();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [accountsOpen, createOpen, filterOpen]);

  return (
    <header className="relative z-20 shrink-0 border-b border-line bg-paper">
      <div className="grid min-h-[74px] grid-cols-1 items-center gap-3 px-4 py-3 md:grid-cols-[minmax(180px,1fr)_auto_minmax(180px,1fr)] lg:px-6">
        <DateHeader referenceIso={referenceIso} />

        <div className="flex items-center justify-center gap-1.5">
          <button
            type="button"
            aria-label="Previous period"
            onClick={onPrev}
            className="flex size-8 items-center justify-center rounded-md border border-line bg-paper text-muted transition-colors hover:bg-card hover:text-ink"
          >
            <ChevronLeft className="size-3.5" />
          </button>
          <h1 className="min-w-[168px] text-center text-[20px] font-normal tracking-[-0.01em] text-ink [font-family:Georgia,serif]">
            {periodLabel}
          </h1>
          <button
            type="button"
            aria-label="Next period"
            onClick={onNext}
            className="flex size-8 items-center justify-center rounded-md border border-line bg-paper text-muted transition-colors hover:bg-card hover:text-ink"
          >
            <ChevronRight className="size-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-2 md:justify-end">
          <div ref={filterRef} className="relative">
            <button
              type="button"
              aria-expanded={filterOpen}
              onClick={() => {
                setFilterOpen((open) => !open);
                setAccountsOpen(false);
                setAccountSearch("");
                setCreateOpen(false);
              }}
              className={`flex h-8 items-center gap-1.5 rounded-md border px-3 text-[11px] font-semibold ${HEADER_ACTION_BUTTON_MOTION} ${
                activeFilterCount > 0
                  ? "border-ink bg-ink text-page"
                  : "border-line bg-card text-ink hover:bg-page"
              }`}
            >
              <SlidersHorizontal className="size-3.5" strokeWidth={2} />
              Filter
              {activeFilterCount > 0 ? (
                <span className="flex min-w-4 items-center justify-center rounded-full bg-page px-1 text-[9px] font-bold text-ink">
                  {activeFilterCount}
                </span>
              ) : null}
            </button>

            {filterOpen ? (
              <div className="scheduler-create-menu absolute right-0 top-[38px] z-30 w-[292px] rounded-lg border border-line bg-paper p-3 shadow-lg">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold text-ink">
                    Filter posts
                  </p>
                  <button
                    type="button"
                    aria-hidden={activeFilterCount === 0}
                    tabIndex={activeFilterCount > 0 ? undefined : -1}
                    onClick={onClearContentFilters}
                    className={`flex h-7 items-center gap-1 rounded-md border border-line px-2 text-[10px] font-medium text-muted transition-colors hover:bg-card hover:text-ink ${
                      activeFilterCount > 0
                        ? ""
                        : "invisible pointer-events-none"
                    }`}
                  >
                    <X className="size-3" />
                    Clear
                  </button>
                </div>

                <FilterGroup title="Post type">
                  {POST_TYPE_OPTIONS.map((postType) => {
                    const style = SCHEDULER_POST_TYPE_STYLE[postType];
                    return (
                      <FilterChip
                        key={postType}
                        label={style.label}
                        selected={filters.postTypes.includes(postType)}
                        selectedClassName={style.chip}
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

          <div ref={accountsRef} className="relative">
            <button
              type="button"
              aria-expanded={accountsOpen}
              aria-label={
                activeAccountCount > 0
                  ? `Filter accounts, ${activeAccountCount} selected`
                  : "Filter accounts"
              }
              onClick={() => {
                setAccountsOpen(!accountsOpen);
                if (accountsOpen) setAccountSearch("");
                setFilterOpen(false);
                setCreateOpen(false);
              }}
              className={`flex h-8 items-center rounded-md border border-line bg-card text-[11px] font-semibold text-ink hover:bg-page ${HEADER_ACTION_BUTTON_MOTION} ${
                activeAccountCount > 0
                  ? "w-[124px] justify-start gap-2 px-2.5"
                  : "justify-center gap-1.5 px-3"
              }`}
            >
              {activeAccountCount > 0 ? (
                <>
                  <AccountButtonPreview
                    accounts={accountButtonPreviewAccounts}
                    hiddenCount={hiddenAccountCount}
                  />
                  <span>Accounts</span>
                </>
              ) : (
                <>
                  <Users className="size-3.5" strokeWidth={2} />
                  <span>Accounts</span>
                </>
              )}
            </button>

            {accountsOpen ? (
              <div className="scheduler-create-menu absolute right-0 top-[38px] z-30 w-[292px] rounded-lg border border-line bg-paper p-3 shadow-lg">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold text-ink">
                    Filter accounts
                  </p>
                  <button
                    type="button"
                    aria-hidden={activeAccountCount === 0}
                    tabIndex={activeAccountCount > 0 ? undefined : -1}
                    onClick={onClearAccountFilters}
                    className={`flex h-7 items-center gap-1 rounded-md border border-line px-2 text-[10px] font-medium text-muted transition-colors hover:bg-card hover:text-ink ${
                      activeAccountCount > 0
                        ? ""
                        : "invisible pointer-events-none"
                    }`}
                  >
                    <X className="size-3" />
                    Clear
                  </button>
                </div>

                <label className="mb-3 flex h-8 items-center gap-2 rounded-md border border-line bg-card px-2.5 text-muted focus-within:border-ink focus-within:bg-paper">
                  <Search className="size-3.5 shrink-0" strokeWidth={1.8} />
                  <input
                    type="search"
                    value={accountSearch}
                    onChange={(event) => setAccountSearch(event.target.value)}
                    placeholder="Search accounts"
                    className="min-w-0 flex-1 bg-transparent text-[11px] text-ink outline-none placeholder:text-muted"
                  />
                </label>

                <div className="flex flex-wrap gap-1.5">
                  {visibleFilterAccounts.length > 0 ? (
                    visibleFilterAccounts.map((account) => (
                      <AccountFilterChip
                        key={account.id}
                        account={account}
                        selected={filters.accountIds.includes(account.id)}
                        onClick={() => onFilterToggle("accountIds", account.id)}
                      />
                    ))
                  ) : (
                    <span className="text-[11px] text-muted">
                      {filterAccounts.length > 0
                        ? "No matching accounts"
                        : "No accounts in this period"}
                    </span>
                  )}
                </div>
              </div>
            ) : null}
          </div>

          <div className="flex h-8 overflow-hidden rounded-md border border-line bg-paper">
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

          <div ref={createRef} className="relative">
            <button
              type="button"
              onClick={() => {
                setCreateOpen((open) => !open);
                setFilterOpen(false);
                setAccountsOpen(false);
                setAccountSearch("");
              }}
              className={`flex h-8 items-center gap-1.5 rounded-md bg-ink px-3 text-[11px] font-semibold text-page ${HEADER_ACTION_BUTTON_MOTION}`}
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
              <div className="scheduler-create-menu absolute right-0 top-[38px] z-30 flex w-[256px] flex-col gap-1 rounded-lg border border-line bg-paper p-2 shadow-lg">
                {CREATE_OPTIONS.map(({ Icon, label, body, type }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => {
                      setModalType(type);
                      setCreateOpen(false);
                    }}
                    className="flex items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors hover:bg-card"
                  >
                    <Icon className="size-4 text-muted" strokeWidth={1.8} />
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
      <div className="flex h-[56px] w-[56px] shrink-0 flex-col overflow-hidden rounded-md border border-line bg-paper text-center">
        <span className="flex h-6 items-center justify-center bg-card text-[13px] font-medium tracking-[0.03em] text-muted">
          {month}
        </span>
        <span className="flex flex-1 items-center justify-center text-[18px] font-semibold text-ink">
          {day}
        </span>
      </div>
      <div className="min-w-0">
        <h1 className="truncate text-[18px] font-semibold tracking-[-0.02em] text-ink">
          {fullDate}
        </h1>
        <p className="mt-0.5 truncate text-sm text-muted">{weekday}</p>
      </div>
    </div>
  );
}

function AccountButtonPreview({
  accounts,
  hiddenCount,
}: {
  accounts: SchedulerFilterAccountOption[];
  hiddenCount: number;
}) {
  return (
    <span className="inline-flex h-5 shrink-0 items-center gap-1">
      {accounts.slice(0, 1).map((account) => (
        <AvatarImage
          key={account.id}
          src={account.avatarUrl}
          alt={account.label}
          width={20}
          height={20}
          className="size-5 rounded-full border border-paper object-cover shadow-[0_1px_2px_rgba(0,0,0,0.16)]"
          fallback={account.label}
          fallbackSeed={account.id}
        />
      ))}
      {hiddenCount > 0 ? (
        <span className="flex h-5 min-w-[22px] items-center justify-center rounded-full border border-line bg-paper px-1 text-[9px] font-semibold leading-none text-ink shadow-[0_1px_3px_rgba(0,0,0,0.16)]">
          {hiddenCount}+
        </span>
      ) : null}
    </span>
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
      className={`flex size-8 items-center justify-center transition-colors ${divided ? "border-l border-line" : ""} ${
        selected
          ? "bg-card font-semibold text-ink"
          : "bg-paper text-muted hover:bg-card hover:text-ink"
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
    <div className="border-t border-line py-3 first:border-t-0 first:pt-0 last:pb-0">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
        {title}
      </p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function FilterChip({
  label,
  selected,
  selectedClassName,
  onClick,
}: {
  label: string;
  selected: boolean;
  selectedClassName?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`rounded-full border px-2.5 py-1 text-[10px] font-medium transition-colors ${
        selected
          ? (selectedClassName ?? "border-ink bg-ink text-page")
          : "border-line bg-card text-muted hover:bg-page hover:text-ink"
      }`}
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
          ? "border-ink bg-ink text-page"
          : "border-line bg-card text-muted hover:bg-page hover:text-ink"
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
        fallbackSeed={account.id}
      />
      <span className="max-w-[116px] truncate">{account.label}</span>
    </button>
  );
}
