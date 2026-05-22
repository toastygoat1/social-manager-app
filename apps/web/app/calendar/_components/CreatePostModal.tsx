"use client";

import {
  Bookmark,
  Calendar,
  ChevronDown,
  Heart,
  ImageIcon,
  MessageCircle,
  Send,
  User,
} from "lucide-react";
import { useEffect, useState } from "react";
import { apiFetchBrowser } from "@/lib/api/browser-client";
import type { CalendarPostType } from "./data";

export type CreatePostType = "post" | "story" | "reels";

type Props = {
  open: boolean;
  type: CreatePostType;
  defaultScheduledIso: string;
  onClose: () => void;
  onCreated: () => void;
};

type InstagramAccountResponse = {
  id: string;
  username: string;
  accountType: "PERSONAL" | "BUSINESS" | "CREATOR";
  isActive: boolean;
};

const TYPE_LABEL: Record<CreatePostType, string> = {
  post: "Your Post",
  story: "Your Story",
  reels: "Your Reels",
};

const TYPE_TO_POST_TYPE: Record<CreatePostType, CalendarPostType> = {
  post: "FEED",
  story: "STORY",
  reels: "REEL",
};

function toLocalDatetimeInputValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function defaultScheduledInputValue(iso: string): string {
  const requested = new Date(iso);
  const minimum = new Date(Date.now() + 15 * 60 * 1000);
  const fallback = Number.isNaN(requested.getTime()) ? minimum : requested;
  return toLocalDatetimeInputValue(
    fallback > minimum ? fallback.toISOString() : minimum.toISOString(),
  );
}

function ImagePlaceholder({ size = 100 }: { size?: number }) {
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-2xl bg-[#495057]"
      style={{ width: size, height: size }}
    >
      <ImageIcon
        className="text-[#d9d9d9]"
        style={{ width: size * 0.42, height: size * 0.42 }}
        strokeWidth={1.4}
      />
    </div>
  );
}

