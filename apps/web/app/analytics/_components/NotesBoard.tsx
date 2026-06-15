"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type PointerEvent,
  type WheelEvent,
} from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Minus, Plus, StickyNote, X } from "lucide-react";
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
  border: string;
  swatch: string;
  text: string;
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
  cream: {
    label: "Cream",
    paper: "#fff6c8",
    border: "#eadf98",
    swatch: "#fff6c8",
    text: "#84793f",
  },
  sprout: {
    label: "Green",
    paper: "#e0ffc8",
    border: "#bde59d",
    swatch: "#e0ffc8",
    text: "#5d843f",
  },
  mint: {
    label: "Mint",
    paper: "#c8fff2",
    border: "#9ee7d8",
    swatch: "#c8fff2",
    text: "#3e8473",
  },
  sky: {
    label: "Sky",
    paper: "#c8f2ff",
    border: "#9ed9ea",
    swatch: "#c8f2ff",
    text: "#3f7485",
  },
  periwinkle: {
    label: "Blue",
    paper: "#c8dbff",
    border: "#a6bde8",
    swatch: "#c8dbff",
    text: "#3f5785",
  },
  violet: {
    label: "Violet",
    paper: "#e0c8ff",
    border: "#c2a4e8",
    swatch: "#e0c8ff",
    text: "#6f3f85",
  },
  rose: {
    label: "Red",
    paper: "#ffc8c8",
    border: "#e7a2a2",
    swatch: "#ffc8c8",
    text: "#853d3d",
  },
  peach: {
    label: "Peach",
    paper: "#ffe6c8",
    border: "#e7c49c",
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
const DEFAULT_NOTE_WIDTH = 250;
const DEFAULT_NOTE_HEIGHT = 220;
const MIN_NOTE_WIDTH = 180;
const MIN_NOTE_HEIGHT = 160;
const MAX_NOTE_WIDTH = 520;
const MAX_NOTE_HEIGHT = 520;
const DEFAULT_BOARD_WIDTH = 1040;
const BOARD_CANVAS_HEIGHT = 1200;
const BOARD_VIEWPORT_HEIGHT = 620;
const BOARD_PADDING = 32;
const MIN_BOARD_ZOOM = 0.5;
const MAX_BOARD_ZOOM = 1.4;
const BOARD_ZOOM_STEP = 0.1;
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
  const accountIds = Array.isArray(note.accountIds) ? note.accountIds : [];

  if (accountIds.length > 0) return accountIds;
  return note.accountId ? [note.accountId] : [];
}

function getMaxBoardX(width: number, boardWidth: number) {
  return Math.max(0, boardWidth - width - BOARD_PADDING);
}

function clampBoardX(value: number, width: number, boardWidth: number) {
  return clampInt(value, 0, getMaxBoardX(width, boardWidth));
}

function getMaxBoardY(height: number) {
  return Math.max(0, BOARD_CANVAS_HEIGHT - height - BOARD_PADDING);
}

function clampBoardY(value: number, height: number) {
  return clampInt(value, 0, getMaxBoardY(height));
}

function normalizeNoteForBoard(
  note: AnalyticsNote,
  index: number,
  boardWidth: number,
): BoardNote {
  const noteWidth = clampInt(
    getNumber(note.boardWidth, DEFAULT_NOTE_WIDTH),
    MIN_NOTE_WIDTH,
    MAX_NOTE_WIDTH,
  );
  const boardHeight = clampInt(
    getNumber(note.boardHeight, DEFAULT_NOTE_HEIGHT),
    MIN_NOTE_HEIGHT,
    MAX_NOTE_HEIGHT,
  );

  return {
    ...note,
    accountIds: getNoteAccountIds(note),
    boardX: clampBoardX(
      getNumber(note.boardX, BOARD_PADDING),
      noteWidth,
      boardWidth,
    ),
    boardY: clampBoardY(getNumber(note.boardY, BOARD_PADDING), boardHeight),
    boardWidth: noteWidth,
    boardHeight,
    color: getNoteColor(note.color),
    zIndex: clampInt(getNumber(note.zIndex, index + 1), 1, 10000),
  };
}

