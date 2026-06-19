"use client";

import { useEffect, useState } from "react";
import { Link2Off, LoaderCircle, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { AvatarImage } from "@/app/_components/AvatarImage";
import { ApiError, apiFetchBrowser } from "@/lib/api/browser-client";
import { POST_FORMAT_COLORS } from "./post-formats";
import type { Account } from "./data";

type AccountPersonalizationModalProps = {
  account: Account | null;
  onClose: () => void;
};

const PRESET_COLORS = [
  POST_FORMAT_COLORS.Post,
  POST_FORMAT_COLORS.Carousel,
  POST_FORMAT_COLORS.Reel,
  POST_FORMAT_COLORS.Story,
  "#4318FF",
  "#1f2937",
];

function getInitials(label: string) {
  return (
    label
      .replace(/^@/, "")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("") || "A"
  );
}

function getApiMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    const body = error.body as { message?: string | string[] } | null;
    const message = body?.message;
    if (Array.isArray(message)) return message[0];
    if (typeof message === "string") return message;
    return `${fallback} (${error.status}).`;
  }
  return fallback;
}

export function AccountPersonalizationModal({
  account,
  onClose,
}: AccountPersonalizationModalProps) {
  if (!account) return null;

  return (
    <AccountPersonalizationDialog
      key={account.id}
      account={account}
      onClose={onClose}
    />
  );
}

function AccountPersonalizationDialog({
  account,
  onClose,
}: {
  account: Account;
  onClose: () => void;
}) {
  const router = useRouter();
  const [accentColor, setAccentColor] = useState(account.accentColor ?? "");
  const [nickname, setNickname] = useState(account.nickname ?? "");
  const [note, setNote] = useState(account.note ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    if (account) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [account, onClose]);

  async function handleSave() {
    setIsSaving(true);
    setError(null);
    try {
      await apiFetchBrowser(
        `/instagram/accounts/${encodeURIComponent(account.id)}/personalization`,
        {
          method: "PATCH",
          body: {
            accentColor: accentColor.trim() || null,
            nickname: nickname.trim() || null,
            note: note.trim() || null,
          },
        },
      );
      router.refresh();
      onClose();
    } catch (err) {
      setError(getApiMessage(err, "Could not save personalization"));
      setIsSaving(false);
    }
  }

  async function handleDisconnect() {
    const confirmed = window.confirm(
      `Disconnect ${account.name} from this workspace?`,
    );
    if (!confirmed) return;
    setIsDisconnecting(true);
    setError(null);
    try {
      await apiFetchBrowser(
        `/instagram/accounts/${encodeURIComponent(account.id)}`,
        { method: "DELETE" },
      );
      router.refresh();
      onClose();
    } catch (err) {
      setIsDisconnecting(false);
      setError(getApiMessage(err, "Disconnect failed"));
    }
  }

  const previewAccent = accentColor || "#5e6ad2";

  return (
    <div
      role="presentation"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-6"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Personalize ${account.name}`}
        onClick={(event) => event.stopPropagation()}
        className="relative flex w-full max-w-[460px] flex-col overflow-hidden rounded-[20px] border border-line bg-paper"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 z-10 grid size-8 place-items-center rounded-full bg-paper/80 text-muted backdrop-blur transition hover:bg-card hover:text-ink"
        >
          <X className="size-4" strokeWidth={1.8} />
        </button>

        <div className="flex flex-col items-center gap-1 px-5 pb-2 pt-8">
          <span
            className="flex size-20 items-center justify-center overflow-hidden rounded-full border-4 bg-card"
            style={{ borderColor: previewAccent }}
          >
            <AvatarImage
              src={account.avatarUrl}
              alt={account.name}
              width={80}
              height={80}
              className="size-20 rounded-full object-cover"
              fallback={getInitials(account.name)}
              fallbackSeed={account.id}
            />
          </span>
          <p className="text-base font-semibold text-ink">
            {nickname.trim() || account.name}
          </p>
          <p className="text-xs text-muted">{account.platform}</p>
        </div>

        <div className="flex flex-col gap-4 px-5 pb-5 pt-5">
          {error ? (
            <p className="rounded-[8px] bg-[color-mix(in_srgb,var(--danger)_10%,var(--bg-light))] px-3 py-2 text-xs text-[color:var(--danger)]">
              {error}
            </p>
          ) : null}

          <Field label="Accent color">
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={accentColor || "#5e6ad2"}
                onChange={(event) => setAccentColor(event.target.value)}
                className="h-9 w-9 cursor-pointer rounded-[8px] border border-line bg-paper"
                aria-label="Pick accent color"
              />
              <div className="flex flex-wrap gap-1.5">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setAccentColor(color)}
                    aria-label={`Use ${color}`}
                    className={`size-6 rounded-full border-2 transition ${
                      accentColor.toLowerCase() === color.toLowerCase()
                        ? "border-ink"
                        : "border-transparent"
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          </Field>

          <Field label="Display name (override)">
            <input
              type="text"
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
              placeholder={account.name}
              maxLength={60}
              className="w-full rounded-[10px] border border-line bg-paper px-3 py-2 text-xs text-ink placeholder:text-muted focus:border-[color:var(--cta)] focus:outline-none"
            />
          </Field>

          <Field label="Internal note">
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={2}
              maxLength={280}
              placeholder="Visible only to your team"
              className="w-full resize-none rounded-[10px] border border-line bg-paper px-3 py-2 text-xs text-ink placeholder:text-muted focus:border-[color:var(--cta)] focus:outline-none"
            />
          </Field>

          <div className="flex items-center justify-between gap-2 border-t border-line pt-4">
            <button
              type="button"
              onClick={handleDisconnect}
              disabled={isDisconnecting || isSaving}
              className="inline-flex items-center gap-1.5 rounded-[10px] border border-line px-3 py-2 text-xs font-medium text-[color:var(--danger)] transition hover:bg-[color-mix(in_srgb,var(--danger)_8%,var(--bg-light))] disabled:pointer-events-none disabled:opacity-60"
            >
              {isDisconnecting ? (
                <LoaderCircle className="size-3.5 animate-spin" strokeWidth={2} />
              ) : (
                <Link2Off className="size-3.5" strokeWidth={1.8} />
              )}
              Disconnect account
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || isDisconnecting}
              className="inline-flex items-center gap-1.5 rounded-[10px] bg-ink px-3 py-2 text-xs font-medium text-paper transition hover:opacity-90 disabled:pointer-events-none disabled:opacity-60"
            >
              {isSaving ? (
                <LoaderCircle className="size-3.5 animate-spin" strokeWidth={2} />
              ) : null}
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-medium uppercase tracking-wider text-muted">
        {label}
      </span>
      {children}
    </label>
  );
}
