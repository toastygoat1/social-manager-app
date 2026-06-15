"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type PointerEvent,
} from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Grip,
  LoaderCircle,
  Maximize2,
  Pencil,
  Plus,
  StickyNote,
  Trash2,
  X,
} from "lucide-react";
import { AvatarImage } from "@/app/_components/AvatarImage";
import type { Account } from "@/app/dashboard/_components/data";
import { ApiError, apiFetchBrowser } from "@/lib/api/browser-client";
import type { AnalyticsNote } from "./data";

type NotesBoardProps = {
  notes: AnalyticsNote[];
  accounts: Account[];
  selectedAccountId: string | null;
};

type NoteColor = "yellow" | "blue" | "pink" | "green" | "lavender" | "white";

type NoteStyle = {
  label: string;
  paper: string;
  border: string;
  activeBorder: string;
  control: string;
  swatch: string;
};

type BoardNote = Omit<AnalyticsNote, "color"> & { color: NoteColor };

type BoardInteraction = {
  noteId: string;
  startPointerX: number;
  startPointerY: number;
  startBoardX: number;
  startBoardY: number;
  startWidth: number;
  startHeight: number;
  zIndex: number;
  latestLayout: NoteLayoutPatch;
  type: "move" | "resize";
};

type NoteLayoutPatch = Pick<
  AnalyticsNote,
  "boardX" | "boardY" | "boardWidth" | "boardHeight" | "zIndex"
>;

type NotePatch = Partial<
  Pick<
    AnalyticsNote,
    | "body"
    | "boardX"
    | "boardY"
    | "boardWidth"
    | "boardHeight"
    | "color"
    | "zIndex"
  >
> & {
  accountId?: string | null;
};

const NOTE_COLORS = {
  yellow: {
    label: "Yellow",
    paper: "bg-[#fff2ad]",
    border: "border-[#e3c75e]",
    activeBorder: "ring-[#b98712]",
    control: "hover:bg-[#fff8cf]",
    swatch: "#fff2ad",
  },
  blue: {
    label: "Blue",
    paper: "bg-[#dff4ff]",
    border: "border-[#93c8df]",
    activeBorder: "ring-[#367f9e]",
    control: "hover:bg-[#f0fbff]",
    swatch: "#dff4ff",
  },
  pink: {
    label: "Pink",
    paper: "bg-[#ffe2ec]",
    border: "border-[#e8a5bc]",
    activeBorder: "ring-[#b84f75]",
    control: "hover:bg-[#fff2f6]",
    swatch: "#ffe2ec",
  },
  green: {
    label: "Green",
    paper: "bg-[#e5f6d3]",
    border: "border-[#aac985]",
    activeBorder: "ring-[#638a35]",
    control: "hover:bg-[#f3fbeb]",
    swatch: "#e5f6d3",
  },
  lavender: {
    label: "Lavender",
    paper: "bg-[#eee6ff]",
    border: "border-[#b9a7df]",
    activeBorder: "ring-[#7259aa]",
    control: "hover:bg-[#f7f2ff]",
    swatch: "#eee6ff",
  },
  white: {
    label: "White",
    paper: "bg-white",
    border: "border-[#d9d5ca]",
    activeBorder: "ring-[#716a5e]",
    control: "hover:bg-[#f7f5ef]",
    swatch: "#ffffff",
  },
} satisfies Record<NoteColor, NoteStyle>;

const NOTE_COLOR_ORDER: NoteColor[] = [
  "yellow",
  "blue",
  "pink",
  "green",
  "lavender",
  "white",
];

const ACCOUNT_TONE_COLORS: Record<string, NoteColor> = {
  blue: "blue",
  cyan: "blue",
  pink: "pink",
  yellow: "yellow",
};

const DEFAULT_NOTE_COLOR: NoteColor = "yellow";
const DEFAULT_NOTE_WIDTH = 250;
const DEFAULT_NOTE_HEIGHT = 220;
const MIN_NOTE_WIDTH = 180;
const MIN_NOTE_HEIGHT = 160;
const MAX_NOTE_WIDTH = 520;
const MAX_NOTE_HEIGHT = 520;
const BOARD_PADDING = 32;
const BOARD_MIN_WIDTH = 1040;
const BOARD_MIN_HEIGHT = 620;
const BOARD_MAX_POSITION = 2400;
const NOTE_GAP = 28;
const BOARD_REFRESH_MS = 6000;
const BOARD_CHANNEL = "analytics-notes-board";

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

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getNumber(value: number, fallback: number) {
  return Number.isFinite(value) ? value : fallback;
}

