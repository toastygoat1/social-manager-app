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
  Grip,
  LoaderCircle,
  Plus,
  StickyNote,
  X,
} from "lucide-react";
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
  swatch: string;
};

type BoardNote = Omit<AnalyticsNote, "color" | "accountIds"> & {
  accountIds: string[];
  color: NoteColor;
};

type ResizeEdge = "n" | "e" | "s" | "w";

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
  edge?: ResizeEdge;
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
    | "accountIds"
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
    swatch: "#fff2ad",
  },
  blue: {
    label: "Blue",
    paper: "bg-[#dff4ff]",
    border: "border-[#93c8df]",
    activeBorder: "ring-[#367f9e]",
    swatch: "#dff4ff",
  },
  pink: {
    label: "Pink",
    paper: "bg-[#ffe2ec]",
    border: "border-[#e8a5bc]",
    activeBorder: "ring-[#b84f75]",
    swatch: "#ffe2ec",
  },
  green: {
    label: "Green",
    paper: "bg-[#e5f6d3]",
    border: "border-[#aac985]",
    activeBorder: "ring-[#638a35]",
    swatch: "#e5f6d3",
  },
  lavender: {
    label: "Lavender",
    paper: "bg-[#eee6ff]",
    border: "border-[#b9a7df]",
    activeBorder: "ring-[#7259aa]",
    swatch: "#eee6ff",
  },
  white: {
    label: "White",
    paper: "bg-white",
    border: "border-[#d9d5ca]",
    activeBorder: "ring-[#716a5e]",
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
const BOARD_WIDTH = 1040;
const BOARD_PADDING = 32;
const BOARD_MIN_HEIGHT = 620;
const BOARD_MAX_Y = 5000;
const NOTE_GAP = 28;
const TOOLBAR_WIDTH = 430;
const BOARD_REFRESH_MS = 6000;
const BOARD_CHANNEL = "analytics-notes-board";

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

function clampInt(value: number, min: number, max: number) {
  return Math.round(clamp(value, min, max));
}

function getNumber(value: number, fallback: number) {
  return Number.isFinite(value) ? value : fallback;
}

function getNoteAccountIds(note: AnalyticsNote | BoardNote) {
  if (note.accountIds.length > 0) return note.accountIds;
  return note.accountId ? [note.accountId] : [];
}

function getMaxBoardX(width: number) {
  return Math.max(0, BOARD_WIDTH - width - BOARD_PADDING);
}

function clampBoardX(value: number, width: number) {
  return clampInt(value, 0, getMaxBoardX(width));
}

function normalizeNoteForBoard(note: AnalyticsNote, index: number): BoardNote {
  const boardWidth = clampInt(
    getNumber(note.boardWidth, DEFAULT_NOTE_WIDTH),
    MIN_NOTE_WIDTH,
    MAX_NOTE_WIDTH,
  );

  return {
    ...note,
    accountIds: getNoteAccountIds(note),
    boardX: clampBoardX(getNumber(note.boardX, BOARD_PADDING), boardWidth),
    boardY: clampInt(
      getNumber(note.boardY, BOARD_PADDING),
      0,
      BOARD_MAX_Y,
    ),
    boardWidth,
    boardHeight: clampInt(
      getNumber(note.boardHeight, DEFAULT_NOTE_HEIGHT),
      MIN_NOTE_HEIGHT,
      MAX_NOTE_HEIGHT,
    ),
    color: isNoteColor(note.color) ? note.color : DEFAULT_NOTE_COLOR,
    zIndex: clampInt(getNumber(note.zIndex, index + 1), 1, 10000),
  };
}

function getNextNoteLayout(notes: AnalyticsNote[]) {
  const index = notes.length;
  const columns = Math.max(
    1,
    Math.floor(
      (BOARD_WIDTH - BOARD_PADDING * 2 + NOTE_GAP) /
        (DEFAULT_NOTE_WIDTH + NOTE_GAP),
    ),
  );

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
      width: BOARD_WIDTH,
      height: Math.max(size.height, extent.bottom + BOARD_PADDING),
    }),
    { width: BOARD_WIDTH, height: BOARD_MIN_HEIGHT },
  );
}

function isControlTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    Boolean(target.closest("button, textarea, select, input, label, a"))
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
  const selectedNote = selectedNoteId
    ? boardNotes.find((note) => note.id === selectedNoteId) ?? null
    : null;
  const toolbarPosition = selectedNote
    ? {
        left: clampInt(
          selectedNote.boardX,
          BOARD_PADDING / 2,
          BOARD_WIDTH - TOOLBAR_WIDTH - BOARD_PADDING / 2,
        ),
        top: Math.max(BOARD_PADDING / 2, selectedNote.boardY - 56),
      }
    : null;

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
        pendingAction === null
      ) {
        router.refresh();
      }
    }, BOARD_REFRESH_MS);

    return () => window.clearInterval(refreshId);
  }, [pendingAction, router]);

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
          accountIds: composerAccount ? [composerAccount.id] : [],
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

  function saveNoteBody(noteId: string) {
    const note = boardNotes.find((boardNote) => boardNote.id === noteId);
    const body = note?.body.trim();

    if (!note || !body) {
      setError("Note cannot be empty.");
      router.refresh();
      return;
    }

    setError(null);
    void patchNote(noteId, { body }, "Note could not be updated.");
  }

  function toggleNoteAccount(noteId: string, accountId: string) {
    const note = boardNotes.find((boardNote) => boardNote.id === noteId);
    if (!note) return;

    const selectedIds = new Set(note.accountIds);
    if (selectedIds.has(accountId)) {
      selectedIds.delete(accountId);
    } else {
      selectedIds.add(accountId);
    }

    const accountIds = accounts
      .map((account) => account.id)
      .filter((candidateId) => selectedIds.has(candidateId));
    const primaryAccountId = accountIds[0] ?? null;

    updateLocalNote(noteId, {
      accountId: primaryAccountId,
      accountIds,
    });
    void patchNote(
      noteId,
      { accountId: primaryAccountId, accountIds },
      "Note accounts could not be updated.",
    );
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
    edge?: ResizeEdge,
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
      edge,
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
      let nextX = interaction.startBoardX;
      let nextY = interaction.startBoardY;
      let nextWidth = interaction.startWidth;
      let nextHeight = interaction.startHeight;

      if (interaction.type === "move") {
        nextX = clampBoardX(interaction.startBoardX + deltaX, nextWidth);
        nextY = clampInt(interaction.startBoardY + deltaY, 0, BOARD_MAX_Y);
      } else {
        const edgeName = interaction.edge;

        if (edgeName === "e") {
          nextWidth = clampInt(
            interaction.startWidth + deltaX,
            MIN_NOTE_WIDTH,
            Math.min(
              MAX_NOTE_WIDTH,
              BOARD_WIDTH - interaction.startBoardX - BOARD_PADDING,
            ),
          );
        }

        if (edgeName === "w") {
          const fixedRight = interaction.startBoardX + interaction.startWidth;
          nextWidth = clampInt(
            interaction.startWidth - deltaX,
            MIN_NOTE_WIDTH,
            Math.min(MAX_NOTE_WIDTH, fixedRight),
          );
          nextX = clampInt(fixedRight - nextWidth, 0, fixedRight - MIN_NOTE_WIDTH);
        }

        if (edgeName === "s") {
          nextHeight = clampInt(
            interaction.startHeight + deltaY,
            MIN_NOTE_HEIGHT,
            MAX_NOTE_HEIGHT,
          );
        }

        if (edgeName === "n") {
          const fixedBottom = interaction.startBoardY + interaction.startHeight;
          nextHeight = clampInt(
            interaction.startHeight - deltaY,
            MIN_NOTE_HEIGHT,
            Math.min(MAX_NOTE_HEIGHT, fixedBottom),
          );
          nextY = clampInt(
            fixedBottom - nextHeight,
            0,
            fixedBottom - MIN_NOTE_HEIGHT,
          );
        }
      }

      const nextLayout = {
        boardX: nextX,
        boardY: nextY,
        boardWidth: nextWidth,
        boardHeight: nextHeight,
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
    <section className="flex min-w-0 flex-col gap-3">
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

      <div className="overflow-x-auto">
        <div
          onPointerDown={(event) => {
            if (event.currentTarget === event.target) setSelectedNoteId(null);
          }}
          className="relative border border-[#d7d2c6] bg-[#fbfaf6]"
          style={
            {
              width: BOARD_WIDTH,
              height: boardSize.height,
              backgroundImage:
                "radial-gradient(circle, rgba(47,42,31,0.13) 1px, transparent 1px)",
              backgroundSize: "22px 22px",
            } satisfies CSSProperties
          }
        >
          {selectedNote && toolbarPosition ? (
            <div
              className="absolute z-[10050] flex h-10 items-center gap-1 rounded-md border border-[#d9d5ca] bg-white px-2 shadow-[0_10px_24px_rgba(47,42,31,0.16)]"
              style={{
                left: toolbarPosition.left,
                top: toolbarPosition.top,
                width: TOOLBAR_WIDTH,
              }}
            >
              <details className="relative">
                <summary className="flex h-8 cursor-pointer list-none items-center gap-2 rounded px-2 text-xs font-medium text-[#3b3324] transition hover:bg-[#f3f1ea]">
                  <span>Accounts</span>
                  <span className="rounded bg-[#ede9de] px-1.5 py-0.5 font-mono text-[10px] text-[#6e6046]">
                    {selectedNote.accountIds.length || "None"}
                  </span>
                </summary>
                <div className="absolute left-0 top-10 z-[10060] flex max-h-64 w-64 flex-col gap-1 overflow-y-auto rounded-md border border-[#d9d5ca] bg-white p-2 shadow-[0_12px_24px_rgba(47,42,31,0.18)]">
                  {accounts.map((account) => {
                    const isChecked = selectedNote.accountIds.includes(account.id);

                    return (
                      <label
                        key={account.id}
                        className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs text-[#3b3324] hover:bg-[#f3f1ea]"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() =>
                            toggleNoteAccount(selectedNote.id, account.id)
                          }
                          className="size-3.5 accent-[#2f2a1f]"
                        />
                        <span className="min-w-0 truncate">
                          {getAccountTitle(account)}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </details>
              <span className="h-6 w-px bg-[#d9d5ca]" />
              <ColorSwatches
                disabled={Boolean(pendingAction)}
                onChange={(nextColor) =>
                  changeNoteColor(selectedNote.id, nextColor)
                }
                value={selectedNote.color}
              />
            </div>
          ) : null}

          {boardNotes.map((note) => {
            const isSelected = selectedNoteId === note.id;
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
                <div className="flex h-8 shrink-0 items-center border-b border-black/10 px-3">
                  <Grip
                    className="size-4 shrink-0 text-[#6e6046]"
                    strokeWidth={1.7}
                  />
                </div>

                <div className="min-h-0 flex-1 px-3 pb-3 pt-2">
                  <textarea
                    value={note.body}
                    onChange={(event) =>
                      updateLocalNote(note.id, { body: event.target.value })
                    }
                    onBlur={() => saveNoteBody(note.id)}
                    onFocus={() => setSelectedNoteId(note.id)}
                    maxLength={500}
                    placeholder="Write a note..."
                    className="h-full w-full resize-none border-0 bg-transparent text-sm leading-6 text-[#2f2a1f] outline-none placeholder:text-[#8a7958]"
                  />
                </div>

                <button
                  type="button"
                  onPointerDown={(event) =>
                    startInteraction(event, note, "resize", "n")
                  }
                  title="Resize note"
                  aria-label="Resize note"
                  className="absolute left-2 right-2 top-0 h-2 cursor-ns-resize"
                />
                <button
                  type="button"
                  onPointerDown={(event) =>
                    startInteraction(event, note, "resize", "e")
                  }
                  title="Resize note"
                  aria-label="Resize note"
                  className="absolute bottom-2 right-0 top-2 w-2 cursor-ew-resize"
                />
                <button
                  type="button"
                  onPointerDown={(event) =>
                    startInteraction(event, note, "resize", "s")
                  }
                  title="Resize note"
                  aria-label="Resize note"
                  className="absolute bottom-0 left-2 right-2 h-2 cursor-ns-resize"
                />
                <button
                  type="button"
                  onPointerDown={(event) =>
                    startInteraction(event, note, "resize", "w")
                  }
                  title="Resize note"
                  aria-label="Resize note"
                  className="absolute bottom-2 left-0 top-2 w-2 cursor-ew-resize"
                />
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
              <div className="flex h-8 shrink-0 items-center justify-between border-b border-black/10 px-3">
                <Grip
                  className="size-4 shrink-0 text-[#6e6046]"
                  strokeWidth={1.7}
                />
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

              <div className="flex min-h-0 flex-1 px-3 py-3">
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  maxLength={500}
                  rows={5}
                  placeholder="Write a note..."
                  className="h-full w-full resize-none border-0 bg-transparent text-sm leading-6 text-[#2f2a1f] outline-none placeholder:text-[#8a7958]"
                />
              </div>

              <div className="mt-auto flex h-10 shrink-0 items-center justify-end border-t border-black/10 px-3">
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
            </form>
          ) : null}
        </div>
      </div>
    </section>
  );
}
