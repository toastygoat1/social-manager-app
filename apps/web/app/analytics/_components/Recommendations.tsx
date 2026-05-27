"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  LoaderCircle,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { ApiError, apiFetchBrowser } from "@/lib/api/browser-client";
import type { AnalyticsNote, Recommendation } from "./data";

type RecommendationsProps = {
  recommendations: Recommendation[];
  notes: AnalyticsNote[];
  selectedAccountId: string | null;
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

export function Recommendations({
  recommendations,
  notes,
  selectedAccountId,
}: RecommendationsProps) {
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingBody, setEditingBody] = useState("");
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function createNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const body = draft.trim();
    if (!body) return;

    setPendingAction("create");
    setError(null);

    try {
      await apiFetchBrowser("/analytics/notes", {
        method: "POST",
        body: {
          body,
          accountId: selectedAccountId ?? undefined,
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
      <header>
        <h2 className="text-sm font-semibold text-ink">Recommendations</h2>
        <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.04em] text-muted">
          Insights and working notes
        </p>
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
      <div className="mt-2 flex w-full flex-col gap-3 border-t border-line pt-6">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm font-semibold text-ink">Notes</p>
          <span className="font-mono text-[10px] uppercase tracking-[0.04em] text-muted">
            {notes.length} saved
          </span>
        </div>
        <form
          onSubmit={createNote}
          className="flex w-full flex-col gap-3 rounded-lg bg-card p-4"
        >
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            maxLength={500}
            rows={3}
            placeholder="Write a note..."
            className="min-h-20 w-full resize-y rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink outline-none transition placeholder:text-muted focus:border-[#5e6ad2]"
          />
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] text-muted">{draft.length}/500</span>
            <button
              type="submit"
              disabled={!draft.trim() || pendingAction === "create"}
              className="flex h-9 items-center gap-2 rounded-lg bg-[#5e6ad2] px-3 text-xs font-medium text-white transition hover:bg-[#4e59bd] disabled:pointer-events-none disabled:opacity-60"
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
          <div className="flex min-h-28 w-full flex-col rounded-lg bg-card px-5 py-4">
            <p className="text-sm font-medium text-ink">No notes yet</p>
            <div className="mt-4 flex flex-1 flex-col gap-3">
              <span className="h-px w-full bg-line" />
              <span className="h-px w-full bg-line" />
              <span className="h-px w-full bg-line" />
            </div>
          </div>
        ) : (
          <div className="flex w-full flex-col gap-3">
            {notes.map((note) => {
              const isEditing = editingNoteId === note.id;
              const isUpdating = pendingAction === `update:${note.id}`;
              const isDeleting = pendingAction === `delete:${note.id}`;

              return (
                <div
                  key={note.id}
                  className="flex w-full flex-col gap-3 rounded-lg border border-line bg-paper px-4 py-3"
                >
                  {isEditing ? (
                    <textarea
                      value={editingBody}
                      onChange={(event) => setEditingBody(event.target.value)}
                      maxLength={500}
                      rows={3}
                      className="min-h-20 w-full resize-y rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink outline-none transition focus:border-[#5e6ad2]"
                    />
                  ) : (
                    <p className="whitespace-pre-wrap text-sm leading-6 text-ink">
                      {note.body}
                    </p>
                  )}
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[11px] text-muted">
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
                            className="flex size-8 items-center justify-center rounded-lg text-success transition hover:bg-emerald-50 disabled:pointer-events-none disabled:opacity-50"
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
                            className="flex size-8 items-center justify-center rounded-lg text-muted transition hover:bg-card hover:text-ink"
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
                            className="flex size-8 items-center justify-center rounded-lg text-muted transition hover:bg-card hover:text-ink"
                          >
                            <Pencil className="size-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteNote(note.id)}
                            disabled={isDeleting}
                            title="Delete note"
                            aria-label="Delete note"
                            className="flex size-8 items-center justify-center rounded-lg text-muted transition hover:bg-red-50 hover:text-danger disabled:pointer-events-none disabled:opacity-50"
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
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