function getNextNoteLayout(notes: AnalyticsNote[], boardWidth: number) {
  const index = notes.length;
  const columns = Math.max(
    1,
    Math.floor(
      (boardWidth - BOARD_PADDING * 2 + NOTE_GAP) /
        (DEFAULT_NOTE_WIDTH + NOTE_GAP),
    ),
  );

  return {
    boardX: BOARD_PADDING + (index % columns) * (DEFAULT_NOTE_WIDTH + NOTE_GAP),
    boardY: clampBoardY(
      BOARD_PADDING +
        Math.floor(index / columns) * (DEFAULT_NOTE_HEIGHT + NOTE_GAP),
      DEFAULT_NOTE_HEIGHT,
    ),
    boardWidth: DEFAULT_NOTE_WIDTH,
    boardHeight: DEFAULT_NOTE_HEIGHT,
  };
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
  const boardViewportRef = useRef<HTMLDivElement | null>(null);
  const [boardWidth, setBoardWidth] = useState(DEFAULT_BOARD_WIDTH);
  const normalizedNotes = useMemo(
    () =>
      notes.map((note, index) =>
        normalizeNoteForBoard(note, index, boardWidth),
      ),
    [boardWidth, notes],
  );
  const accountById = useMemo(
    () => new Map(accounts.map((account) => [account.id, account])),
    [accounts],
  );
  const selectedAccount = selectedAccountId
    ? (accountById.get(selectedAccountId) ?? null)
    : null;
  const [boardNotes, setBoardNotes] = useState(normalizedNotes);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [composerLayout, setComposerLayout] = useState<NoteLayoutPatch>({
    ...getNextNoteLayout(normalizedNotes, boardWidth),
    zIndex: 1,
  });
  const [draft, setDraft] = useState("");
  const [draftAccountId, setDraftAccountId] = useState(() =>
    getDefaultDraftAccountId(accounts, selectedAccountId),
  );
  const [draftColor, setDraftColor] = useState<NoteColor>(() =>
    getDefaultNoteColor(selectedAccount, 0),
  );
  const [zoom, setZoom] = useState(1);
  const [isInteracting, setIsInteracting] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const interactionRef = useRef<BoardInteraction | null>(null);
  const cleanupInteractionRef = useRef<(() => void) | null>(null);
  const broadcastRef = useRef<BroadcastChannel | null>(null);
  const draftAccount = draftAccountId
    ? (accountById.get(draftAccountId) ?? null)
    : null;
  const composerAccount = selectedAccount ?? draftAccount;
  const canCreate = Boolean(draft.trim());
  const zoomPercent = Math.round(zoom * 100);
  const topZIndex = useMemo(
    () => Math.max(1, ...boardNotes.map((note) => note.zIndex)),
    [boardNotes],
  );
  const selectedNote = selectedNoteId
    ? (boardNotes.find((note) => note.id === selectedNoteId) ?? null)
    : null;
  const draftNoteStyle = NOTE_COLORS[draftColor];
  const toolbarPosition = selectedNote
    ? {
        left: clampInt(
          selectedNote.boardX + selectedNote.boardWidth / 2 - TOOLBAR_WIDTH / 2,
          BOARD_PADDING / 2,
          Math.max(
            BOARD_PADDING / 2,
            boardWidth - TOOLBAR_WIDTH - BOARD_PADDING / 2,
          ),
        ),
        top: Math.max(BOARD_PADDING / 2, selectedNote.boardY - 56),
      }
    : null;

  useEffect(() => {
    const element = boardViewportRef.current;
    if (!element) return;

    const updateBoardWidth = () => {
      setBoardWidth(Math.max(320, Math.round(element.clientWidth)));
    };

    updateBoardWidth();

    if (!("ResizeObserver" in window)) return;

    const observer = new ResizeObserver(updateBoardWidth);
    observer.observe(element);

    return () => observer.disconnect();
  }, []);

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

  function changeZoom(delta: number) {
    setZoom((currentZoom) =>
      Number(
        clamp(currentZoom + delta, MIN_BOARD_ZOOM, MAX_BOARD_ZOOM).toFixed(2),
      ),
    );
  }

  function handleBoardWheel(event: WheelEvent<HTMLDivElement>) {
    if (event.deltaY === 0) return;

    event.preventDefault();
    changeZoom(event.deltaY > 0 ? -BOARD_ZOOM_STEP : BOARD_ZOOM_STEP);
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
          note.id === noteId
            ? normalizeNoteForBoard(updatedNote, index, boardWidth)
            : note,
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
    const layout = getNextNoteLayout(boardNotes, boardWidth);
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
      const createdNote = await apiFetchBrowser<AnalyticsNote>(
        "/analytics/notes",
        {
          method: "POST",
          body: {
            body,
            accountId: composerAccount?.id ?? null,
            accountIds: composerAccount ? [composerAccount.id] : [],
            boardX: composerLayout.boardX,
            boardY: composerLayout.boardY,
            boardWidth: composerLayout.boardWidth,
            boardHeight: composerLayout.boardHeight,
            color: draftColor,
            zIndex: topZIndex + 1,
          },
        },
      );
      const normalizedNote = normalizeNoteForBoard(createdNote, 0, boardWidth);

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
    if (
      event.button !== 0 ||
      (type === "move" && isControlTarget(event.target))
    ) {
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
    setIsInteracting(true);
    setSelectedNoteId(note.id);
    updateLocalNote(note.id, { zIndex: nextZIndex });

    const handlePointerMove = (pointerEvent: globalThis.PointerEvent) => {
      const interaction = interactionRef.current;
      if (!interaction) return;

      const deltaX = (pointerEvent.clientX - interaction.startPointerX) / zoom;
      const deltaY = (pointerEvent.clientY - interaction.startPointerY) / zoom;
      let nextX = interaction.startBoardX;
      let nextY = interaction.startBoardY;
      let nextWidth = interaction.startWidth;
      let nextHeight = interaction.startHeight;

      if (interaction.type === "move") {
        nextX = clampBoardX(
          interaction.startBoardX + deltaX,
          nextWidth,
          boardWidth,
        );
        nextY = clampBoardY(interaction.startBoardY + deltaY, nextHeight);
      } else {
        const edgeName = interaction.edge;

        if (edgeName === "e") {
          nextWidth = clampInt(
            interaction.startWidth + deltaX,
            MIN_NOTE_WIDTH,
            Math.min(
              MAX_NOTE_WIDTH,
              boardWidth - interaction.startBoardX - BOARD_PADDING,
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
          nextX = clampInt(
            fixedRight - nextWidth,
            0,
            fixedRight - MIN_NOTE_WIDTH,
          );
        }

        if (edgeName === "s") {
          nextHeight = clampInt(
            interaction.startHeight + deltaY,
            MIN_NOTE_HEIGHT,
            Math.min(
              MAX_NOTE_HEIGHT,
              BOARD_CANVAS_HEIGHT - interaction.startBoardY - BOARD_PADDING,
            ),
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
      setIsInteracting(false);
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
              {selectedAccount
                ? getAccountTitle(selectedAccount)
                : "All accounts"}
            </p>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 sm:justify-end">
          <div className="flex h-9 items-center overflow-hidden rounded-md border border-line bg-card text-ink">
            <button
              type="button"
              onClick={() => changeZoom(-BOARD_ZOOM_STEP)}
              disabled={zoom <= MIN_BOARD_ZOOM}
              title="Zoom out"
              aria-label="Zoom out"
              className="flex size-9 items-center justify-center transition hover:bg-white disabled:pointer-events-none disabled:opacity-40"
            >
              <Minus className="size-4" strokeWidth={1.8} />
            </button>
            <span className="min-w-12 text-center font-mono text-[10px] uppercase tracking-[0.04em] text-muted">
              {zoomPercent}%
            </span>
            <button
              type="button"
              onClick={() => changeZoom(BOARD_ZOOM_STEP)}
              disabled={zoom >= MAX_BOARD_ZOOM}
              title="Zoom in"
              aria-label="Zoom in"
              className="flex size-9 items-center justify-center transition hover:bg-white disabled:pointer-events-none disabled:opacity-40"
            >
              <Plus className="size-4" strokeWidth={1.8} />
            </button>
          </div>
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

      <div
        ref={boardViewportRef}
        onWheel={handleBoardWheel}
        onPointerDown={(event) => {
          if (event.currentTarget === event.target) setSelectedNoteId(null);
        }}
        className="w-full overflow-hidden border border-[#d7d2c6] bg-white"
        style={{ height: BOARD_VIEWPORT_HEIGHT }}
      >
        <div
          className="relative"
          style={
            {
              width: boardWidth * zoom,
              height: BOARD_CANVAS_HEIGHT * zoom,
            } satisfies CSSProperties
          }
        >
          {selectedNote && toolbarPosition && !isInteracting ? (
            <div
              className="absolute z-[10050] flex h-10 items-center gap-1 rounded-md border border-[#d9d5ca] bg-white px-2 shadow-[0_10px_24px_rgba(47,42,31,0.16)]"
              style={{
                left: toolbarPosition.left * zoom,
                top: toolbarPosition.top * zoom,
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
                  {accounts.length === 0 ? (
                    <p className="px-2 py-1.5 text-xs text-[#8a7958]">
                      No accounts
                    </p>
                  ) : (
                    accounts.map((account) => {
                      const isChecked = selectedNote.accountIds.includes(
                        account.id,
                      );

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
                    })
                  )}
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

          <div
            onPointerDown={(event) => {
              if (event.currentTarget === event.target) setSelectedNoteId(null);
            }}
            className="relative origin-top-left bg-white"
            style={
              {
                width: boardWidth,
                height: BOARD_CANVAS_HEIGHT,
                transform: `scale(${zoom})`,
                transformOrigin: "top left",
              } satisfies CSSProperties
            }
          >
            {boardNotes.map((note) => {
              const isSelected = selectedNoteId === note.id;
              const style = NOTE_COLORS[note.color];
              const noteAccounts = note.accountIds
                .map((accountId) => accountById.get(accountId))
                .filter((account): account is Account => Boolean(account));
              const primaryNoteAccount = noteAccounts[0] ?? null;
              const extraAccountCount = Math.max(0, noteAccounts.length - 1);

              return (
                <article
                  key={note.id}
                  onPointerDown={(event) =>
                    startInteraction(event, note, "move")
                  }
                  className={`absolute flex cursor-default flex-col overflow-hidden rounded-md border shadow-[0_12px_24px_rgba(47,42,31,0.13)] outline-2 outline-offset-2 transition-[outline-color,box-shadow] hover:outline ${
                    isSelected ? "outline" : ""
                  }`}
                  style={{
                    left: note.boardX,
                    top: note.boardY,
                    width: note.boardWidth,
                    height: note.boardHeight,
                    zIndex: note.zIndex,
                    touchAction: "none",
                    backgroundColor: style.paper,
                    borderColor: style.border,
                    color: style.text,
                    outlineColor: style.text,
                  }}
                >
                  <div className="flex min-h-0 flex-1 flex-col p-3">
                    <div className="min-h-0 flex-1">
                      {isSelected && !isInteracting ? (
                        <textarea
                          value={note.body}
                          onChange={(event) =>
                            updateLocalNote(note.id, {
                              body: event.target.value,
                            })
                          }
                          onBlur={() => saveNoteBody(note.id)}
                          onFocus={() => setSelectedNoteId(note.id)}
                          maxLength={500}
                          placeholder="Write a note..."
                          className="h-full w-full cursor-text resize-none border-0 bg-transparent text-sm leading-6 text-current outline-none placeholder:text-current placeholder:opacity-60"
                        />
                      ) : (
                        <p className="h-full cursor-default whitespace-pre-wrap break-words text-sm leading-6">
                          {note.body}
                        </p>
                      )}
                    </div>

                    {primaryNoteAccount ? (
                      <div className="mt-3 flex h-7 shrink-0 items-center gap-2 text-xs font-medium">
                        {primaryNoteAccount.avatarUrl ? (
                          <span
                            aria-hidden="true"
                            className="size-6 shrink-0 rounded-md bg-cover bg-center"
                            style={{
                              backgroundImage: `url(${primaryNoteAccount.avatarUrl})`,
                            }}
                          />
                        ) : (
                          <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-white/55 text-[11px] font-semibold">
                            {getAccountInitial(primaryNoteAccount)}
                          </span>
                        )}
                        <span className="min-w-0 truncate">
                          {getAccountTitle(primaryNoteAccount)}
                        </span>
                        {extraAccountCount > 0 ? (
                          <span className="ml-auto shrink-0 rounded bg-white/45 px-1.5 py-0.5 text-[10px]">
                            +{extraAccountCount}
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  {isSelected ? (
                    <>
                      <button
                        type="button"
                        onPointerDown={(event) =>
                          startInteraction(event, note, "resize", "n")
                        }
                        title="Resize note"
                        aria-label="Resize note"
                        className="absolute left-2 right-2 top-0 h-2 cursor-ns-resize bg-transparent"
                      />
                      <button
                        type="button"
                        onPointerDown={(event) =>
                          startInteraction(event, note, "resize", "e")
                        }
                        title="Resize note"
                        aria-label="Resize note"
                        className="absolute bottom-2 right-0 top-2 w-2 cursor-ew-resize bg-transparent"
                      />
                      <button
                        type="button"
                        onPointerDown={(event) =>
                          startInteraction(event, note, "resize", "s")
                        }
                        title="Resize note"
                        aria-label="Resize note"
                        className="absolute bottom-0 left-2 right-2 h-2 cursor-ns-resize bg-transparent"
                      />
                      <button
                        type="button"
                        onPointerDown={(event) =>
                          startInteraction(event, note, "resize", "w")
                        }
                        title="Resize note"
                        aria-label="Resize note"
                        className="absolute bottom-2 left-0 top-2 w-2 cursor-ew-resize bg-transparent"
                      />
                    </>
                  ) : null}
                </article>
              );
            })}

            {isComposerOpen ? (
              <form
                onSubmit={createNote}
                className="absolute overflow-hidden rounded-md border shadow-[0_12px_24px_rgba(47,42,31,0.13)]"
                style={{
                  left: composerLayout.boardX,
                  top: composerLayout.boardY,
                  width: composerLayout.boardWidth,
                  height: composerLayout.boardHeight,
                  zIndex: composerLayout.zIndex,
                  backgroundColor: draftNoteStyle.paper,
                  borderColor: draftNoteStyle.border,
                  color: draftNoteStyle.text,
                }}
              >
                <button
                  type="button"
                  onClick={() => setIsComposerOpen(false)}
                  title="Cancel"
                  aria-label="Cancel"
                  className="absolute right-2 top-2 z-10 flex size-8 items-center justify-center rounded-md text-current transition hover:bg-white/45"
                >
                  <X className="size-4" />
                </button>
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  maxLength={500}
                  rows={5}
                  autoFocus
                  placeholder="Write a note..."
                  className="h-full w-full resize-none border-0 bg-transparent px-3 py-3 pb-14 pr-12 text-sm leading-6 text-current outline-none placeholder:text-current placeholder:opacity-60"
                />
                <button
                  type="submit"
                  disabled={!canCreate || pendingAction === "create"}
                  title="Add note"
                  aria-label="Add note"
                  className="absolute bottom-3 right-3 flex size-8 items-center justify-center rounded-md bg-[#2f2a1f] text-white transition hover:bg-[#4a402e] disabled:pointer-events-none disabled:opacity-60"
                >
                  {pendingAction === "create" ? (
                    <LoaderCircle className="size-4 animate-spin" />
                  ) : (
                    <Plus className="size-4" />
                  )}
                </button>
              </form>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
