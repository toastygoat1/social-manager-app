"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  LoaderCircle,
  Pencil,
  Plus,
  StickyNote,
  Trash2,
  X,
} from "lucide-react";
import { AvatarImage } from "@/app/_components/AvatarImage";
import type { Account } from "@/app/dashboard/_components/data";
import { ApiError, apiFetchBrowser } from "@/lib/api/browser-client";
import type { AnalyticsNote, Recommendation } from "./data";

type RecommendationsProps = {
  recommendations: Recommendation[];
  notes: AnalyticsNote[];
  accounts: Account[];
  selectedAccountId: string | null;
};

type NoteStyle = {
  paper: string;
  border: string;
  shadow: string;
};

const NOTE_STYLES: NoteStyle[] = [
  {
    paper: "bg-[#fff2ad]",
    border: "border-[#e6cb64]",
    shadow: "shadow-[0_18px_34px_-24px_rgba(112,78,13,0.78)]",
  },
  {
    paper: "bg-[#dff4ff]",
    border: "border-[#9ac9df]",
    shadow: "shadow-[0_18px_34px_-24px_rgba(34,98,122,0.7)]",
  },
  {
    paper: "bg-[#ffe2ec]",
    border: "border-[#e8a9be]",
    shadow: "shadow-[0_18px_34px_-24px_rgba(134,54,80,0.68)]",
  },
  {
    paper: "bg-[#e5f6d3]",
    border: "border-[#aac985]",
    shadow: "shadow-[0_18px_34px_-24px_rgba(75,107,39,0.68)]",
  },
];

const ACCOUNT_TONE_STYLES: Record<string, NoteStyle> = {
  blue: NOTE_STYLES[1],
  cyan: NOTE_STYLES[1],
  pink: NOTE_STYLES[2],
  yellow: NOTE_STYLES[0],
};

const NOTE_TILE_CLASS =
  "aspect-[1/1.08] min-h-[220px] rounded-md border p-4";

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
  if (!account) return "Unattached";

  return (
    account.displayName?.trim() ||
    account.name.replace(/^@/, "").trim() ||
    account.username?.replace(/^@/, "").trim() ||
    "Instagram"
  );
}

function getAccountHandle(account: Account | null | undefined) {
  if (!account) return "No account";

  const username =
    account.username?.replace(/^@/, "").trim() ||
    account.name.replace(/^@/, "").trim();

  return username ? `@${username}` : account.platform;
}

function getDefaultDraftAccountId(
  accounts: Account[],
  selectedAccountId: string | null,
) {
  if (
    selectedAccountId &&
    accounts.some((account) => account.id === selectedAccountId)
  ) {
    return selectedAccountId;
  }

  return accounts[0]?.id ?? "";
}

function getStableIndex(value: string, fallback: number) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) % NOTE_STYLES.length;
  }

  return value ? hash : fallback % NOTE_STYLES.length;
}

function getNoteStyle(
  note: AnalyticsNote,
  account: Account | null,
  index: number,
) {
  if (account?.tone && ACCOUNT_TONE_STYLES[account.tone]) {
    return ACCOUNT_TONE_STYLES[account.tone];
  }

  return NOTE_STYLES[getStableIndex(note.accountId ?? note.id, index)];
}

function AccountAvatar({ account }: { account: Account | null }) {
  const accountTitle = getAccountTitle(account);
  const accountHandle = getAccountHandle(account);

  return (
    <span
      aria-label={`${accountTitle} ${accountHandle}`}
      title={`${accountTitle} ${accountHandle}`}
      className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#2f2a1f] text-[10px] font-semibold text-white ring-2 ring-white/60"
    >
      <AvatarImage
        src={account?.avatarUrl}
        alt=""
        width={32}
        height={32}
        className="size-full object-cover"
        fallback={getInitials(account?.name ?? account?.username, "IG")}
      />
    </span>
  );
}

