"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Plus, X } from "lucide-react";
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
const NOTE_SHADOW = "drop-shadow(0 6px 3px rgba(47, 42, 31, 0.13))";

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

function getTimestamp(value: string) {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function isLocalNoteNewer(localNote: BoardNote, incomingNote: BoardNote) {
  return (
    getTimestamp(localNote.updatedAt) > getTimestamp(incomingNote.updatedAt)
  );
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

function resizeTextareaToContent(element: HTMLTextAreaElement | null) {
  if (!element) return;

  element.style.height = "auto";
  element.style.height = `${element.scrollHeight}px`;
}

function AccountAvatar({ account }: { account: Account }) {
  if (account.avatarUrl) {
    return (
      <span
        aria-hidden="true"
        className="size-5 shrink-0 rounded-full bg-cover bg-center"
        style={{ backgroundImage: `url(${account.avatarUrl})` }}
      />
    );
  }

  return (
    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-white/55 text-[10px] font-semibold">
      {getAccountInitial(account)}
    </span>
  );
}

function NoteAccountFooter({
  accounts,
  attachOptions,
  isAttachOpen,
  onAttach,
  onDetach,
  onToggleAttach,
  pending,
}: {
  accounts: Account[];
  attachOptions: Account[];
  isAttachOpen: boolean;
  onAttach: (accountId: string) => void;
  onDetach: (accountId: string) => void;
  onToggleAttach: () => void;
  pending: boolean;
}) {
  return (
    <div
      data-analytics-note-account-menu
      className="relative mt-3 flex h-8 shrink-0 items-center gap-1.5 text-xs font-medium opacity-80"
      onClick={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        title="Attach account"
        aria-label="Attach account"
        onClick={onToggleAttach}
        disabled={pending}
        className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white/45 text-current transition hover:bg-white/65 disabled:pointer-events-none disabled:opacity-60"
      >
        {pending ? (
          <LoaderCircle className="size-3.5 animate-spin" />
        ) : (
          <Plus className="size-4" strokeWidth={1.9} />
        )}
      </button>
      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
        {accounts.map((account) => (
          <span
            key={account.id}
            className="group flex h-7 min-w-0 max-w-[7rem] items-center gap-1 rounded-full bg-white/35 px-1.5 pr-2"
            title={getAccountTitle(account)}
          >
            <AccountAvatar account={account} />
            <span className="min-w-0 truncate">{getAccountTitle(account)}</span>
            <button
              type="button"
              title={`Detach ${getAccountTitle(account)}`}
              aria-label={`Detach ${getAccountTitle(account)}`}
              onClick={() => onDetach(account.id)}
              disabled={pending}
              className="ml-0.5 flex size-4 shrink-0 items-center justify-center rounded-full opacity-0 transition hover:bg-white/45 group-hover:opacity-100 focus:opacity-100 disabled:pointer-events-none"
            >
              <X className="size-3" strokeWidth={2} />
            </button>
          </span>
        ))}
      </div>
      {isAttachOpen ? (
        <div className="absolute bottom-9 left-0 z-30 w-56 rounded-lg border border-black/10 bg-white/95 p-1.5 text-[#2f2a1f] shadow-[0_14px_30px_rgba(47,42,31,0.18)]">
          {attachOptions.length > 0 ? (
            attachOptions.map((account) => (
              <button
                key={account.id}
                type="button"
                onClick={() => onAttach(account.id)}
                className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-xs font-medium transition hover:bg-black/5"
              >
                <AccountAvatar account={account} />
                <span className="min-w-0 truncate">{getAccountTitle(account)}</span>
              </button>
            ))
          ) : (
            <p className="px-2 py-2 text-xs opacity-70">All accounts attached</p>
          )}
        </div>
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
  const [accountMenuNoteId, setAccountMenuNoteId] = useState<string | null>(
    null,
  );
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
  const isDraftingRef = useRef(false);
  const locallyCreatedNoteIdsRef = useRef<Set<string>>(new Set());
  const selectedAccountIdRef = useRef(selectedAccountId);
  const draftAccount = draftAccountId
    ? (accountById.get(draftAccountId) ?? null)
    : null;
  const composerAccount = selectedAccount ?? draftAccount;
  const draftNoteStyle = NOTE_COLORS[draftColor];
  const canCreate = Boolean(draft.trim());

  useEffect(() => {
    setBoardNotes((currentNotes) => {
      const accountFilterChanged =
        selectedAccountIdRef.current !== selectedAccountId;
      selectedAccountIdRef.current = selectedAccountId;

      if (accountFilterChanged) {
        locallyCreatedNoteIdsRef.current.clear();
        return normalizedNotes;
      }

      if (pendingAction !== null || isComposerOpen) return currentNotes;

      const currentNoteById = new Map(
        currentNotes.map((note) => [note.id, note]),
      );
      const incomingNoteIds = new Set(normalizedNotes.map((note) => note.id));

      normalizedNotes.forEach((note) => {
        locallyCreatedNoteIdsRef.current.delete(note.id);
      });

      const mergedNotes = normalizedNotes.map((note) => {
        const localNote = currentNoteById.get(note.id);

        if (
          localNote &&
          (note.id === editingNoteId || isLocalNoteNewer(localNote, note))
        ) {
          return localNote;
        }

        return note;
      });

      const localOnlyNotes = currentNotes.filter((note) => {
        return (
          !incomingNoteIds.has(note.id) &&
          (note.id === editingNoteId ||
            locallyCreatedNoteIdsRef.current.has(note.id))
        );
      });

      return [...mergedNotes, ...localOnlyNotes];
    });
  }, [
    editingNoteId,
    isComposerOpen,
    normalizedNotes,
    pendingAction,
    selectedAccountId,
  ]);

  useEffect(() => {
    isDraftingRef.current =
      Boolean(editingNoteId) || isComposerOpen || pendingAction !== null;
  }, [editingNoteId, isComposerOpen, pendingAction]);

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
    if (
      accountMenuNoteId &&
      !boardNotes.some((note) => note.id === accountMenuNoteId)
    ) {
      setAccountMenuNoteId(null);
    }
  }, [accountMenuNoteId, boardNotes]);

  useEffect(() => {
    if (!accountMenuNoteId) return;

    function handleDocumentPointerDown(event: PointerEvent) {
      const target = event.target;

      if (
        target instanceof Element &&
        target.closest("[data-analytics-note-account-menu]")
      ) {
        return;
      }

      setAccountMenuNoteId(null);
    }

    function handleDocumentKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setAccountMenuNoteId(null);
    }

    document.addEventListener("pointerdown", handleDocumentPointerDown);
    document.addEventListener("keydown", handleDocumentKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handleDocumentPointerDown);
      document.removeEventListener("keydown", handleDocumentKeyDown);
    };
  }, [accountMenuNoteId]);

  useEffect(() => {
    if (!("BroadcastChannel" in window)) return;

    const channel = new BroadcastChannel(BOARD_CHANNEL);
    broadcastRef.current = channel;
    channel.onmessage = () => {
      if (!isDraftingRef.current) router.refresh();
    };

    return () => {
      channel.close();
      broadcastRef.current = null;
    };
  }, [router]);

  useEffect(() => {
    const refreshId = window.setInterval(() => {
      if (
        document.visibilityState === "visible" &&
        pendingAction === null &&
        !isDraftingRef.current
      ) {
        router.refresh();
      }
    }, BOARD_REFRESH_MS);

    return () => window.clearInterval(refreshId);
  }, [pendingAction, router]);

  const focusTextAreaAtEnd = useCallback(
    (element: HTMLTextAreaElement | null) => {
      if (!element) return;

      window.requestAnimationFrame(() => {
        resizeTextareaToContent(element);
        element.focus();
        const end = element.value.length;
        element.setSelectionRange(end, end);
      });
    },
    [],
  );

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
        ...currentNotes,
        normalizeNote(createdNote),
      ]);
      locallyCreatedNoteIdsRef.current.add(createdNote.id);
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

  async function saveNoteBody(noteId: string) {
    const note = boardNotes.find((boardNote) => boardNote.id === noteId);
    const body = note?.body.trim();

    if (!note || !body) {
      setError("Note cannot be empty.");
      return;
    }

    setError(null);
    setPendingAction(`update:${noteId}`);

    const saved = await patchNote(
      noteId,
      { body },
      "Note could not be updated.",
    );

    if (saved) {
      setEditingNoteId((currentNoteId) =>
        currentNoteId === noteId ? null : currentNoteId,
      );
    }
    setPendingAction(null);
  }

  async function saveNoteAccounts(note: BoardNote, nextAccountIds: string[]) {
    const accountIds = [...new Set(nextAccountIds)];

    setError(null);
    setPendingAction(`accounts:${note.id}`);

    const saved = await patchNote(
      note.id,
      {
        accountId: accountIds[0] ?? null,
        accountIds,
      },
      "Note accounts could not be updated.",
    );

    if (saved) setAccountMenuNoteId(null);
    setPendingAction(null);
  }

  function attachAccount(note: BoardNote, accountId: string) {
    if (note.accountIds.includes(accountId)) return;

    void saveNoteAccounts(note, [...note.accountIds, accountId]);
  }

  function detachAccount(note: BoardNote, accountId: string) {
    void saveNoteAccounts(
      note,
      note.accountIds.filter((currentAccountId) => currentAccountId !== accountId),
    );
  }

  return (
    <section className="flex min-w-0 flex-col gap-3">
      <header className="flex justify-center text-center">
        <h2 className="analytics-card-title text-ink">Notes</h2>
      </header>

      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {boardNotes.map((note) => {
          const style = NOTE_COLORS[note.color];
          const noteAccounts = getNoteAccounts(note, accountById);
          const attachOptions = accounts.filter(
            (account) => !note.accountIds.includes(account.id),
          );
          const isEditing = editingNoteId === note.id;
          const isAccountMenuOpen = accountMenuNoteId === note.id;
          const isAccountPending =
            pendingAction === `accounts:${note.id}` ||
            pendingAction === `update:${note.id}`;

          return (
            <article
              key={note.id}
              className="flex min-h-44 w-full cursor-default flex-col rounded-none p-4 font-medium"
              style={{
                backgroundColor: style.paper,
                color: style.text,
                filter: NOTE_SHADOW,
                transform: `rotate(${getNoteRotation(note.id)}deg)`,
              }}
              onClick={() => setEditingNoteId(note.id)}
            >
              <div className="flex-1">
                {isEditing ? (
                  <textarea
                    ref={focusTextAreaAtEnd}
                    value={note.body}
                    onChange={(event) => {
                      resizeTextareaToContent(event.currentTarget);
                      updateLocalNote(note.id, { body: event.target.value });
                    }}
                    onBlur={() => void saveNoteBody(note.id)}
                    maxLength={500}
                    rows={1}
                    className="block min-h-[6rem] w-full resize-none overflow-hidden border-0 bg-transparent p-0 text-sm font-medium leading-6 text-current outline-none"
                  />
                ) : (
                  <p className="whitespace-pre-wrap break-words text-sm font-medium leading-6">
                    {note.body}
                  </p>
                )}
              </div>
              <NoteAccountFooter
                accounts={noteAccounts}
                attachOptions={attachOptions}
                isAttachOpen={isAccountMenuOpen}
                onToggleAttach={() =>
                  setAccountMenuNoteId((currentNoteId) =>
                    currentNoteId === note.id ? null : note.id,
                  )
                }
                onAttach={(accountId) => attachAccount(note, accountId)}
                onDetach={(accountId) => detachAccount(note, accountId)}
                pending={isAccountPending}
              />
            </article>
          );
        })}

        {isComposerOpen ? (
          <form
            onSubmit={createNote}
            className="flex min-h-44 w-full flex-col rounded-none p-4 font-medium"
            style={{
              backgroundColor: draftNoteStyle.paper,
              color: draftNoteStyle.text,
              filter: NOTE_SHADOW,
              transform: "rotate(-0.4deg)",
            }}
          >
            <div className="mb-2 flex justify-end">
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
              onChange={(event) => {
                resizeTextareaToContent(event.currentTarget);
                setDraft(event.target.value);
              }}
              maxLength={500}
              autoFocus
              rows={1}
              placeholder="Write a note..."
              className="block min-h-[6rem] resize-none overflow-hidden border-0 bg-transparent p-0 text-sm font-medium leading-6 text-current outline-none placeholder:text-current placeholder:opacity-60"
            />
            <div className="mt-3 flex h-8 shrink-0 items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                {composerAccount ? (
                  <span
                    className="flex h-7 max-w-full items-center gap-1.5 rounded-full bg-white/35 px-1.5 pr-2 text-xs font-medium opacity-80"
                    title={getAccountTitle(composerAccount)}
                  >
                    <AccountAvatar account={composerAccount} />
                    <span className="min-w-0 truncate">
                      {getAccountTitle(composerAccount)}
                    </span>
                  </span>
                ) : null}
              </div>
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
        ) : (
          <button
            type="button"
            onClick={openComposer}
            title="Add note"
            aria-label="Add note"
            className="flex min-h-44 w-full flex-col items-center justify-center gap-2 rounded-none border border-dashed border-[#d8d0a8] bg-transparent p-4 text-sm font-medium text-muted transition hover:border-[#bfb48a] hover:text-ink"
          >
            <Plus className="size-5" strokeWidth={1.7} />
            <span>Add note</span>
          </button>
        )}
      </div>
    </section>
  );
}
