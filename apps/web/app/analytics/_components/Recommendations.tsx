"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  LoaderCircle,
  Pencil,
  Pin,
  Plus,
  StickyNote,
  Trash2,
  X,
} from "lucide-react";
import type { Account } from "@/app/dashboard/_components/data";
import { ApiError, apiFetchBrowser } from "@/lib/api/browser-client";
import type { AnalyticsNote, Recommendation } from "./data";

type RecommendationsProps = {
  recommendations: Recommendation[];
  notes: AnalyticsNote[];
  accounts: Account[];
  selectedAccountId: string | null;
};

type StickyNoteStyle = {
  paper: string;
  border: string;
  tape: string;
  pin: string;
  shadow: string;
};

const STICKY_NOTE_STYLES: StickyNoteStyle[] = [
  {
    paper: "bg-[#fff2ad]",
    border: "border-[#e6cb64]",
    tape: "bg-[#fff9d7]/90",
    pin: "text-[#9b6b13]",
    shadow: "shadow-[0_18px_34px_-24px_rgba(112,78,13,0.78)]",
  },
  {
    paper: "bg-[#dff4ff]",
    border: "border-[#9ac9df]",
    tape: "bg-[#f0fbff]/90",
    pin: "text-[#2d708a]",
    shadow: "shadow-[0_18px_34px_-24px_rgba(34,98,122,0.7)]",
  },
  {
    paper: "bg-[#ffe2ec]",
    border: "border-[#e8a9be]",
    tape: "bg-[#fff4f8]/90",
    pin: "text-[#a64865]",
    shadow: "shadow-[0_18px_34px_-24px_rgba(134,54,80,0.68)]",
  },
  {
    paper: "bg-[#e5f6d3]",
    border: "border-[#aac985]",
    tape: "bg-[#f4fde9]/90",
    pin: "text-[#5d7f2f]",
    shadow: "shadow-[0_18px_34px_-24px_rgba(75,107,39,0.68)]",
  },
];

const ACCOUNT_TONE_STYLES: Record<string, StickyNoteStyle> = {
  blue: STICKY_NOTE_STYLES[1],
  cyan: STICKY_NOTE_STYLES[1],
  pink: STICKY_NOTE_STYLES[2],
  yellow: STICKY_NOTE_STYLES[0],
};

function getApiErrorMessage(error: unknown) {
  if (!(error instanceof ApiError)) return null;

  const body = error.body as { message?: string | string[] } | null;
  const message = body?.message;

  return Array.isArray(message) ? message[0] : message;
}

function formatNoteDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function getInitials(label: string | null | undefined, fallback = "IG") {
  const cleanLabel = label?.replace(/^@/, "").split("@")[0].trim();

  if (!cleanLabel) return fallback;

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

function getAccountTitle(account: Account | null | undefined) {
  if (!account) return "All accounts";

  return (
    account.displayName?.trim() ||
    account.name.replace(/^@/, "").trim() ||
    account.username?.replace(/^@/, "").trim() ||
    "Instagram"
  );
}

function getAccountHandle(account: Account | null | undefined) {
  if (!account) return "Workspace";

  const username =
    account.username?.replace(/^@/, "").trim() ||
    account.name.replace(/^@/, "").trim();

  return username ? `@${username}` : account.platform;
}

function getDefaultDraftAccountId(
  accounts: Account[],
  selectedAccountId: string | null,
) {
  if (selectedAccountId && accounts.some((account) => account.id === selectedAccountId)) {
    return selectedAccountId;
  }

  return accounts[0]?.id ?? "";
}

function getStableIndex(value: string, fallback: number) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) % STICKY_NOTE_STYLES.length;
  }

  return value ? hash : fallback % STICKY_NOTE_STYLES.length;
}

function getStickyNoteStyle(
  note: AnalyticsNote,
  account: Account | null,
  index: number,
) {
  if (account?.tone && ACCOUNT_TONE_STYLES[account.tone]) {
    return ACCOUNT_TONE_STYLES[account.tone];
  }

  return STICKY_NOTE_STYLES[getStableIndex(note.accountId ?? note.id, index)];
}