function AccountSelect({
  accounts,
  disabled,
  id,
  label,
  onChange,
  value,
}: {
  accounts: Account[];
  disabled?: boolean;
  id: string;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label
      htmlFor={id}
      className="flex min-w-0 flex-col gap-1 font-mono text-[10px] uppercase tracking-[0.04em] text-[#6e6046]"
    >
      {label}
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled || accounts.length === 0}
        className="h-9 min-w-0 rounded-md border border-black/10 bg-white/55 px-2 font-sans text-xs normal-case tracking-normal text-[#3b3324] outline-none transition focus:border-[#9b6b13] disabled:opacity-60"
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
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [draftAccountId, setDraftAccountId] = useState(() =>
    getDefaultDraftAccountId(accounts, selectedAccountId),
  );
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingBody, setEditingBody] = useState("");
  const [editingAccountId, setEditingAccountId] = useState("");
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const draftAccount = draftAccountId
    ? accountById.get(draftAccountId) ?? null
    : null;
  const composerAccount = selectedAccount ?? draftAccount;
  const canCreate = Boolean(draft.trim()) && Boolean(composerAccount);

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
          accountId: composerAccount?.id,
        },
      });
      setDraft("");
      setIsComposerOpen(false);
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
    if (!body || !editingAccountId) return;

    setPendingAction(`update:${noteId}`);
    setError(null);

    try {
      await apiFetchBrowser(`/analytics/notes/${encodeURIComponent(noteId)}`, {
        method: "PATCH",
        body: {
          body,
          accountId: editingAccountId,
        },
      });
      setEditingNoteId(null);
      setEditingBody("");
      setEditingAccountId("");
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
    const fallbackAccountId = getDefaultDraftAccountId(accounts, selectedAccountId);

    setEditingNoteId(note.id);
    setEditingBody(note.body);
    setEditingAccountId(note.accountId ?? fallbackAccountId);
    setError(null);
  }

  function cancelEditing() {
    setEditingNoteId(null);
    setEditingBody("");
    setEditingAccountId("");
  }

  return (
    <>
      <section className="flex min-w-0 flex-col gap-5 overflow-hidden rounded-[10px] border border-line bg-paper p-[18px]">
        <header className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-ink">Insight board</h2>
            <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.04em] text-muted">
              Recommendations
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
      </section>

      <section className="flex min-w-0 flex-col gap-4 overflow-hidden rounded-[10px] border border-line bg-paper p-[18px]">
        <header className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-center gap-2">
            <StickyNote className="size-4 text-[#9b6b13]" strokeWidth={1.8} />
            <div>
              <h2 className="text-sm font-semibold text-ink">Notes</h2>
              <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.04em] text-muted">
                {selectedAccount ? getAccountTitle(selectedAccount) : "All accounts"}
              </p>
            </div>
          </div>
          <span className="font-mono text-[10px] uppercase tracking-[0.04em] text-muted">
            {notes.length} saved
          </span>
        </header>

        {error ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        ) : null}

        <div className="grid w-full gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {isComposerOpen ? (
            <form
              onSubmit={createNote}
              className={`${NOTE_TILE_CLASS} flex flex-col gap-3 border-[#e6cb64] bg-[#fff2ad] text-[#2f2a1f] shadow-[0_18px_34px_-24px_rgba(112,78,13,0.68)]`}
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold">New note</p>
                <button
                  type="button"
                  onClick={() => setIsComposerOpen(false)}
                  title="Cancel"
                  aria-label="Cancel"
                  className="flex size-8 shrink-0 items-center justify-center rounded-md text-[#6e6046] transition hover:bg-white/45 hover:text-[#2f2a1f]"
                >
                  <X className="size-4" />
                </button>
              </div>
              {selectedAccount ? (
                <div className="flex items-center gap-2">
                  <AccountAvatar account={selectedAccount} />
                  <span className="min-w-0 truncate text-xs font-semibold">
                    {getAccountTitle(selectedAccount)}
                  </span>
                </div>
              ) : (
                <AccountSelect
                  accounts={accounts}
                  disabled={pendingAction === "create"}
                  id="new-note-account"
                  label="Account"
                  onChange={setDraftAccountId}
                  value={draftAccountId}
                />
              )}
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                maxLength={500}
                rows={5}
                placeholder="Write a note..."
                className="min-h-0 flex-1 resize-none rounded-md border border-[#e6cb64] bg-[#fff8cf] px-3 py-2 text-sm leading-6 text-[#2f2a1f] outline-none transition placeholder:text-[#8a7958] focus:border-[#9b6b13]"
              />
              <div className="flex items-center justify-between gap-3">
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
                  <span>Add</span>
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setIsComposerOpen(true)}
              disabled={accounts.length === 0}
              className={`${NOTE_TILE_CLASS} flex flex-col items-center justify-center gap-3 border-dashed border-line bg-card text-muted transition hover:border-[#d8d6cf] hover:bg-paper hover:text-ink disabled:pointer-events-none disabled:opacity-60`}
            >
              <span className="grid size-10 place-items-center rounded-full border border-dashed border-current">
                <Plus className="size-4" strokeWidth={1.8} />
              </span>
              <span className="text-sm font-semibold">Add note</span>
            </button>
          )}

          {notes.map((note, index) => {
            const isEditing = editingNoteId === note.id;
            const isUpdating = pendingAction === `update:${note.id}`;
            const isDeleting = pendingAction === `delete:${note.id}`;
            const noteAccount = note.accountId
              ? accountById.get(note.accountId) ?? null
              : null;
            const editingAccount = editingAccountId
              ? accountById.get(editingAccountId) ?? null
              : null;
            const style = getNoteStyle(note, noteAccount, index);

            return (
              <article
                key={note.id}
                className={`${NOTE_TILE_CLASS} flex flex-col gap-3 overflow-hidden text-[#2f2a1f] ${style.paper} ${style.border} ${style.shadow}`}
              >
                {isEditing ? (
                  <>
                    <div className="flex items-start gap-2">
                      <AccountAvatar account={editingAccount} />
                      <div className="min-w-0 flex-1">
                        <AccountSelect
                          accounts={accounts}
                          disabled={isUpdating}
                          id={`note-account-${note.id}`}
                          label="Account"
                          onChange={setEditingAccountId}
                          value={editingAccountId}
                        />
                      </div>
                    </div>
                    <textarea
                      value={editingBody}
                      onChange={(event) => setEditingBody(event.target.value)}
                      maxLength={500}
                      rows={5}
                      className="min-h-0 flex-1 resize-none rounded-md border border-black/10 bg-white/45 px-3 py-2 text-sm leading-6 text-[#2f2a1f] outline-none transition focus:border-[#9b6b13]"
                    />
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between gap-3">
                      <AccountAvatar account={noteAccount} />
                      <span className="font-mono text-[10px] uppercase text-[#6e6046]">
                        {formatNoteDate(note.updatedAt)}
                      </span>
                    </div>
                    <p className="min-h-0 flex-1 overflow-y-auto whitespace-pre-wrap break-words text-sm leading-6 text-[#2f2a1f]">
                      {note.body}
                    </p>
                  </>
                )}
                <div className="mt-auto flex items-center justify-end gap-1 border-t border-black/10 pt-2">
                  {isEditing ? (
                    <>
                      <button
                        type="button"
                        onClick={() => updateNote(note.id)}
                        disabled={!editingBody.trim() || !editingAccountId || isUpdating}
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
              </article>
            );
          })}
        </div>
      </section>
    </>
  );
}
