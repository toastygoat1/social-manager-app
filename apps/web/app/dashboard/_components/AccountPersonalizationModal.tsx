"use client";

import { useEffect, useState } from "react";
import { Link2Off, LoaderCircle, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { AvatarImage } from "@/app/_components/AvatarImage";
import { ApiError, apiFetchBrowser } from "@/lib/api/browser-client";
import {
  clearPersonalization,
  saveAccountPersonalization,
  useAccountPersonalization,
} from "./account-personalization";
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
  "#0ea5e9",
  "#a855f7",
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

function getDisconnectMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 401)
      return "Please sign in again before disconnecting this account.";
    if (error.status === 404)
      return "This account is already disconnected or unavailable.";
    return `Disconnect failed (${error.status}).`;
  }
  return "Disconnect failed. Please try again.";
}

export function AccountPersonalizationModal({
  account,
  onClose,
}: AccountPersonalizationModalProps) {
  const router = useRouter();
  const personalization = useAccountPersonalization(account?.id ?? "");
  const [bannerUrl, setBannerUrl] = useState("");
  const [accentColor, setAccentColor] = useState("");
  const [nickname, setNickname] = useState("");
  const [note, setNote] = useState("");
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  useEffect(() => {
    setBannerUrl(personalization.bannerUrl ?? "");
    setAccentColor(personalization.accentColor ?? "");
    setNickname(personalization.nickname ?? "");
    setNote(personalization.note ?? "");
  }, [personalization, account?.id]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    if (account) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [account, onClose]);

  if (!account) return null;

  function handleSave() {
    if (!account) return;
    saveAccountPersonalization(account.id, {
      bannerUrl: bannerUrl.trim() || null,
      accentColor: accentColor.trim() || null,
      nickname: nickname.trim() || null,
      note: note.trim() || null,
    });
    onClose();
  }

  function handleClear() {
    if (!account) return;
    clearPersonalization(account.id);
    setBannerUrl("");
    setAccentColor("");
    setNickname("");
    setNote("");
  }

  async function handleDisconnect() {
    if (!account) return;
    const confirmed = window.confirm(
      `Disconnect ${account.name} from this workspace?`,
    );
    if (!confirmed) return;
    setIsDisconnecting(true);
    try {
      await apiFetchBrowser(
        `/instagram/accounts/${encodeURIComponent(account.id)}`,
        { method: "DELETE" },
      );
      router.refresh();
      onClose();
    } catch (error) {
      setIsDisconnecting(false);
      window.alert(getDisconnectMessage(error));
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
        className="relative flex w-full max-w-[460px] flex-col overflow-hidden rounded-[16px] border border-line bg-paper"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 z-10 grid size-8 place-items-center rounded-full bg-paper/80 text-muted backdrop-blur transition hover:bg-card hover:text-ink"
        >
          <X className="size-4" strokeWidth={1.8} />
        </button>

        <div
          className="relative h-28 w-full"
          style={
            bannerUrl
              ? {
                  backgroundImage: `url("${bannerUrl}")`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }
              : {
                  background: `linear-gradient(135deg, ${previewAccent} 0%, ${previewAccent}80 100%)`,
                }
          }
        />

        <div className="-mt-8 flex flex-col items-center gap-1 px-5">
          <span
            className="flex size-16 items-center justify-center overflow-hidden rounded-full border-4 border-paper bg-card"
            style={{ borderColor: "var(--bg-light)" }}
          >
            <AvatarImage
              src={account.avatarUrl}
              alt={account.name}
              width={64}
              height={64}
              className="size-16 rounded-full object-cover"
              fallback={getInitials(account.name)}
            />
          </span>
          <p className="text-base font-semibold text-ink">
            {nickname.trim() || account.name}
          </p>
          <p className="text-xs text-muted">{account.platform}</p>
        </div>

        <div className="flex flex-col gap-4 px-5 pb-5 pt-5">
          <Field label="Banner image URL">
            <input
              type="url"
              value={bannerUrl}
              onChange={(event) => setBannerUrl(event.target.value)}
              placeholder="https://…"
              className="w-full rounded-[10px] border border-line bg-paper px-3 py-2 text-xs text-ink placeholder:text-muted focus:border-[color:var(--cta)] focus:outline-none"
            />
          </Field>

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
              className="w-full rounded-[10px] border border-line bg-paper px-3 py-2 text-xs text-ink placeholder:text-muted focus:border-[color:var(--cta)] focus:outline-none"
            />
          </Field>

          <Field label="Internal note">
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={2}
              placeholder="Visible only to your team"
              className="w-full resize-none rounded-[10px] border border-line bg-paper px-3 py-2 text-xs text-ink placeholder:text-muted focus:border-[color:var(--cta)] focus:outline-none"
            />
          </Field>

          <div className="flex items-center justify-between gap-2 border-t border-line pt-4">
            <button
              type="button"
              onClick={handleDisconnect}
              disabled={isDisconnecting}
              className="inline-flex items-center gap-1.5 rounded-[10px] border border-line px-3 py-2 text-xs font-medium text-[color:var(--danger)] transition hover:bg-[color-mix(in_srgb,var(--danger)_8%,var(--bg-light))] disabled:pointer-events-none disabled:opacity-60"
            >
              {isDisconnecting ? (
                <LoaderCircle className="size-3.5 animate-spin" strokeWidth={2} />
              ) : (
                <Link2Off className="size-3.5" strokeWidth={1.8} />
              )}
              Disconnect account
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleClear}
                className="rounded-[10px] border border-line px-3 py-2 text-xs font-medium text-muted transition hover:bg-card hover:text-ink"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="rounded-[10px] bg-ink px-3 py-2 text-xs font-medium text-paper transition hover:opacity-90"
              >
                Save
              </button>
            </div>
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