function AccountChip({
  username,
  selected,
  onClick,
}: {
  username: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-11 w-[196px] shrink-0 items-center gap-2 overflow-hidden rounded-lg border px-4 py-2 text-left ${
        selected ? "border-cta bg-card" : "border-line bg-paper"
      }`}
    >
      <div className="grid size-7 shrink-0 grid-cols-2 grid-rows-2 gap-1 rounded-lg bg-ink p-1.5">
        <span className="rounded-[2px] bg-white" />
        <span className="rounded-[2px] bg-white" />
        <span className="rounded-[2px] bg-white" />
        <span className="rounded-[2px] bg-white" />
      </div>
      <span className="truncate text-sm leading-4 text-ink">@{username}</span>
    </button>
  );
}

function Switch({
  on,
  onToggle,
}: {
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={on}
      className="pt-1"
    >
      <div
        className={`relative h-5 w-9 rounded-full ${on ? "bg-cta" : "bg-line"}`}
      >
        <div
          className={`absolute top-0.5 size-4 rounded-full bg-paper shadow-[0_2px_4px_0_rgba(39,39,39,0.1)] transition-all ${
            on ? "left-[18px]" : "left-0.5"
          }`}
        />
      </div>
    </button>
  );
}

export function CreatePostModal({
  open,
  type,
  defaultScheduledIso,
  onClose,
  onCreated,
}: Props) {
  const [accounts, setAccounts] = useState<InstagramAccountResponse[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(
    null,
  );
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [requiresApproval, setRequiresApproval] = useState(true);
  const [scheduledFor, setScheduledFor] = useState(() =>
    defaultScheduledInputValue(defaultScheduledIso),
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setAccountsLoading(true);
    apiFetchBrowser<InstagramAccountResponse[]>("/instagram/accounts")
      .then((list) => {
        setAccounts(list);
        setSelectedAccountId((current) =>
          list.some((account) => account.id === current)
            ? current
            : (list[0]?.id ?? null),
        );
      })
      .catch(() => {
        if (process.env.NODE_ENV !== "production") {
          console.info(
            "Instagram accounts could not be loaded. Make sure the API server is running.",
          );
        }
        setError("Failed to load accounts");
      })
      .finally(() => setAccountsLoading(false));
  }, [open]);

  useEffect(() => {
    if (open) {
      setScheduledFor(defaultScheduledInputValue(defaultScheduledIso));
    }
  }, [open, defaultScheduledIso]);

  if (!open) return null;

  const handleSubmit = async () => {
    setError(null);
    if (!selectedAccountId) {
      setError("Select an account");
      return;
    }
    if (!scheduledFor) {
      setError("Pick a schedule time");
      return;
    }
    const scheduledDate = new Date(scheduledFor);
    if (Number.isNaN(scheduledDate.getTime())) {
      setError("Invalid date");
      return;
    }
    if (scheduledDate <= new Date()) {
      setError("Pick a future schedule time");
      return;
    }
    setSubmitting(true);
    try {
      await apiFetchBrowser("/calendar/events", {
        method: "POST",
        body: {
          instagramAccountId: selectedAccountId,
          postType: TYPE_TO_POST_TYPE[type],
          scheduledFor: scheduledDate.toISOString(),
          title: title || undefined,
          caption: caption || undefined,
          requiresApproval,
        },
      });
      setTitle("");
      setCaption("");
      onCreated();
    } catch {
      if (process.env.NODE_ENV !== "production") {
        console.info(
          "Scheduled post could not be created. Make sure the API server is running.",
        );
      }
      setError("Failed to schedule post");
    } finally {
      setSubmitting(false);
    }
  };

  const scheduleDisabled = submitting || accountsLoading || !selectedAccountId;
  const minScheduledFor = toLocalDatetimeInputValue(new Date().toISOString());

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={TYPE_LABEL[type]}
      className="fixed inset-0 z-50 flex items-center justify-center p-2.5"
      style={{ backgroundColor: "rgba(89, 89, 89, 0.8)" }}
      onClick={onClose}
    >
      <div
        className="flex h-[900px] max-h-[calc(100vh-20px)] w-[1280px] max-w-[calc(100vw-20px)] items-stretch overflow-hidden rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-1 flex-col gap-5 overflow-y-auto rounded-l-3xl border border-line bg-paper p-6">
          <section className="flex w-full flex-col gap-1">
            <h2 className="text-xl font-semibold text-ink">Publish To</h2>
            {accountsLoading ? (
              <p className="text-sm text-muted">Loading accounts...</p>
            ) : accounts.length === 0 ? (
              <p className="text-sm text-muted">
                No Instagram accounts connected yet.
              </p>
            ) : (
              <div className="flex w-full gap-2.5 overflow-x-auto rounded-2xl bg-paper p-2">
                {accounts.map((acct) => (
                  <AccountChip
                    key={acct.id}
                    username={acct.username}
                    selected={selectedAccountId === acct.id}
                    onClick={() => setSelectedAccountId(acct.id)}
                  />
                ))}
              </div>
            )}
          </section>

          <section className="flex w-full flex-col gap-1">
            <h2 className="text-xl font-semibold text-ink">{TYPE_LABEL[type]}</h2>
            <div className="flex h-[524px] w-full flex-col gap-6 overflow-hidden rounded-2xl border border-line p-6">
              <div className="flex flex-1 flex-col gap-2.5 overflow-hidden p-2.5">
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Post title"
                  maxLength={200}
                  className="h-10 w-full shrink-0 border-b border-line bg-transparent text-base font-semibold text-ink placeholder:text-muted focus:outline-none"
                />
                <textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Write a caption"
                  className="h-full w-full resize-none bg-transparent text-base leading-4 text-ink placeholder:text-muted focus:outline-none"
                />
              </div>
              <div className="h-px w-full rounded-[34px] bg-line" />
              <div className="flex items-center gap-2.5">
                <ImagePlaceholder />
                <ImagePlaceholder />
                <ImagePlaceholder />
              </div>
            </div>
          </section>

          <div className="flex items-start gap-3">
            <Switch
              on={requiresApproval}
              onToggle={() => setRequiresApproval((v) => !v)}
            />
            <div className="flex flex-col gap-0.5 whitespace-nowrap">
              <p className="text-base leading-[26px] text-ink">
                Wait for Approval
              </p>
              <p className="font-inter text-sm leading-5 text-muted">
                Require approval before publishing
              </p>
            </div>
          </div>

          {error ? (
            <p className="text-sm font-medium text-red-600">{error}</p>
          ) : null}

          <div className="flex-1" />

          <div className="flex w-full items-center gap-4">
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-[78px] items-center justify-center rounded-lg bg-paper text-xs font-bold leading-4 text-muted"
            >
              Cancel
            </button>
            <div className="flex-1" />
            <label className="flex h-8 items-center gap-2 rounded-lg border border-muted bg-paper px-4 cursor-pointer">
              <Calendar className="size-4 text-muted" strokeWidth={1.8} />
              <input
                type="datetime-local"
                value={scheduledFor}
                min={minScheduledFor}
                onChange={(e) => setScheduledFor(e.target.value)}
                className="bg-transparent text-xs font-medium leading-4 text-muted focus:outline-none"
              />
            </label>
            <div className="flex h-8 items-center overflow-hidden rounded-lg bg-[#78dbe8]">
              <button
                type="button"
                disabled={scheduleDisabled}
                onClick={handleSubmit}
                className="flex h-full items-center px-4 text-xs font-bold leading-4 text-[#f2f2f2] disabled:opacity-60"
              >
                {submitting ? "Scheduling..." : "Schedule"}
              </button>
              <span
                aria-hidden="true"
                className="flex h-full w-7 items-center justify-center bg-[#1d6b81]"
              >
                <ChevronDown className="size-4 text-[#f2f2f2]" strokeWidth={2.2} />
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center rounded-r-3xl border border-line bg-paper p-2.5">
          <div className="flex h-[585px] w-[408px] flex-col rounded-3xl border border-line">
            <div className="flex w-full items-center gap-3 rounded-t-3xl p-3">
              <div className="flex size-[58px] shrink-0 items-center justify-center rounded-full bg-card">
                <User className="size-8 text-muted" strokeWidth={1.6} />
              </div>
              <p className="font-inter text-2xl text-ink">
                {accounts.find((a) => a.id === selectedAccountId)?.username ??
                  "Preview"}
              </p>
            </div>
            <div className="flex h-[428px] w-full items-center justify-center bg-[#495057]">
              <ImageIcon
                className="size-32 text-[#d9d9d9]"
                strokeWidth={1.2}
              />
            </div>
            <div className="flex flex-1 items-center gap-4 px-6">
              <Heart className="size-6 fill-ink text-ink" strokeWidth={0} />
              <MessageCircle
                className="size-6 fill-ink text-ink"
                strokeWidth={0}
              />
              <Send className="size-6 text-ink" strokeWidth={2} />
              <div className="flex-1" />
              <Bookmark className="size-6 fill-ink text-ink" strokeWidth={0} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
