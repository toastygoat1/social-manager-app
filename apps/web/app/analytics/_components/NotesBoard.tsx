"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Plus, StickyNote, X } from "lucide-react";
import type { Account } from "@/app/dashboard/_components/data";
import { ApiError, apiFetchBrowser } from "@/lib/api/browser-client";
import type { AnalyticsNote } from "./data";

type NotesBoardProps = {
  notes: AnalyticsNote[];
  accounts: Account[];
  selectedAccountId: string | null;
};

type NoteColor =
  | "cream"
  | "sprout"
  | "mint"
  | "sky"
  | "periwinkle"
  | "violet"
  | "rose"
  | "peach";

type NoteStyle = {
  label: string;
  paper: string;
  swatch: string;
  text: string;
};

type BoardNote = Omit<AnalyticsNote, "color" | "accountIds"> & {
  accountIds: string[];
  color: NoteColor;
};

type NotePatch = Partial<
  Pick<AnalyticsNote, "body" | "color" | "accountIds">
> & {
  accountId?: string | null;
};

const NOTE_COLORS = {
  cream: {
    label: "Cream",
    paper: "#fff6c8",
    swatch: "#fff6c8",
    text: "#84793f",
  },
  sprout: {
    label: "Green",
    paper: "#e0ffc8",
    swatch: "#e0ffc8",
    text: "#5d843f",
  },
  mint: {
    label: "Mint",
    paper: "#c8fff2",
    swatch: "#c8fff2",
    text: "#3e8473",
  },
  sky: {
    label: "Sky",
    paper: "#c8f2ff",
    swatch: "#c8f2ff",
    text: "#3f7485",
  },
  periwinkle: {
    label: "Blue",
    paper: "#c8dbff",
    swatch: "#c8dbff",
    text: "#3f5785",
  },
  violet: {
    label: "Violet",
    paper: "#e0c8ff",
    swatch: "#e0c8ff",
    text: "#6f3f85",
  },
  rose: {
    label: "Red",
    paper: "#ffc8c8",
    swatch: "#ffc8c8",
    text: "#853d3d",
  },
  peach: {
    label: "Peach",
    paper: "#ffe6c8",
    swatch: "#ffe6c8",
    text: "#86543f",
  },
} satisfies Record<NoteColor, NoteStyle>;

const NOTE_COLOR_ORDER: NoteColor[] = [
  "cream",
  "sprout",
  "mint",
  "sky",
  "periwinkle",
  "violet",
  "rose",
  "peach",
];

const ACCOUNT_TONE_COLORS: Record<string, NoteColor> = {
  blue: "periwinkle",
  cyan: "mint",
  pink: "rose",
  yellow: "cream",
};

const LEGACY_NOTE_COLORS: Record<string, NoteColor> = {
  yellow: "cream",
  green: "sprout",
  blue: "sky",
  pink: "rose",
  lavender: "violet",
  white: "cream",
};

const DEFAULT_NOTE_COLOR: NoteColor = "cream";
const BOARD_REFRESH_MS = 6000;
const BOARD_CHANNEL = "analytics-notes-board";
const NOTE_ROTATIONS = [-0.9, 0.6, -0.35, 0.95, -0.65, 0.35, 0.75, -0.5];