function normalizeNoteForBoard(note: AnalyticsNote, index: number): BoardNote {
  return {
    ...note,
    boardX: clamp(getNumber(note.boardX, BOARD_PADDING), 0, BOARD_MAX_POSITION),
    boardY: clamp(getNumber(note.boardY, BOARD_PADDING), 0, BOARD_MAX_POSITION),
    boardWidth: clamp(
      getNumber(note.boardWidth, DEFAULT_NOTE_WIDTH),
      MIN_NOTE_WIDTH,
      MAX_NOTE_WIDTH,
    ),
    boardHeight: clamp(
      getNumber(note.boardHeight, DEFAULT_NOTE_HEIGHT),
      MIN_NOTE_HEIGHT,
      MAX_NOTE_HEIGHT,
    ),
    color: isNoteColor(note.color) ? note.color : DEFAULT_NOTE_COLOR,
    zIndex: clamp(getNumber(note.zIndex, index + 1), 1, 10000),
  };
}

function getNextNoteLayout(notes: AnalyticsNote[]) {
  const index = notes.length;
  const columns = 4;

  return {
    boardX:
      BOARD_PADDING + (index % columns) * (DEFAULT_NOTE_WIDTH + NOTE_GAP),
    boardY:
      BOARD_PADDING +
      Math.floor(index / columns) * (DEFAULT_NOTE_HEIGHT + NOTE_GAP),
    boardWidth: DEFAULT_NOTE_WIDTH,
    boardHeight: DEFAULT_NOTE_HEIGHT,
  };
}

function getBoardSize(notes: AnalyticsNote[], composerLayout: NoteLayoutPatch) {
  const extents = notes.map((note) => ({
    right: note.boardX + note.boardWidth,
    bottom: note.boardY + note.boardHeight,
  }));

  extents.push({
    right: composerLayout.boardX + composerLayout.boardWidth,
    bottom: composerLayout.boardY + composerLayout.boardHeight,
  });

  return extents.reduce(
    (size, extent) => ({
      width: Math.max(size.width, extent.right + BOARD_PADDING),
      height: Math.max(size.height, extent.bottom + BOARD_PADDING),
    }),
    { width: BOARD_MIN_WIDTH, height: BOARD_MIN_HEIGHT },
  );
}

function isControlTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    Boolean(target.closest("button, textarea, select, input, label, a"))
  );
}