function AccountBadge({
  account,
  compact = false,
}: {
  account: Account | null;
  compact?: boolean;
}) {
  return (
    <span className="inline-flex min-w-0 items-center gap-2 rounded-full border border-black/10 bg-white/45 px-2 py-1 text-[#3b3324]">
      <span className="grid size-5 shrink-0 place-items-center rounded-full bg-[#2f2a1f] font-mono text-[9px] font-semibold text-white">
        {getInitials(account?.name ?? account?.username, "IG")}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[11px] font-semibold leading-3.5">
          {getAccountTitle(account)}
        </span>
        {compact ? null : (
          <span className="block truncate font-mono text-[9px] uppercase leading-3 text-[#6e6046]">
            {getAccountHandle(account)}
          </span>
        )}
      </span>
    </span>
  );
}

export function Recommendations({
  recommendations,
  notes,
  accounts,
  selectedAccountId,
}: RecommendationsProps) {
  const router = useRouter();
  const accountById = useMemo(
    () => new Map(accounts.map((account) => [account.id, account])),
    [accounts],
  );
  const selectedAccount = selectedAccountId
    ? accountById.get(selectedAccountId) ?? null
    : null;
  const [draft, setDraft] = useState("");
  const [draftAccountId, setDraftAccountId] = useState(() =>
    getDefaultDraftAccountId(accounts, selectedAccountId),
  );
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingBody, setEditingBody] = useState("");
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isAccountLocked = Boolean(selectedAccount);
  const draftAccount = draftAccountId
    ? accountById.get(draftAccountId) ?? null
    : null;
  const composerAccount = selectedAccount ?? draftAccount;
  const canCreate =
    Boolean(draft.trim()) && (accounts.length === 0 || Boolean(composerAccount));

  useEffect(() => {
    setDraftAccountId(getDefaultDraftAccountId(accounts, selectedAccountId));
  }, [accounts, selectedAccountId]);

  async function createNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const body = draft.trim();
    if (!body || !canCreate) return;

    setPendingAction("create");
    setError(null);

    try {
      await apiFetchBrowser("/analytics/notes", {
        method: "POST",
        body: {
          body,
          accountId: composerAccount?.id ?? undefined,
        },
      });
      setDraft("");
      router.refresh();
    } catch (requestError) {
      setError(
        getApiErrorMessage(requestError) ?? "Note could not be created.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  async function updateNote(noteId: string) {
    const body = editingBody.trim();
    if (!body) return;

    setPendingAction(`update:${noteId}`);
    setError(null);

    try {
      await apiFetchBrowser(`/analytics/notes/${encodeURIComponent(noteId)}`, {
        method: "PATCH",
        body: { body },
      });
      setEditingNoteId(null);
      setEditingBody("");
      router.refresh();
    } catch (requestError) {
      setError(
        getApiErrorMessage(requestError) ?? "Note could not be updated.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  async function deleteNote(noteId: string) {
    setPendingAction(`delete:${noteId}`);
    setError(null);

    try {
      await apiFetchBrowser(`/analytics/notes/${encodeURIComponent(noteId)}`, {
        method: "DELETE",
      });
      router.refresh();
    } catch (requestError) {
      setError(
        getApiErrorMessage(requestError) ?? "Note could not be deleted.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  function startEditing(note: AnalyticsNote) {
    setEditingNoteId(note.id);
    setEditingBody(note.body);
    setError(null);
  }

  function cancelEditing() {
    setEditingNoteId(null);
    setEditingBody("");
  }

  return (
    <section className="flex min-w-0 flex-col gap-5 overflow-hidden rounded-[10px] border border-line bg-paper p-[18px]">
      <header className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-ink">Insight board</h2>
          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.04em] text-muted">
            Recommendations and account notes
          </p>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.04em] text-muted">
          {selectedAccount ? getAccountTitle(selectedAccount) : "All accounts"}
        </span>
      </header>
      <div className="flex w-full flex-col gap-3">
        {recommendations.length === 0 ? (
          <div className="flex h-20 w-full items-center justify-center rounded-lg bg-card text-sm text-muted">
            No recommendations yet
          </div>
        ) : (
          recommendations.map((rec) => (
            <div
              key={rec.title}
              className="flex w-full flex-col gap-2 rounded-r-lg border-l-2 border-[#5e6ad2] bg-card px-4 py-3.5"
            >
              <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#5e6ad2]">
                Insight
              </p>
              <p className="text-sm font-semibold text-ink">{rec.title}</p>
              <p className="text-xs leading-5 text-muted">
                {rec.body}
              </p>
            </div>
          ))
        )}
      </div>
      <div className="mt-2 flex w-full flex-col gap-4 border-t border-line pt-6">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-center gap-2">
            <StickyNote className="size-4 text-[#9b6b13]" strokeWidth={1.8} />
            <p className="text-sm font-semibold text-ink">Sticky notes</p>
          </div>
          <span className="font-mono text-[10px] uppercase tracking-[0.04em] text-muted">
            {notes.length} saved
          </span>
        </div>
        <form
          onSubmit={createNote}
          className="relative flex w-full flex-col gap-4 overflow-hidden rounded-md border border-[#e6cb64] bg-[#fff2ad] p-4 shadow-[0_18px_34px_-28px_rgba(112,78,13,0.7)]"
        >
          <span
            aria-hidden="true"
            className="absolute left-1/2 top-0 h-7 w-24 -translate-x-1/2 -translate-y-3 rotate-1 rounded-[2px] bg-[#fff9d7]/90 shadow-sm"
          />
          <div className="relative z-10 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex min-w-0 items-center gap-2 text-[#3b3324]">
              <Pin className="size-3.5 shrink-0" strokeWidth={1.8} />
              <span className="truncate text-xs font-semibold">
                New note
              </span>
            </div>
            {isAccountLocked ? (
              <AccountBadge account={composerAccount} compact />
            ) : (
              <label className="flex min-w-0 flex-col gap-1 font-mono text-[10px] uppercase tracking-[0.04em] text-[#6e6046] sm:flex-row sm:items-center">
                Attach to
                <select
                  value={draftAccountId}
                  onChange={(event) => setDraftAccountId(event.target.value)}
                  disabled={accounts.length === 0 || pendingAction === "create"}
                  className="h-9 min-w-0 rounded-md border border-black/10 bg-white/50 px-2 font-sans text-xs normal-case tracking-normal text-[#3b3324] outline-none transition focus:border-[#9b6b13] disabled:opacity-60"
                >
                  {accounts.length === 0 ? (
                    <option value="">No accounts</option>
                  ) : (
                    accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {getAccountTitle(account)}
                      </option>
                    ))
                  )}
                </select>
              </label>
            )}
          </div>
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            maxLength={500}
            rows={4}
            placeholder="Write a note..."
            className="relative z-10 min-h-24 w-full resize-y rounded-md border border-[#e6cb64] bg-[#fff8cf] px-3 py-2 text-sm leading-6 text-[#2f2a1f] outline-none transition placeholder:text-[#8a7958] focus:border-[#9b6b13]"
          />
          <div className="relative z-10 flex items-center justify-between gap-3">
            <span className="font-mono text-[10px] text-[#6e6046]">
              {draft.length}/500
            </span>
            <button
              type="submit"
              disabled={!canCreate || pendingAction === "create"}
              className="flex h-9 items-center gap-2 rounded-md bg-[#2f2a1f] px-3 text-xs font-medium text-white transition hover:bg-[#4a402e] disabled:pointer-events-none disabled:opacity-60"
            >
              {pendingAction === "create" ? (
                <LoaderCircle className="size-3.5 animate-spin" />
              ) : (
                <Plus className="size-3.5" />
              )}
              <span>Add note</span>
            </button>
          </div>
        </form>
        {error ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        ) : null}
        {notes.length === 0 ? (
          <div className="grid min-h-44 w-full place-items-center rounded-md border border-dashed border-line bg-card px-5 py-7">
            <div className="flex w-full max-w-sm flex-col gap-3 rounded-md border border-[#e6cb64] bg-[#fff2ad] p-4 shadow-[0_18px_34px_-28px_rgba(112,78,13,0.7)]">
              <div className="flex items-center justify-between text-[#3b3324]">
                <span className="text-sm font-semibold">No sticky notes yet</span>
                <StickyNote className="size-4" strokeWidth={1.8} />
              </div>
              <div className="flex flex-col gap-3 pt-2">
                <span className="h-px w-full bg-[#e6cb64]" />
                <span className="h-px w-10/12 bg-[#e6cb64]" />
                <span className="h-px w-8/12 bg-[#e6cb64]" />
              </div>
            </div>
          </div>
        ) : (
          <div className="grid w-full gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {notes.map((note, index) => {
              const isEditing = editingNoteId === note.id;
              const isUpdating = pendingAction === `update:${note.id}`;
              const isDeleting = pendingAction === `delete:${note.id}`;
              const noteAccount = note.accountId
                ? accountById.get(note.accountId) ?? null
                : null;
              const style = getStickyNoteStyle(note, noteAccount, index);

              return (
                <article
                  key={note.id}
                  className={`relative flex min-h-[210px] w-full flex-col gap-4 overflow-hidden rounded-md border px-4 pb-3 pt-4 text-[#2f2a1f] ${style.paper} ${style.border} ${style.shadow}`}
                >
                  <span
                    aria-hidden="true"
                    className={`absolute left-1/2 top-0 h-7 w-24 -translate-x-1/2 -translate-y-3 rotate-1 rounded-[2px] shadow-sm ${style.tape}`}
                  />
                  <div className="relative z-10 flex items-start justify-between gap-3">
                    <AccountBadge account={noteAccount} />
                    <Pin
                      className={`mt-1 size-3.5 shrink-0 ${style.pin}`}
                      strokeWidth={1.9}
                    />
                  </div>
                  {isEditing ? (
                    <textarea
                      value={editingBody}
                      onChange={(event) => setEditingBody(event.target.value)}
                      maxLength={500}
                      rows={5}
                      className="relative z-10 min-h-28 w-full resize-y rounded-md border border-black/10 bg-white/45 px-3 py-2 text-sm leading-6 text-[#2f2a1f] outline-none transition focus:border-[#9b6b13]"
                    />
                  ) : (
                    <p className="relative z-10 flex-1 whitespace-pre-wrap break-words text-sm leading-6 text-[#2f2a1f]">
                      {note.body}
                    </p>
                  )}
                  <div className="relative z-10 mt-auto flex items-center justify-between gap-3 border-t border-black/10 pt-2">
                    <span className="font-mono text-[10px] uppercase text-[#6e6046]">
                      {formatNoteDate(note.updatedAt)}
                    </span>
                    <div className="flex items-center gap-1">
                      {isEditing ? (
                        <>
                          <button
                            type="button"
                            onClick={() => updateNote(note.id)}
                            disabled={!editingBody.trim() || isUpdating}
                            title="Save note"
                            aria-label="Save note"
                            className="flex size-8 items-center justify-center rounded-md text-[#287447] transition hover:bg-white/45 disabled:pointer-events-none disabled:opacity-50"
                          >
                            {isUpdating ? (
                              <LoaderCircle className="size-4 animate-spin" />
                            ) : (
                              <Check className="size-4" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={cancelEditing}
                            title="Cancel"
                            aria-label="Cancel"
                            className="flex size-8 items-center justify-center rounded-md text-[#6e6046] transition hover:bg-white/45 hover:text-[#2f2a1f]"
                          >
                            <X className="size-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => startEditing(note)}
                            title="Edit note"
                            aria-label="Edit note"
                            className="flex size-8 items-center justify-center rounded-md text-[#6e6046] transition hover:bg-white/45 hover:text-[#2f2a1f]"
                          >
                            <Pencil className="size-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteNote(note.id)}
                            disabled={isDeleting}
                            title="Delete note"
                            aria-label="Delete note"
                            className="flex size-8 items-center justify-center rounded-md text-[#6e6046] transition hover:bg-white/45 hover:text-[#a33d3d] disabled:pointer-events-none disabled:opacity-50"
                          >
                            {isDeleting ? (
                              <LoaderCircle className="size-4 animate-spin" />
                            ) : (
                              <Trash2 className="size-4" />
                            )}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
