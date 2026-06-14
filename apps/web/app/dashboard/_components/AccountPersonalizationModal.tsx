"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, Link2Off, LoaderCircle, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { AvatarImage } from "@/app/_components/AvatarImage";
import { ApiError, apiFetchBrowser } from "@/lib/api/browser-client";
import { createClient } from "@/lib/supabase/client";
import { POST_FORMAT_COLORS } from "./post-formats";
import type { Account } from "./data";

type AccountPersonalizationModalProps = {
  account: Account | null;
  onClose: () => void;
};

type BannerUploadUrlResponse = {
  bucket: string;
  storagePath: string;
  token: string;
  signedUrl: string;
};

const PRESET_COLORS = [
  POST_FORMAT_COLORS.Post,
  POST_FORMAT_COLORS.Carousel,
  POST_FORMAT_COLORS.Reel,
  POST_FORMAT_COLORS.Story,
  "#4318FF",
  "#1f2937",
];

const MAX_BANNER_BYTES = 8 * 1024 * 1024;

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
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [accentColor, setAccentColor] = useState("");
  const [nickname, setNickname] = useState("");
  const [note, setNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!account) return;
    setBannerPreview(account.bannerUrl ?? null);
    setAccentColor(account.accentColor ?? "");
    setNickname(account.nickname ?? "");
    setNote(account.note ?? "");
    setError(null);
  }, [account]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    if (account) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [account, onClose]);

  if (!account) return null;

  async function handleUpload(file: File) {
    if (!account) return;
    if (!file.type.startsWith("image/")) {
      setError("Banner must be an image");
      return;
    }
    if (file.size > MAX_BANNER_BYTES) {
      setError("Banner must be smaller than 8MB");
      return;
    }
    setError(null);
    setIsUploading(true);
    const localPreview = URL.createObjectURL(file);
    setBannerPreview(localPreview);
    try {
      const intent = await apiFetchBrowser<BannerUploadUrlResponse>(
        `/instagram/accounts/${encodeURIComponent(account.id)}/banner/upload-url`,
        {
          method: "POST",
          body: {
            name: file.name,
            mimeType: file.type,
            fileSize: file.size,
          },
        },
      );
      const supabase = createClient();
      const { error: uploadError } = await supabase.storage
        .from(intent.bucket)
        .uploadToSignedUrl(intent.storagePath, intent.token, file, {
          contentType: file.type,
        });
      if (uploadError) throw uploadError;
      const updated = await apiFetchBrowser<Account>(
        `/instagram/accounts/${encodeURIComponent(account.id)}/banner`,
        {
          method: "POST",
          body: { storagePath: intent.storagePath },
        },
      );
      setBannerPreview(updated.bannerUrl ?? null);
      router.refresh();
    } catch (err) {
      setError(getApiMessage(err, "Could not upload banner"));
      setBannerPreview(account?.bannerUrl ?? null);
    } finally {
      setIsUploading(false);
      URL.revokeObjectURL(localPreview);
    }
  }

  async function handleClearBanner() {
    if (!account) return;
    setIsUploading(true);
    setError(null);
    try {
      await apiFetchBrowser(
        `/instagram/accounts/${encodeURIComponent(account.id)}/banner`,
        { method: "DELETE" },
      );
      setBannerPreview(null);
      router.refresh();
    } catch (err) {
      setError(getApiMessage(err, "Could not remove banner"));
    } finally {
      setIsUploading(false);
    }
  }

  async function handleSave() {
    if (!account) return;
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
    if (!account) return;
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
  const showingPreview = bannerPreview;

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

        <div
          className="relative h-28 w-full"
          style={
            showingPreview
              ? {
                  backgroundImage: `url("${showingPreview}")`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }
              : {
                  background: `linear-gradient(135deg, ${previewAccent} 0%, ${previewAccent}80 100%)`,
                }
          }
        >
          <div className="absolute right-3 bottom-3 flex gap-1.5">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) handleUpload(file);
                if (event.target) event.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="inline-flex items-center gap-1.5 rounded-full bg-paper/90 px-2.5 py-1 text-[11px] font-medium text-ink shadow-sm backdrop-blur transition hover:bg-paper disabled:pointer-events-none disabled:opacity-60"
            >
              {isUploading ? (
                <LoaderCircle className="size-3.5 animate-spin" strokeWidth={2} />
              ) : (
                <ImagePlus className="size-3.5" strokeWidth={1.8} />
              )}
              {showingPreview ? "Replace banner" : "Upload banner"}
            </button>
            {showingPreview ? (
              <button
                type="button"
                onClick={handleClearBanner}
                disabled={isUploading}
                aria-label="Remove banner"
                className="grid size-7 place-items-center rounded-full bg-paper/90 text-muted shadow-sm backdrop-blur transition hover:bg-paper hover:text-ink disabled:pointer-events-none disabled:opacity-60"
              >
                <Trash2 className="size-3.5" strokeWidth={1.8} />
              </button>
            ) : null}
          </div>
        </div>

        <div className="-mt-8 flex flex-col items-center gap-1 px-5">
          <span
            className="flex size-16 items-center justify-center overflow-hidden rounded-full border-4 bg-card"
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