function AccountAvatar({ account }: { account: Account | null }) {
  const accountTitle = getAccountTitle(account);
  const accountHandle = getAccountHandle(account);

  return (
    <span
      aria-label={`${accountTitle} ${accountHandle}`}
      title={`${accountTitle} ${accountHandle}`}
      className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#2f2a1f] text-[10px] font-semibold text-white ring-2 ring-white/70"
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
        className="h-9 min-w-0 rounded-md border border-black/10 bg-white/60 px-2 font-sans text-xs normal-case tracking-normal text-[#3b3324] outline-none transition focus:border-[#9b6b13] disabled:opacity-60"
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

function ColorSwatches({
  disabled,
  onChange,
  value,
}: {
  disabled?: boolean;
  onChange: (color: NoteColor) => void;
  value: NoteColor;
}) {
  return (
    <div className="flex items-center gap-1">
      {NOTE_COLOR_ORDER.map((color) => {
        const style = NOTE_COLORS[color];
        const isSelected = color === value;

        return (
          <button
            key={color}
            type="button"
            onClick={() => onChange(color)}
            disabled={disabled}
            title={style.label}
            aria-label={style.label}
            className={`size-5 rounded-full border border-black/15 transition ${
              isSelected ? "ring-2 ring-[#2f2a1f] ring-offset-1" : ""
            } disabled:pointer-events-none disabled:opacity-50`}
            style={{ backgroundColor: style.swatch }}
          />
        );
      })}
    </div>
  );
}

export function NotesBoard({
  notes,
  accounts,
  selectedAccountId,
}: NotesBoardProps) {
  const router = useRouter();
  const normalizedNotes = useMemo(
    () => notes.map((note, index) => normalizeNoteForBoard(note, index)),
    [notes],
  );
  const accountById = useMemo(
    () => new Map(accounts.map((account) => [account.id, account])),
    [accounts],
  );
  const selectedAccount = selectedAccountId
    ? accountById.get(selectedAccountId) ?? null
    : null;
  const [boardNotes, setBoardNotes] = useState(normalizedNotes);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [composerLayout, setComposerLayout] = useState<NoteLayoutPatch>({
    ...getNextNoteLayout(normalizedNotes),
    zIndex: 1,
  });
  const [draft, setDraft] = useState("");
  const [draftAccountId, setDraftAccountId] = useState(() =>
    getDefaultDraftAccountId(accounts, selectedAccountId),
  );
  const [draftColor, setDraftColor] = useState<NoteColor>(() =>
    getDefaultNoteColor(selectedAccount, 0),
  );
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingBody, setEditingBody] = useState("");
  const [editingAccountId, setEditingAccountId] = useState("");
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const interactionRef = useRef<BoardInteraction | null>(null);
  const cleanupInteractionRef = useRef<(() => void) | null>(null);
  const broadcastRef = useRef<BroadcastChannel | null>(null);
  const draftAccount = draftAccountId
    ? accountById.get(draftAccountId) ?? null
    : null;
  const composerAccount = selectedAccount ?? draftAccount;
  const canCreate = Boolean(draft.trim()) && Boolean(composerAccount);
  const topZIndex = useMemo(
    () => Math.max(1, ...boardNotes.map((note) => note.zIndex)),
    [boardNotes],
  );
  const boardSize = useMemo(
    () => getBoardSize(boardNotes, composerLayout),
    [boardNotes, composerLayout],
  );

  useEffect(() => {
    if (interactionRef.current) return;
    setBoardNotes(normalizedNotes);
  }, [normalizedNotes]);

  useEffect(() => {
    setDraftAccountId(getDefaultDraftAccountId(accounts, selectedAccountId));
  }, [accounts, selectedAccountId]);

  useEffect(() => {
    if (
      selectedNoteId &&
      !boardNotes.some((note) => note.id === selectedNoteId)
    ) {
      setSelectedNoteId(null);
    }
  }, [boardNotes, selectedNoteId]);

  useEffect(() => {
    if (!("BroadcastChannel" in window)) return;

    const channel = new BroadcastChannel(BOARD_CHANNEL);
    broadcastRef.current = channel;
    channel.onmessage = () => {
      if (!interactionRef.current) router.refresh();
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
        !interactionRef.current &&
        !editingNoteId &&
        pendingAction === null
      ) {
        router.refresh();
      }
    }, BOARD_REFRESH_MS);

    return () => window.clearInterval(refreshId);
  }, [editingNoteId, pendingAction, router]);

  useEffect(() => {
    return () => cleanupInteractionRef.current?.();
  }, []);

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
        currentNotes.map((note, index) =>
          note.id === noteId ? normalizeNoteForBoard(updatedNote, index) : note,
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
    const layout = getNextNoteLayout(boardNotes);
    const color = getDefaultNoteColor(composerAccount, boardNotes.length);

    setComposerLayout({ ...layout, zIndex: topZIndex + 1 });
    setDraftColor(color);
    setIsComposerOpen(true);
    setEditingNoteId(null);
    setSelectedNoteId(null);
    setError(null);
  }

  async function createNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const body = draft.trim();
    if (!body || !canCreate) return;

    setPendingAction("create");
    setError(null);

    try {
      const createdNote = await apiFetchBrowser<AnalyticsNote>("/analytics/notes", {
        method: "POST",
        body: {
          body,
          accountId: composerAccount?.id,
          boardX: composerLayout.boardX,
          boardY: composerLayout.boardY,
          boardWidth: composerLayout.boardWidth,
          boardHeight: composerLayout.boardHeight,
          color: draftColor,
          zIndex: topZIndex + 1,
        },
      });
      const normalizedNote = normalizeNoteForBoard(createdNote, 0);

      setBoardNotes((currentNotes) => [normalizedNote, ...currentNotes]);
      setSelectedNoteId(createdNote.id);
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

  async function updateNote(noteId: string) {
    const body = editingBody.trim();
    if (!body || !editingAccountId) return;

    setPendingAction(`update:${noteId}`);
    setError(null);

    const didUpdate = await patchNote(
      noteId,
      {
        body,
        accountId: editingAccountId,
      },
      "Note could not be updated.",
    );

    if (didUpdate) {
      setEditingNoteId(null);
      setEditingBody("");
      setEditingAccountId("");
    }

    setPendingAction(null);
  }

  async function deleteNote(noteId: string) {
    setPendingAction(`delete:${noteId}`);
    setError(null);

    try {
      await apiFetchBrowser(`/analytics/notes/${encodeURIComponent(noteId)}`, {
        method: "DELETE",
      });
      setBoardNotes((currentNotes) =>
        currentNotes.filter((note) => note.id !== noteId),
      );
      if (selectedNoteId === noteId) setSelectedNoteId(null);
      notifyBoardChange();
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
    const fallbackAccountId = getDefaultDraftAccountId(
      accounts,
      selectedAccountId,
    );

    cleanupInteractionRef.current?.();
    setSelectedNoteId(note.id);
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

  function changeNoteColor(noteId: string, color: NoteColor) {
    const nextZIndex = topZIndex + 1;

    setSelectedNoteId(noteId);
    updateLocalNote(noteId, { color, zIndex: nextZIndex });
    void patchNote(
      noteId,
      { color, zIndex: nextZIndex },
      "Note color could not be updated.",
    );
  }

  function startInteraction(
    event: PointerEvent<HTMLElement>,
    note: AnalyticsNote,
    type: BoardInteraction["type"],
  ) {
    if (event.button !== 0 || (type === "move" && isControlTarget(event.target))) {
      return;
    }

    event.preventDefault();
    cleanupInteractionRef.current?.();

    const nextZIndex = topZIndex + 1;
    const start: BoardInteraction = {
      noteId: note.id,
      startPointerX: event.clientX,
      startPointerY: event.clientY,
      startBoardX: note.boardX,
      startBoardY: note.boardY,
      startWidth: note.boardWidth,
      startHeight: note.boardHeight,
      zIndex: nextZIndex,
      latestLayout: {
        boardX: note.boardX,
        boardY: note.boardY,
        boardWidth: note.boardWidth,
        boardHeight: note.boardHeight,
        zIndex: nextZIndex,
      },
      type,
    };

    interactionRef.current = start;
    setSelectedNoteId(note.id);
    updateLocalNote(note.id, { zIndex: nextZIndex });

    const handlePointerMove = (pointerEvent: globalThis.PointerEvent) => {
      const interaction = interactionRef.current;
      if (!interaction) return;

      const deltaX = pointerEvent.clientX - interaction.startPointerX;
      const deltaY = pointerEvent.clientY - interaction.startPointerY;
      const nextLayout =
        interaction.type === "move"
          ? {
              boardX: clamp(
                interaction.startBoardX + deltaX,
                0,
                BOARD_MAX_POSITION,
              ),
              boardY: clamp(
                interaction.startBoardY + deltaY,
                0,
                BOARD_MAX_POSITION,
              ),
              boardWidth: interaction.startWidth,
              boardHeight: interaction.startHeight,
              zIndex: interaction.zIndex,
            }
          : {
              boardX: interaction.startBoardX,
              boardY: interaction.startBoardY,
              boardWidth: clamp(
                interaction.startWidth + deltaX,
                MIN_NOTE_WIDTH,
                MAX_NOTE_WIDTH,
              ),
              boardHeight: clamp(
                interaction.startHeight + deltaY,
                MIN_NOTE_HEIGHT,
                MAX_NOTE_HEIGHT,
              ),
              zIndex: interaction.zIndex,
            };

      interaction.latestLayout = nextLayout;
      updateLocalNote(interaction.noteId, nextLayout);
    };

    const handlePointerEnd = (pointerEvent: globalThis.PointerEvent) => {
      handlePointerMove(pointerEvent);

      const interaction = interactionRef.current;
      const finalLayout = interaction?.latestLayout;
      cleanupInteractionRef.current?.();

      if (interaction && finalLayout) {
        void patchNote(
          interaction.noteId,
          finalLayout,
          "Note position could not be saved.",
        );
      }
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerEnd, { once: true });
    window.addEventListener("pointercancel", handlePointerEnd, { once: true });
    cleanupInteractionRef.current = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerEnd);
      window.removeEventListener("pointercancel", handlePointerEnd);
      interactionRef.current = null;
      cleanupInteractionRef.current = null;
    };
  }

  return (
    <section className="flex min-w-0 flex-col gap-4 overflow-hidden rounded-[10px] border border-line bg-paper p-[18px]">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <StickyNote className="size-4 text-[#9b6b13]" strokeWidth={1.8} />
          <div>
            <h2 className="text-sm font-semibold text-ink">Notes</h2>
            <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.04em] text-muted">
              {selectedAccount ? getAccountTitle(selectedAccount) : "All accounts"}
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
            disabled={accounts.length === 0 || isComposerOpen}
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

      <div className="h-[620px] overflow-auto rounded-lg border border-line bg-[#efede7] p-3 shadow-inner">
        <div
          className="relative rounded-md border border-[#d7d2c6] bg-[#fbfaf6]"
          style={
            {
              width: boardSize.width,
              height: boardSize.height,
              backgroundImage:
                "radial-gradient(circle, rgba(47,42,31,0.13) 1px, transparent 1px)",
              backgroundSize: "22px 22px",
            } satisfies CSSProperties
          }
        >
          {boardNotes.map((note) => {
            const isEditing = editingNoteId === note.id;
            const isSelected = selectedNoteId === note.id;
            const isUpdating = pendingAction === `update:${note.id}`;
            const isDeleting = pendingAction === `delete:${note.id}`;
            const noteAccount = note.accountId
              ? accountById.get(note.accountId) ?? null
              : null;
            const editingAccount = editingAccountId
              ? accountById.get(editingAccountId) ?? null
              : null;
            const color = isNoteColor(note.color) ? note.color : DEFAULT_NOTE_COLOR;
            const style = NOTE_COLORS[color];

            return (
              <article
                key={note.id}
                onPointerDown={(event) => startInteraction(event, note, "move")}
                className={`absolute flex flex-col overflow-hidden rounded-md border text-[#2f2a1f] shadow-[0_12px_24px_rgba(47,42,31,0.13)] transition-shadow ${style.paper} ${style.border} ${
                  isSelected ? `ring-2 ring-offset-2 ${style.activeBorder}` : ""
                }`}
                style={{
                  left: note.boardX,
                  top: note.boardY,
                  width: note.boardWidth,
                  height: note.boardHeight,
                  zIndex: note.zIndex,
                  touchAction: "none",
                }}
              >
                <div className="flex h-10 shrink-0 items-center gap-2 border-b border-black/10 px-3">
                  <Grip
                    className="size-4 shrink-0 text-[#6e6046]"
                    strokeWidth={1.7}
                  />
                  <div className="min-w-0 flex-1">
                    {isEditing ? (
                      <span className="font-mono text-[10px] uppercase text-[#6e6046]">
                        Edit
                      </span>
                    ) : (
                      <span className="block truncate font-mono text-[10px] uppercase text-[#6e6046]">
                        {formatNoteDate(note.updatedAt)}
                      </span>
                    )}
                  </div>
                  <AccountAvatar account={isEditing ? editingAccount : noteAccount} />
                </div>

                <div className="min-h-0 flex-1 px-3 py-3">
                  {isEditing ? (
                    <div className="flex h-full flex-col gap-3">
                      <AccountSelect
                        accounts={accounts}
                        disabled={isUpdating}
                        id={`note-account-${note.id}`}
                        label="Account"
                        onChange={setEditingAccountId}
                        value={editingAccountId}
                      />
                      <textarea
                        value={editingBody}
                        onChange={(event) => setEditingBody(event.target.value)}
                        maxLength={500}
                        rows={5}
                        className="min-h-0 flex-1 resize-none rounded-md border border-black/10 bg-white/50 px-3 py-2 text-sm leading-6 text-[#2f2a1f] outline-none transition focus:border-[#9b6b13]"
                      />
                    </div>
                  ) : (
                    <p className="h-full overflow-y-auto whitespace-pre-wrap break-words text-sm leading-6 text-[#2f2a1f]">
                      {note.body}
                    </p>
                  )}
                </div>

                <div className="mt-auto flex h-11 shrink-0 items-center justify-between gap-2 border-t border-black/10 px-2.5">
                  {isSelected || isEditing ? (
                    <ColorSwatches
                      disabled={Boolean(pendingAction)}
                      onChange={(nextColor) => changeNoteColor(note.id, nextColor)}
                      value={color}
                    />
                  ) : (
                    <span className="text-xs font-semibold text-[#6e6046]">
                      {getAccountTitle(noteAccount)}
                    </span>
                  )}

                  <div className="flex items-center gap-1">
                    {isEditing ? (
                      <>
                        <button
                          type="button"
                          onClick={() => updateNote(note.id)}
                          disabled={
                            !editingBody.trim() || !editingAccountId || isUpdating
                          }
                          title="Save note"
                          aria-label="Save note"
                          className={`flex size-8 items-center justify-center rounded-md text-[#287447] transition ${style.control} disabled:pointer-events-none disabled:opacity-50`}
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
                          className={`flex size-8 items-center justify-center rounded-md text-[#6e6046] transition ${style.control} hover:text-[#2f2a1f]`}
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
                          className={`flex size-8 items-center justify-center rounded-md text-[#6e6046] transition ${style.control} hover:text-[#2f2a1f]`}
                        >
                          <Pencil className="size-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteNote(note.id)}
                          disabled={isDeleting}
                          title="Delete note"
                          aria-label="Delete note"
                          className={`flex size-8 items-center justify-center rounded-md text-[#6e6046] transition ${style.control} hover:text-[#a33d3d] disabled:pointer-events-none disabled:opacity-50`}
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

                <button
                  type="button"
                  onPointerDown={(event) => startInteraction(event, note, "resize")}
                  title="Resize note"
                  aria-label="Resize note"
                  className="absolute bottom-1 right-1 flex size-6 items-center justify-center rounded-md text-[#6e6046] transition hover:bg-white/45 hover:text-[#2f2a1f]"
                >
                  <Maximize2 className="size-3.5" />
                </button>
              </article>
            );
          })}

          {isComposerOpen ? (
            <form
              onSubmit={createNote}
              className={`absolute flex flex-col overflow-hidden rounded-md border text-[#2f2a1f] shadow-[0_12px_24px_rgba(47,42,31,0.13)] ${NOTE_COLORS[draftColor].paper} ${NOTE_COLORS[draftColor].border}`}
              style={{
                left: composerLayout.boardX,
                top: composerLayout.boardY,
                width: composerLayout.boardWidth,
                height: composerLayout.boardHeight,
                zIndex: composerLayout.zIndex,
              }}
            >
              <div className="flex h-10 shrink-0 items-center justify-between gap-3 border-b border-black/10 px-3">
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

              <div className="flex min-h-0 flex-1 flex-col gap-3 px-3 py-3">
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
                  className="min-h-0 flex-1 resize-none rounded-md border border-black/10 bg-white/50 px-3 py-2 text-sm leading-6 text-[#2f2a1f] outline-none transition placeholder:text-[#8a7958] focus:border-[#9b6b13]"
                />
              </div>

              <div className="mt-auto flex h-11 shrink-0 items-center justify-between gap-2 border-t border-black/10 px-2.5">
                <ColorSwatches
                  disabled={pendingAction === "create"}
                  onChange={setDraftColor}
                  value={draftColor}
                />
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] text-[#6e6046]">
                    {draft.length}/500
                  </span>
                  <button
                    type="submit"
                    disabled={!canCreate || pendingAction === "create"}
                    title="Add note"
                    aria-label="Add note"
                    className="flex size-8 items-center justify-center rounded-md bg-[#2f2a1f] text-white transition hover:bg-[#4a402e] disabled:pointer-events-none disabled:opacity-60"
                  >
                    {pendingAction === "create" ? (
                      <LoaderCircle className="size-4 animate-spin" />
                    ) : (
                      <Plus className="size-4" />
                    )}
                  </button>
                </div>
              </div>
            </form>
          ) : null}
        </div>
      </div>
    </section>
  );
}