function getApiErrorMessage(error: unknown) {
  if (!(error instanceof ApiError)) return null;

  const body = error.body as { message?: string | string[] } | null;
  const message = body?.message;

  return Array.isArray(message) ? message[0] : message;
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

function getAccountInitial(account: Account) {
  return getAccountTitle(account).trim().charAt(0).toUpperCase() || "A";
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

function getDefaultNoteColor(
  account: Account | null | undefined,
  fallbackIndex: number,
) {
  if (account?.tone && ACCOUNT_TONE_COLORS[account.tone]) {
    return ACCOUNT_TONE_COLORS[account.tone];
  }

  return NOTE_COLOR_ORDER[fallbackIndex % NOTE_COLOR_ORDER.length];
}

function isNoteColor(value: string): value is NoteColor {
  return NOTE_COLOR_ORDER.includes(value as NoteColor);
}

function getNoteColor(value: string) {
  if (isNoteColor(value)) return value;
  return LEGACY_NOTE_COLORS[value] ?? DEFAULT_NOTE_COLOR;
}

function getNoteRotation(noteId: string) {
  const rotationIndex = Array.from(noteId).reduce(
    (total, character) => total + character.charCodeAt(0),
    0,
  );

  return NOTE_ROTATIONS[rotationIndex % NOTE_ROTATIONS.length];
}

function getNoteAccountIds(note: AnalyticsNote | BoardNote) {
  const accountIds = Array.isArray(note.accountIds) ? note.accountIds : [];

  if (accountIds.length > 0) return accountIds;
  return note.accountId ? [note.accountId] : [];
}

function normalizeNote(note: AnalyticsNote): BoardNote {
  return {
    ...note,
    accountIds: getNoteAccountIds(note),
    color: getNoteColor(note.color),
  };
}

function getNoteAccounts(note: BoardNote, accountById: Map<string, Account>) {
  return note.accountIds
    .map((accountId) => accountById.get(accountId))
    .filter((account): account is Account => Boolean(account));
}

function NoteAccountFooter({
  account,
  className = "mt-4",
  extraCount,
}: {
  account: Account | null;
  className?: string;
  extraCount: number;
}) {
  if (!account) return null;

  return (
    <div
      className={`flex h-7 shrink-0 items-center gap-2 text-xs font-medium opacity-75 ${className}`}
    >
      {account.avatarUrl ? (
        <span
          aria-hidden="true"
          className="size-6 shrink-0 rounded bg-cover bg-center"
          style={{ backgroundImage: `url(${account.avatarUrl})` }}
        />
      ) : (
        <span className="flex size-6 shrink-0 items-center justify-center rounded bg-white/55 text-[11px] font-semibold">
          {getAccountInitial(account)}
        </span>
      )}
      <span className="min-w-0 truncate">{getAccountTitle(account)}</span>
      {extraCount > 0 ? (
        <span className="ml-auto shrink-0 rounded bg-white/45 px-1.5 py-0.5 text-[10px]">
          +{extraCount}
        </span>
      ) : null}
    </div>
  );
}

export function NotesBoard({
  notes,
  accounts,
  selectedAccountId,
}: NotesBoardProps) {
  const router = useRouter();
  const normalizedNotes = useMemo(() => notes.map(normalizeNote), [notes]);
  const accountById = useMemo(
    () => new Map(accounts.map((account) => [account.id, account])),
    [accounts],
  );
  const selectedAccount = selectedAccountId
    ? (accountById.get(selectedAccountId) ?? null)
    : null;
  const [boardNotes, setBoardNotes] = useState(normalizedNotes);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [draftAccountId, setDraftAccountId] = useState(() =>
    getDefaultDraftAccountId(accounts, selectedAccountId),
  );
  const [draftColor, setDraftColor] = useState<NoteColor>(() =>
    getDefaultNoteColor(selectedAccount, 0),
  );
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const broadcastRef = useRef<BroadcastChannel | null>(null);
  const draftAccount = draftAccountId
    ? (accountById.get(draftAccountId) ?? null)
    : null;
  const composerAccount = selectedAccount ?? draftAccount;
  const draftNoteStyle = NOTE_COLORS[draftColor];
  const canCreate = Boolean(draft.trim());

  useEffect(() => {
    setBoardNotes(normalizedNotes);
  }, [normalizedNotes]);

  useEffect(() => {
    setDraftAccountId(getDefaultDraftAccountId(accounts, selectedAccountId));
  }, [accounts, selectedAccountId]);

  useEffect(() => {
    if (
      editingNoteId &&
      !boardNotes.some((note) => note.id === editingNoteId)
    ) {
      setEditingNoteId(null);
    }
  }, [boardNotes, editingNoteId]);

  useEffect(() => {
    if (!("BroadcastChannel" in window)) return;

    const channel = new BroadcastChannel(BOARD_CHANNEL);
    broadcastRef.current = channel;
    channel.onmessage = () => router.refresh();

    return () => {
      channel.close();
      broadcastRef.current = null;
    };
  }, [router]);

  useEffect(() => {
    const refreshId = window.setInterval(() => {
      if (document.visibilityState === "visible" && pendingAction === null) {
        router.refresh();
      }
    }, BOARD_REFRESH_MS);

    return () => window.clearInterval(refreshId);
  }, [pendingAction, router]);

  function notifyBoardChange() {
    broadcastRef.current?.postMessage({ at: Date.now(), type: "changed" });
  }

  async function patchNote(
    noteId: string,
    body: NotePatch,
    fallbackMessage: string,
  ) {
    try {
      const updatedNote = await apiFetchBrowser<AnalyticsNote>(
        `/analytics/notes/${encodeURIComponent(noteId)}`,
        {
          method: "PATCH",
          body,
        },
      );
      setBoardNotes((currentNotes) =>
        currentNotes.map((note) =>
          note.id === noteId ? normalizeNote(updatedNote) : note,
        ),
      );
      notifyBoardChange();
      router.refresh();
      return true;
    } catch (requestError) {
      setError(getApiErrorMessage(requestError) ?? fallbackMessage);
      router.refresh();
      return false;
    }
  }

  function updateLocalNote(noteId: string, patch: Partial<BoardNote>) {
    setBoardNotes((currentNotes) =>
      currentNotes.map((note) =>
        note.id === noteId ? { ...note, ...patch } : note,
      ),
    );
  }

  function openComposer() {
    const color = getDefaultNoteColor(composerAccount, boardNotes.length);

    setDraftColor(color);
    setIsComposerOpen(true);
    setEditingNoteId(null);
    setError(null);
  }

  async function createNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const body = draft.trim();
    if (!body || !canCreate) return;

    setPendingAction("create");
    setError(null);

    try {
      const createdNote = await apiFetchBrowser<AnalyticsNote>(
        "/analytics/notes",
        {
          method: "POST",
          body: {
            body,
            accountId: composerAccount?.id ?? null,
            accountIds: composerAccount ? [composerAccount.id] : [],
            color: draftColor,
          },
        },
      );

      setBoardNotes((currentNotes) => [
        normalizeNote(createdNote),
        ...currentNotes,
      ]);
      setEditingNoteId(createdNote.id);
      setDraft("");
      setIsComposerOpen(false);
      notifyBoardChange();
      router.refresh();
    } catch (requestError) {
      setError(
        getApiErrorMessage(requestError) ?? "Note could not be created.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  function saveNoteBody(noteId: string) {
    const note = boardNotes.find((boardNote) => boardNote.id === noteId);
    const body = note?.body.trim();

    if (!note || !body) {
      setError("Note cannot be empty.");
      router.refresh();
      return;
    }

    setError(null);
    setEditingNoteId(null);
    void patchNote(noteId, { body }, "Note could not be updated.");
  }

  return (
    <section className="flex min-w-0 flex-col gap-3">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <StickyNote className="size-4 text-[#9b6b13]" strokeWidth={1.8} />
          <div>
            <h2 className="text-sm font-semibold text-ink">Notes</h2>
            <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.04em] text-muted">
              {selectedAccount
                ? getAccountTitle(selectedAccount)
                : "All accounts"}
            </p>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 sm:justify-end">
          <span className="font-mono text-[10px] uppercase tracking-[0.04em] text-muted">
            {boardNotes.length} saved
          </span>
          <button
            type="button"
            onClick={openComposer}
            disabled={isComposerOpen}
            title="Add note"
            aria-label="Add note"
            className="flex size-9 items-center justify-center rounded-md border border-line bg-card text-ink transition hover:border-[#d8d6cf] hover:bg-white disabled:pointer-events-none disabled:opacity-60"
          >
            <Plus className="size-4" strokeWidth={1.8} />
          </button>
        </div>
      </header>

      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <div className="grid auto-rows-[9rem] grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {isComposerOpen ? (
          <form
            onSubmit={createNote}
            className="flex h-36 flex-col rounded-none p-4 font-medium"
            style={{
              backgroundColor: draftNoteStyle.paper,
              color: draftNoteStyle.text,
              filter: "drop-shadow(0 10px 8px rgba(47, 42, 31, 0.24))",
              transform: "rotate(-0.4deg)",
            }}
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-[10px] font-medium uppercase tracking-[0.04em] opacity-70">
                New note
              </span>
              <button
                type="button"
                onClick={() => setIsComposerOpen(false)}
                title="Cancel"
                aria-label="Cancel"
                className="flex size-7 items-center justify-center rounded text-current transition hover:bg-white/45"
              >
                <X className="size-4" />
              </button>
            </div>
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              maxLength={500}
              autoFocus
              placeholder="Write a note..."
              className="min-h-0 flex-1 resize-none overflow-hidden border-0 bg-transparent text-sm font-medium leading-6 text-current outline-none placeholder:text-current placeholder:opacity-60"
            />
            <div className="mt-4 flex items-center justify-between gap-3">
              <NoteAccountFooter
                account={composerAccount}
                className=""
                extraCount={0}
              />
              <button
                type="submit"
                disabled={!canCreate || pendingAction === "create"}
                title="Add note"
                aria-label="Add note"
                className="ml-auto flex size-8 shrink-0 items-center justify-center rounded-md bg-[#2f2a1f] text-white transition hover:bg-[#4a402e] disabled:pointer-events-none disabled:opacity-60"
              >
                {pendingAction === "create" ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <Plus className="size-4" />
                )}
              </button>
            </div>
          </form>
        ) : null}

        {boardNotes.map((note) => {
          const style = NOTE_COLORS[note.color];
          const noteAccounts = getNoteAccounts(note, accountById);
          const primaryNoteAccount = noteAccounts[0] ?? null;
          const extraAccountCount = Math.max(0, noteAccounts.length - 1);
          const isEditing = editingNoteId === note.id;

          return (
            <article
              key={note.id}
              className="flex h-36 cursor-default flex-col rounded-none p-4 font-medium"
              style={{
                backgroundColor: style.paper,
                color: style.text,
                filter: "drop-shadow(0 10px 8px rgba(47, 42, 31, 0.24))",
                transform: `rotate(${getNoteRotation(note.id)}deg)`,
              }}
              onClick={() => setEditingNoteId(note.id)}
            >
              <div className="min-h-0 flex-1">
                {isEditing ? (
                  <textarea
                    value={note.body}
                    onChange={(event) =>
                      updateLocalNote(note.id, { body: event.target.value })
                    }
                    onBlur={() => saveNoteBody(note.id)}
                    maxLength={500}
                    autoFocus
                    className="h-full min-h-0 w-full resize-none overflow-hidden border-0 bg-transparent text-sm font-medium leading-6 text-current outline-none"
                  />
                ) : (
                  <p className="line-clamp-5 whitespace-pre-wrap break-words text-sm font-medium leading-6">
                    {note.body}
                  </p>
                )}
              </div>
              <NoteAccountFooter
                account={primaryNoteAccount}
                extraCount={extraAccountCount}
              />
            </article>
          );
        })}
      </div>
    </section>
  );
}
