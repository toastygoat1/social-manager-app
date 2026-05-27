"use client";

import {
  AtSign,
  Bookmark,
  Calendar,
  Check,
  CircleAlert,
  Heart,
  Hash,
  ImageIcon,
  MessageCircle,
  MoreHorizontal,
  Play,
  Plus,
  Send,
  Trash2,
  User,
  X,
} from "lucide-react";
import NextImage from "next/image";
import { useEffect, useRef, useState } from "react";
import { ApiError, apiFetchBrowser } from "@/lib/api/browser-client";
import { createClient } from "@/lib/supabase/client";
import type { CalendarPostType } from "./data";

export type CreatePostType = "post" | "story" | "reels";
type ComposePostType = CreatePostType | "carousel";
type SubmitAction = "schedule" | "post-now" | "draft";

type Props = {
  open: boolean;
  type: CreatePostType;
  defaultScheduledIso: string;
  onClose: () => void;
  onCreated: () => void;
};

type InstagramAccountResponse = {
  id: string;
  username: string;
  accountType: "PERSONAL" | "BUSINESS" | "CREATOR";
  avatarUrl?: string | null;
  isActive: boolean;
};

type SelectedMedia = {
  id: string;
  file: File;
  previewUrl: string;
  kind: "image" | "video";
  width?: number;
  height?: number;
  durationSeconds?: number;
};

type MediaUploadUrlResponse = {
  bucket: string;
  uploads: {
    bucket: string;
    storagePath: string;
    token: string;
    signedUrl: string;
  }[];
};

type MediaAssetsResponse = {
  assets: {
    id: string;
    storagePath: string;
    fileType: "IMAGE" | "VIDEO";
    mimeType: string;
    fileSize: number;
  }[];
};

type AccountSubmitResult = {
  accountId: string;
  username: string;
  ok: boolean;
  message?: string;
};

const TYPE_LABEL: Record<ComposePostType, string> = {
  post: "Post",
  story: "Story",
  reels: "Reel",
  carousel: "Carousel",
};

const TYPE_TO_POST_TYPE: Record<ComposePostType, CalendarPostType> = {
  post: "FEED",
  story: "STORY",
  reels: "REEL",
  carousel: "CAROUSEL",
};

const MAX_MEDIA_SIZE = 100 * 1024 * 1024;
const FEED_IMAGE_MIN_ASPECT = 4 / 5;
const FEED_IMAGE_MAX_ASPECT = 1.91;

const ACTION_TO_API: Record<SubmitAction, "SCHEDULE" | "POST_NOW" | "DRAFT"> = {
  schedule: "SCHEDULE",
  "post-now": "POST_NOW",
  draft: "DRAFT",
};

const SUBMITTING_LABEL: Record<SubmitAction, string> = {
  schedule: "Scheduling...",
  "post-now": "Posting...",
  draft: "Saving...",
};

const SUBMIT_ERROR: Record<SubmitAction, string> = {
  schedule: "Failed to schedule post",
  "post-now": "Failed to post now",
  draft: "Failed to save draft",
};

function toLocalDatetimeInputValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function defaultScheduledInputValue(iso: string): string {
  const requested = new Date(iso);
  const minimum = new Date(Date.now() + 15 * 60 * 1000);
  const fallback = Number.isNaN(requested.getTime()) ? minimum : requested;
  return toLocalDatetimeInputValue(
    fallback > minimum ? fallback.toISOString() : minimum.toISOString(),
  );
}

function mediaLimitForType(type: ComposePostType) {
  return type === "post" || type === "carousel" ? 10 : 1;
}

function acceptForType(type: ComposePostType) {
  if (type === "post" || type === "carousel") return "image/*";
  return type === "reels" ? "video/*" : "image/*,video/*";
}

function validateMediaFiles(type: ComposePostType, files: File[]) {
  const limit = mediaLimitForType(type);
  if (files.length > limit) {
    return type === "post" || type === "carousel"
      ? "Posts and carousels can include up to 10 files"
      : "Stories and reels can include 1 file";
  }
  if (files.some((file) => file.size > MAX_MEDIA_SIZE)) {
    return "Each media file must be 100 MB or smaller";
  }
  if (files.some((file) => !file.type.startsWith("image/") && !file.type.startsWith("video/"))) {
    return "Only image and video files are supported";
  }
  if (
    (type === "post" || type === "carousel") &&
    files.some((file) => file.type.startsWith("video/"))
  ) {
    return "Posts and carousels support images only. Use reels for videos";
  }
  if (type === "reels" && files.some((file) => !file.type.startsWith("video/"))) {
    return "Reels require a video file";
  }
  return null;
}

function buildSelectedMedia(file: File): SelectedMedia {
  return {
    id: `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`,
    file,
    previewUrl: URL.createObjectURL(file),
    kind: file.type.startsWith("video/") ? "video" : "image",
  };
}

async function loadMediaMetadata(item: SelectedMedia): Promise<SelectedMedia> {
  if (item.kind === "image") {
    const image = await loadImage(item.previewUrl);
    const { naturalWidth: width, naturalHeight: height } = image;
    return { ...item, width, height };
  }

  const { width, height, durationSeconds } = await loadVideoMetadata(
    item.previewUrl,
  );
  return { ...item, width, height, durationSeconds };
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not read image dimensions"));
    image.src = src;
  });
}

function loadVideoMetadata(src: string) {
  return new Promise<{
    width: number;
    height: number;
    durationSeconds?: number;
  }>((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () =>
      resolve({
        width: video.videoWidth,
        height: video.videoHeight,
        durationSeconds: Number.isFinite(video.duration)
          ? Math.max(1, Math.round(video.duration))
          : undefined,
      });
    video.onerror = () => reject(new Error("Could not read video dimensions"));
    video.src = src;
  });
}

function hasMediaMetadata(item: SelectedMedia) {
  return Boolean(item.width && item.height);
}

function ensureMediaMetadata(items: SelectedMedia[]) {
  return Promise.all(
    items.map((item) =>
      hasMediaMetadata(item) ? Promise.resolve(item) : loadMediaMetadata(item),
    ),
  );
}

async function prepareMediaForType(type: ComposePostType, items: SelectedMedia[]) {
  const withMetadata = await ensureMediaMetadata(items);
  if (type !== "post" && type !== "carousel") return withMetadata;

  return Promise.all(withMetadata.map(cropFeedImageIfNeeded));
}

async function cropFeedImageIfNeeded(
  item: SelectedMedia,
): Promise<SelectedMedia> {
  if (item.kind !== "image" || !item.width || !item.height) return item;

  const aspect = item.width / item.height;
  if (aspect >= FEED_IMAGE_MIN_ASPECT && aspect <= FEED_IMAGE_MAX_ASPECT) {
    return item;
  }

  const image = await loadImage(item.previewUrl);
  const targetAspect =
    aspect < FEED_IMAGE_MIN_ASPECT
      ? FEED_IMAGE_MIN_ASPECT
      : FEED_IMAGE_MAX_ASPECT;
  const sourceWidth =
    aspect > targetAspect ? item.height * targetAspect : item.width;
  const sourceHeight =
    aspect > targetAspect ? item.height : item.width / targetAspect;
  const sourceX = (item.width - sourceWidth) / 2;
  const sourceY = (item.height - sourceHeight) / 2;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(sourceWidth);
  canvas.height = Math.round(sourceHeight);
  const ctx = canvas.getContext("2d");

  if (!ctx) throw new Error("Could not crop image");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    canvas.width,
    canvas.height,
  );

  const blob = await canvasToBlob(canvas, "image/jpeg", 0.92);
  const croppedFile = new File([blob], toCroppedFileName(item.file.name), {
    type: "image/jpeg",
    lastModified: Date.now(),
  });

  if (croppedFile.size > MAX_MEDIA_SIZE) {
    throw new Error("Cropped image is too large");
  }

  URL.revokeObjectURL(item.previewUrl);
  return {
    ...item,
    file: croppedFile,
    previewUrl: URL.createObjectURL(croppedFile),
    width: canvas.width,
    height: canvas.height,
  };
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not crop image"))),
      type,
      quality,
    );
  });
}

function toCroppedFileName(name: string) {
  const withoutExtension = name.replace(/\.[^.]+$/, "") || "image";
  return `${withoutExtension}-instagram-crop.jpg`;
}

function validateSelectedMedia(type: ComposePostType, items: SelectedMedia[]) {
  if (type !== "post" && type !== "carousel") return null;

  const unsupported = items.find((item) => {
    if (item.kind !== "image" || !item.width || !item.height) return false;
    const aspect = item.width / item.height;
    return aspect < FEED_IMAGE_MIN_ASPECT || aspect > FEED_IMAGE_MAX_ASPECT;
  });

  if (!unsupported?.width || !unsupported.height) return null;

  return `Instagram feed images must be between 4:5 and 1.91:1. This image is ${unsupported.width}x${unsupported.height}; crop it to square, 4:5, or 1.91:1.`;
}

function revokePreviewUrls(items: SelectedMedia[]) {
  items.forEach((item) => URL.revokeObjectURL(item.previewUrl));
}

function readErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    const body = error.body;
    if (body && typeof body === "object" && "message" in body) {
      const message = (body as { message?: unknown }).message;
      if (Array.isArray(message)) return message.join(", ");
      if (typeof message === "string") return message;
    }
  }
  if (error instanceof Error && error.message) return error.message;
  return null;
}

function countCaptionToken(caption: string, token: "#" | "@") {
  const expression =
    token === "#"
      ? /(?:^|\s)#[\p{L}\p{N}_]+/gu
      : /(?:^|\s)@[\p{L}\p{N}._]+/gu;
  return caption.match(expression)?.length ?? 0;
}

function AccountAvatar({
  username,
  avatarUrl,
  className = "size-5 rounded",
}: {
  username: string;
  avatarUrl?: string | null;
  className?: string;
}) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center overflow-hidden bg-[#4e8b73] text-[9px] font-semibold uppercase text-white ${className}`}
    >
      {avatarUrl ? (
        <NextImage
          src={avatarUrl}
          alt=""
          width={32}
          height={32}
          className="size-full object-cover"
        />
      ) : (
        username.slice(0, 2)
      )}
    </span>
  );
}

function MediaTile({
  media,
  isCover,
  onRemove,
}: {
  media: SelectedMedia;
  isCover: boolean;
  onRemove: () => void;
}) {
  return (
    <div className="group relative h-[188px] min-w-0 overflow-hidden rounded-lg bg-[#495057]">
      {media.kind === "image" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={media.previewUrl}
          alt=""
          className="h-full w-full object-cover"
        />
      ) : (
        <video
          src={media.previewUrl}
          className="h-full w-full object-cover"
          muted
          playsInline
        />
      )}
      {media.kind === "video" ? (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 text-paper">
          <Play className="size-7 fill-current" strokeWidth={1.5} />
        </div>
      ) : null}
      {isCover ? (
        <span className="absolute left-2 top-2 rounded bg-paper px-1.5 py-1 text-[8px] font-semibold uppercase tracking-wide text-[#423c35]">
          Cover
        </span>
      ) : null}
      <span className="absolute bottom-2 left-2 rounded bg-[#181610]/80 px-1.5 py-1 text-[8px] font-semibold uppercase text-white">
        {media.kind === "video" ? "MP4" : "JPG"}
      </span>
      <button
        type="button"
        aria-label="Remove media"
        onClick={onRemove}
        className="absolute right-2 top-2 flex size-6 items-center justify-center rounded-full bg-ink/70 text-paper opacity-0 transition-opacity group-hover:opacity-100"
      >
        <Trash2 className="size-3" strokeWidth={2} />
      </button>
    </div>
  );
}

function AccountChip({
  username,
  avatarUrl,
  selected,
  onClick,
}: {
  username: string;
  avatarUrl?: string | null;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`flex h-[44px] min-w-[164px] shrink-0 items-center gap-2 overflow-hidden rounded-md border px-2.5 py-1.5 text-left ${
        selected ? "border-[#dcd6cb] bg-paper" : "border-[#eee9df] bg-[#fbfaf7]"
      }`}
    >
      <AccountAvatar username={username} avatarUrl={avatarUrl} />
      <span className="min-w-0 flex-1 truncate">
        <span className="block truncate text-[11px] font-medium leading-4 text-[#302b23]">
          {username}
        </span>
        <span className="block truncate text-[9px] text-[#837c73]">
          IG - @{username}
        </span>
      </span>
      {selected ? (
        <X className="size-3 shrink-0 text-[#968f84]" strokeWidth={2} />
      ) : null}
    </button>
  );
}

function Switch({
  on,
  onToggle,
}: {
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={on}
      className="shrink-0"
    >
      <div
        className={`relative h-[18px] w-8 rounded-full ${on ? "bg-[#607ffc]" : "bg-[#dbd6cd]"}`}
      >
        <div
          className={`absolute top-0.5 size-3.5 rounded-full bg-paper shadow-[0_2px_4px_0_rgba(39,39,39,0.1)] transition-all ${
            on ? "left-[16px]" : "left-0.5"
          }`}
        />
      </div>
    </button>
  );
}

export function CreatePostModal({
  open,
  type,
  defaultScheduledIso,
  onClose,
  onCreated,
}: Props) {
  const [composeType, setComposeType] = useState<ComposePostType>(type);
  const [accounts, setAccounts] = useState<InstagramAccountResponse[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [accountPickerOpen, setAccountPickerOpen] = useState(false);
  const [caption, setCaption] = useState("");
  const [media, setMedia] = useState<SelectedMedia[]>([]);
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [scheduledFor, setScheduledFor] = useState(() =>
    defaultScheduledInputValue(defaultScheduledIso),
  );
  const [submitting, setSubmitting] = useState(false);
  const [submittingAction, setSubmittingAction] =
    useState<SubmitAction | null>(null);
  const [primaryAction, setPrimaryAction] = useState<"schedule" | "post-now">(
    "schedule",
  );
  const [error, setError] = useState<string | null>(null);
  const [accountResults, setAccountResults] = useState<AccountSubmitResult[]>(
    [],
  );
  const captionRef = useRef<HTMLTextAreaElement>(null);
  const scheduledForRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setAccountResults([]);
    setAccountsLoading(true);
    apiFetchBrowser<InstagramAccountResponse[]>("/instagram/accounts")
      .then((list) => {
        setAccounts(list);
      })
      .catch(() => {
        if (process.env.NODE_ENV !== "production") {
          console.info(
            "Instagram accounts could not be loaded. Make sure the API server is running.",
          );
        }
        setError("Failed to load accounts");
      })
      .finally(() => setAccountsLoading(false));
  }, [open]);

  useEffect(() => {
    if (open) {
      setComposeType(type);
      setPrimaryAction("schedule");
      setSelectedAccountIds([]);
      setAccountPickerOpen(false);
      setScheduledFor(defaultScheduledInputValue(defaultScheduledIso));
    }
  }, [open, type, defaultScheduledIso]);

  useEffect(() => {
    if (open) return;
    setSelectedAccountIds([]);
    setAccountPickerOpen(false);
    if (!media.length) return;
    revokePreviewUrls(media);
    setMedia([]);
  }, [open, media]);

  if (!open) return null;

  const clearMedia = () => {
    revokePreviewUrls(media);
    setMedia([]);
  };

  const handleMediaChange = async (files: FileList | null) => {
    if (!files) return;
    setError(null);
    const nextFiles = [...files];
    const combinedFiles = [...media.map((item) => item.file), ...nextFiles];
    const validationError = validateMediaFiles(composeType, combinedFiles);
    if (validationError) {
      setError(validationError);
      return;
    }

    const nextMedia = nextFiles.map(buildSelectedMedia);
    try {
      const preparedMedia = await prepareMediaForType(composeType, nextMedia);
      const allMedia = [...media, ...preparedMedia];
      const dimensionError = validateSelectedMedia(composeType, allMedia);
      if (dimensionError) {
        revokePreviewUrls(preparedMedia);
        setError(dimensionError);
        return;
      }
      setMedia(allMedia);
    } catch {
      revokePreviewUrls(nextMedia);
      setError("Could not read media dimensions");
    }
  };

  const removeMedia = (id: string) => {
    setMedia((current) => {
      const removed = current.find((item) => item.id === id);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return current.filter((item) => item.id !== id);
    });
  };

  const toggleAccount = (accountId: string) => {
    setSelectedAccountIds((current) =>
      current.includes(accountId)
        ? current.filter((id) => id !== accountId)
        : [...current, accountId],
    );
  };

  const addAccount = (accountId: string) => {
    setSelectedAccountIds((current) =>
      current.includes(accountId) ? current : [...current, accountId],
    );
    setAccountPickerOpen(false);
  };

  const insertCaptionToken = (token: "#" | "@") => {
    const input = captionRef.current;
    const start = input?.selectionStart ?? caption.length;
    const end = input?.selectionEnd ?? start;
    const before = caption.slice(0, start);
    const insert = before && !/\s$/.test(before) ? ` ${token}` : token;
    const nextCaption = `${before}${insert}${caption.slice(end)}`.slice(0, 2200);
    const caret = Math.min(start + insert.length, nextCaption.length);

    setCaption(nextCaption);
    window.requestAnimationFrame(() => {
      input?.focus();
      input?.setSelectionRange(caret, caret);
    });
  };

  const showSchedulePicker = () => {
    const input = scheduledForRef.current;
    input?.focus();
    input?.showPicker?.();
  };

  const uploadSelectedMedia = async (
    items: SelectedMedia[],
  ): Promise<string[]> => {
    if (items.length === 0) return [];

    const uploadIntent = await apiFetchBrowser<MediaUploadUrlResponse>(
      "/media/upload-urls",
      {
        method: "POST",
        body: {
          files: items.map((item) => ({
            name: item.file.name,
            mimeType: item.file.type,
            fileSize: item.file.size,
          })),
        },
      },
    );
    const supabase = createClient();

    await Promise.all(
      items.map(async (item, idx) => {
        const upload = uploadIntent.uploads[idx];
        const { error: uploadError } = await supabase.storage
          .from(upload.bucket)
          .uploadToSignedUrl(upload.storagePath, upload.token, item.file, {
            contentType: item.file.type,
          });
        if (uploadError) throw uploadError;
      }),
    );

    const completed = await apiFetchBrowser<MediaAssetsResponse>(
      "/media/assets",
      {
        method: "POST",
        body: {
          files: items.map((item, idx) => ({
            storagePath: uploadIntent.uploads[idx].storagePath,
            mimeType: item.file.type,
            fileSize: item.file.size,
            width: item.width,
            height: item.height,
            durationSeconds: item.durationSeconds,
          })),
        },
      },
    );

    return completed.assets.map((asset) => asset.id);
  };

  const handleSubmit = async (action: SubmitAction) => {
    setError(null);
    setAccountResults([]);
    if (selectedAccountIds.length === 0) {
      setError("Select at least one account");
      return;
    }
    const typeValidationError = validateMediaFiles(
      composeType,
      media.map((item) => item.file),
    );
    if (typeValidationError) {
      setError(typeValidationError);
      return;
    }
    let mediaForSubmit: SelectedMedia[];
    try {
      mediaForSubmit = await prepareMediaForType(composeType, media);
      if (mediaForSubmit.some((item, idx) => item !== media[idx])) {
        setMedia(mediaForSubmit);
      }
    } catch {
      setError("Could not read media dimensions");
      return;
    }
    const mediaValidationError = validateSelectedMedia(composeType, mediaForSubmit);
    if (mediaValidationError) {
      setError(mediaValidationError);
      return;
    }
    if (
      action !== "draft" &&
      composeType === "carousel" &&
      mediaForSubmit.length < 2
    ) {
      setError("Carousels require at least 2 images before publishing");
      return;
    }
    let scheduledDate: Date | null = null;
    if (action === "schedule") {
      if (!scheduledFor) {
        setError("Pick a schedule time");
        return;
      }
      scheduledDate = new Date(scheduledFor);
      if (Number.isNaN(scheduledDate.getTime())) {
        setError("Invalid date");
        return;
      }
      if (scheduledDate <= new Date()) {
        setError("Pick a future schedule time");
        return;
      }
    }
    setSubmitting(true);
    setSubmittingAction(action);
    try {
      const mediaAssetIds = await uploadSelectedMedia(mediaForSubmit);
      const results = await Promise.all(
        selectedAccountIds.map(async (instagramAccountId) => {
          const username =
            accounts.find((account) => account.id === instagramAccountId)
              ?.username ?? "Account";
          try {
            await apiFetchBrowser("/calendar/events", {
              method: "POST",
              body: {
                instagramAccountId,
                postType:
                  composeType === "post" && mediaAssetIds.length > 1
                    ? "CAROUSEL"
                    : TYPE_TO_POST_TYPE[composeType],
                action: ACTION_TO_API[action],
                scheduledFor: scheduledDate?.toISOString(),
                caption: caption || undefined,
                requiresApproval,
                mediaAssetIds,
              },
            });
            return { accountId: instagramAccountId, username, ok: true };
          } catch (postError) {
            return {
              accountId: instagramAccountId,
              username,
              ok: false,
              message: readErrorMessage(postError) ?? SUBMIT_ERROR[action],
            };
          }
        }),
      );
      setAccountResults(results);
      const failed = results.filter((result) => !result.ok);
      if (failed.length) {
        if (results.some((result) => result.ok)) onCreated();
        setSelectedAccountIds(failed.map((result) => result.accountId));
        setError(
          failed.length === results.length
            ? SUBMIT_ERROR[action]
            : "Some accounts failed. Only failed accounts remain selected for retry.",
        );
        return;
      }
      setCaption("");
      clearMedia();
      onClose();
      onCreated();
    } catch (err) {
      if (process.env.NODE_ENV !== "production") {
        console.info(
          "Post action could not be completed. Make sure the API server is running.",
        );
      }
      const detail = readErrorMessage(err);
      setError(
        detail ? `${SUBMIT_ERROR[action]}: ${detail}` : SUBMIT_ERROR[action],
      );
    } finally {
      setSubmitting(false);
      setSubmittingAction(null);
    }
  };

  const scheduleDisabled =
    submitting || accountsLoading || selectedAccountIds.length === 0;
  const minScheduledFor = toLocalDatetimeInputValue(new Date().toISOString());
  const previewMedia = media[0] ?? null;
  const submitButtonLabel = submittingAction
    ? SUBMITTING_LABEL[submittingAction]
    : primaryAction === "post-now"
      ? "Post now"
      : "Schedule";
  const selectedAccounts = accounts.filter((account) =>
    selectedAccountIds.includes(account.id),
  );
  const previewAccountLabel =
    selectedAccounts.length > 1
      ? `${selectedAccounts[0].username} +${selectedAccounts.length - 1}`
      : (selectedAccounts[0]?.username ?? "Preview");
  const isCarouselPreview =
    composeType === "carousel" || (composeType === "post" && media.length > 1);
  const captionCount = caption.length;
  const hashtagCount = countCaptionToken(caption, "#");
  const mentionCount = countCaptionToken(caption, "@");
  const availableAccounts = accounts.filter(
    (account) => !selectedAccountIds.includes(account.id),
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Schedule a post"
      className="fixed inset-0 z-50 flex items-center justify-center p-2"
      style={{ backgroundColor: "rgba(42, 39, 33, 0.36)" }}
      onClick={onClose}
    >
      <div
        className="flex h-[min(860px,calc(100vh-16px))] w-[min(1240px,calc(100vw-16px))] flex-col overflow-hidden rounded-xl border border-[#e7e1d6] bg-[#fffdfa] shadow-[0_22px_60px_rgba(42,39,33,0.18)]"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex h-[60px] shrink-0 items-center justify-between border-b border-[#ece7de] px-5">
          <h2 className="text-base font-semibold tracking-[-0.02em] text-[#171510]">
            Schedule a post
          </h2>
          <div className="flex items-center">
            <button
              type="button"
              aria-label="Close compose window"
              onClick={onClose}
              className="flex size-7 items-center justify-center rounded-full text-[#797268] hover:bg-[#f3f0ea]"
            >
              <X className="size-3.5" />
            </button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1">
          <div className="flex min-w-0 flex-1 flex-col gap-4 overflow-y-auto border-r border-[#ece7de] px-6 py-4">
            <section>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-[11px] font-semibold text-[#27231d]">Publish to</h3>
                <span className="text-[10px] text-[#817a70]">
                  {selectedAccountIds.length} account{selectedAccountIds.length === 1 ? "" : "s"} selected
                </span>
              </div>
              <div className="relative flex flex-wrap gap-2 pb-1">
                {selectedAccounts.map((account) => (
                  <AccountChip
                    key={account.id}
                    username={account.username}
                    avatarUrl={account.avatarUrl}
                    selected
                    onClick={() => toggleAccount(account.id)}
                  />
                ))}
                <button
                  type="button"
                  aria-expanded={accountPickerOpen}
                  onClick={() => setAccountPickerOpen((current) => !current)}
                  className="flex h-[44px] shrink-0 items-center gap-1.5 rounded-md border border-dashed border-[#ddd7cd] px-3 text-[10px] text-[#686158] transition-colors hover:bg-[#f7f5ef]"
                >
                  <Plus className="size-3" />
                  Add account
                </button>
                {accountPickerOpen ? (
                  <div className="absolute left-0 top-[52px] z-20 flex max-h-56 w-[360px] flex-col gap-2 overflow-y-auto rounded-lg border border-[#e7e1d6] bg-paper p-2 shadow-[0_14px_30px_rgba(39,39,39,0.12)]">
                    {accountsLoading ? (
                      <p className="px-2 py-3 text-xs text-[#817a70]">Loading accounts...</p>
                    ) : availableAccounts.length ? (
                      availableAccounts.map((account) => (
                        <AccountChip
                          key={account.id}
                          username={account.username}
                          avatarUrl={account.avatarUrl}
                          selected={false}
                          onClick={() => addAccount(account.id)}
                        />
                      ))
                    ) : (
                      <p className="px-2 py-3 text-xs text-[#817a70]">
                        {accounts.length
                          ? "All connected accounts are selected."
                          : "No Instagram accounts connected yet."}
                      </p>
                    )}
                  </div>
                ) : null}
              </div>
            </section>

            <section>
              <h3 className="mb-2 text-[11px] font-semibold text-[#27231d]">Post type</h3>
              <div className="grid grid-cols-4 gap-1.5">
                {(["post", "story", "reels", "carousel"] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={composeType === option}
                    onClick={() => setComposeType(option)}
                    className={`h-8 rounded-md border text-[11px] font-medium ${
                      composeType === option
                        ? "border-[#6682fa] bg-[#e7edff] text-[#4f69ca]"
                        : "border-[#e7e1d6] bg-paper text-[#534e47]"
                    }`}
                  >
                    {TYPE_LABEL[option]}
                  </button>
                ))}
              </div>
            </section>

            <section>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-[11px] font-semibold text-[#27231d]">Caption</h3>
                <div className="flex items-center gap-3 text-[10px] text-[#766f66]">
                  <button
                    type="button"
                    onClick={() => insertCaptionToken("#")}
                    className="inline-flex items-center gap-1 rounded px-1.5 py-1 transition-colors hover:bg-[#f3f0ea]"
                  >
                    <Hash className="size-3" />
                    Hashtag
                  </button>
                  <button
                    type="button"
                    onClick={() => insertCaptionToken("@")}
                    className="inline-flex items-center gap-1 rounded px-1.5 py-1 transition-colors hover:bg-[#f3f0ea]"
                  >
                    <AtSign className="size-3" />
                    Mention
                  </button>
                </div>
              </div>
              <div className="overflow-hidden rounded-md border border-[#e7e1d6] bg-paper">
                <textarea
                  ref={captionRef}
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  maxLength={2200}
                  placeholder="Write a caption..."
                  className="h-[112px] w-full resize-none bg-transparent px-3 py-2.5 text-[11px] leading-5 text-[#302b23] placeholder:text-[#9a9388] focus:outline-none"
                />
                <div className="flex h-7 items-center justify-between border-t border-[#eee9df] px-3 text-[9px] text-[#827a71]">
                  <span>
                    {captionCount} / 2,200 - {hashtagCount} hashtag{hashtagCount === 1 ? "" : "s"} - {mentionCount} mention{mentionCount === 1 ? "" : "s"}
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <span className="flex gap-0.5">
                      <span className="h-1 w-3 bg-[#6e9d76]" />
                      <span className="h-1 w-3 bg-[#6e9d76]" />
                      <span className="h-1 w-3 bg-[#6e9d76]" />
                      <span className="h-1 w-3 bg-[#ded9cf]" />
                    </span>
                    Readability: good
                  </span>
                </div>
              </div>
            </section>

            <section>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-[11px] font-semibold text-[#27231d]">Media</h3>
                <span className="text-[10px] text-[#817a70]">
                  {media.length} of {mediaLimitForType(composeType)} attached - 1080 x 1350 recommended
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {media.map((item, index) => (
                  <MediaTile
                    key={item.id}
                    media={item}
                    isCover={index === 0}
                    onRemove={() => removeMedia(item.id)}
                  />
                ))}
                {media.length < mediaLimitForType(composeType) ? (
                  <label className="flex h-[188px] cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[#d9d3c8] bg-paper text-[#857e74]">
                    <Plus className="size-4" strokeWidth={1.8} />
                    <span className="text-[10px] font-medium">Add</span>
                    <input
                      type="file"
                      accept={acceptForType(composeType)}
                      multiple={composeType === "post" || composeType === "carousel"}
                      className="sr-only"
                      onChange={(e) => {
                        void handleMediaChange(e.target.files);
                        e.target.value = "";
                      }}
                    />
                  </label>
                ) : null}
              </div>
            </section>

            <section>
              <h3 className="mb-2 text-[11px] font-semibold text-[#27231d]">Options</h3>
              <div className="flex items-center gap-3 rounded-md border border-[#e7e1d6] bg-paper px-3 py-2.5">
                <Switch
                  on={requiresApproval}
                  onToggle={() => setRequiresApproval((value) => !value)}
                />
                <span className="min-w-0">
                  <span className="block text-[11px] font-medium text-[#302b23]">
                    Wait for approval
                  </span>
                  <span className="block text-[10px] text-[#817a70]">
                    Require approval before publishing.
                  </span>
                </span>
              </div>
            </section>

            {error ? (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                {error}
              </p>
            ) : null}
            {accountResults.length ? (
              <div className="flex flex-col gap-2 rounded-md border border-[#e7e1d6] bg-paper p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[#817a70]">
                  Account results
                </p>
                {accountResults.map((result) => (
                  <div
                    key={result.accountId}
                    className="flex items-start justify-between gap-3 text-xs"
                  >
                    <span className="font-medium text-[#302b23]">@{result.username}</span>
                    <span className={result.ok ? "text-success" : "text-danger"}>
                      {result.ok ? "Success" : result.message}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <aside className="hidden w-[360px] shrink-0 flex-col gap-3 bg-[#f7f5ef] px-4 py-4 lg:flex">
            <div className="overflow-hidden rounded-lg border border-[#e4ded4] bg-paper">
              <div className="flex h-[44px] items-center gap-2 px-3">
                {selectedAccounts[0] ? (
                  <AccountAvatar
                    username={selectedAccounts[0].username}
                    avatarUrl={selectedAccounts[0].avatarUrl}
                    className="size-7 rounded-full"
                  />
                ) : (
                  <span className="flex size-7 items-center justify-center rounded-full bg-[#e8e2d9] text-[#8e887d]">
                    <User className="size-3.5" />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[11px] font-semibold text-[#302b23]">
                    {previewAccountLabel}
                  </span>
                  <span className="block truncate text-[9px] text-[#817a70]">
                    Instagram - Sponsored
                  </span>
                </span>
                <MoreHorizontal className="size-3.5 text-[#716b61]" />
              </div>
              <div className="relative flex aspect-[4/5] items-center justify-center overflow-hidden bg-gradient-to-br from-[#8252a4] via-[#55517c] to-[#28314f]">
                {isCarouselPreview ? (
                  <span className="absolute right-2 top-2 rounded bg-[#17141d] px-1.5 py-1 text-[8px] font-semibold text-white">
                    Carousel
                  </span>
                ) : null}
                {previewMedia?.kind === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previewMedia.previewUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : previewMedia?.kind === "video" ? (
                  <>
                    <video
                      src={previewMedia.previewUrl}
                      className="h-full w-full object-cover"
                      muted
                      playsInline
                    />
                    <Play className="absolute size-12 fill-current text-white" />
                  </>
                ) : (
                  <ImageIcon className="size-14 text-white/30" strokeWidth={1.2} />
                )}
                {isCarouselPreview ? (
                  <span className="absolute bottom-2 left-0 right-0 flex justify-center gap-1">
                    <span className="size-1.5 rounded-full bg-paper" />
                    <span className="size-1.5 rounded-full bg-paper/50" />
                    <span className="size-1.5 rounded-full bg-paper/50" />
                  </span>
                ) : null}
              </div>
              <div className="px-3 py-2.5">
                <div className="flex items-center gap-3 text-[#302b23]">
                  <Heart className="size-4" />
                  <MessageCircle className="size-4" />
                  <Send className="size-4" />
                  <Bookmark className="ml-auto size-4" />
                </div>
                <p className="mt-1.5 text-[10px] font-semibold text-[#302b23]">
                  1,284 likes - {previewAccountLabel}
                </p>
                <p className="mt-1 line-clamp-2 text-[10px] leading-4 text-[#302b23]">
                  {caption || "Your caption preview will appear here as you write."}
                </p>
                <p className="mt-1.5 text-[9px] uppercase tracking-wide text-[#a29a8f]">
                  2 minutes ago
                </p>
              </div>
            </div>
            <div className="rounded-lg border border-[#e4ded4] bg-paper p-3 text-[10px]">
              <p className="flex items-center gap-2 text-[#568164]">
                <Check className="size-3" />
                {selectedAccounts.length ? "Account selected" : "Select an account"}
              </p>
              <p className={`mt-1 flex items-center gap-2 ${media.length ? "text-[#568164]" : "text-[#a57630]"}`}>
                {media.length ? <Check className="size-3" /> : <CircleAlert className="size-3" />}
                {media.length ? "Media ready for preview" : "Add media before publishing"}
              </p>
              <p className={`mt-1 flex items-center gap-2 ${captionCount <= 125 ? "text-[#568164]" : "text-[#a57630]"}`}>
                {captionCount <= 125 ? <Check className="size-3" /> : <CircleAlert className="size-3" />}
                Caption {captionCount <= 125 ? "fits above the fold" : "may truncate in feed"}
              </p>
            </div>
          </aside>
        </div>

        <footer className="flex h-[56px] shrink-0 items-center justify-between gap-4 border-t border-[#ece7de] bg-paper px-6">
          <button
            type="button"
            disabled={scheduleDisabled}
            onClick={() => void handleSubmit("draft")}
            className="h-8 rounded-md border border-[#e7e1d6] bg-paper px-4 text-[11px] font-medium text-[#615a50] transition-colors hover:bg-[#f7f5ef] disabled:opacity-50"
          >
            {submittingAction === "draft" ? "Saving..." : "Save as draft"}
          </button>
          <div className="flex items-center gap-2">
            <div className="relative flex h-9 w-[142px] items-center rounded-lg border border-[#e7e1d6] bg-paper p-1 text-[10px]">
              <span
                aria-hidden="true"
                className={`absolute bottom-1 left-1 top-1 w-[calc(50%-4px)] rounded-md bg-[#f1eee8] shadow-sm transition-transform duration-300 ease-out ${
                  primaryAction === "schedule" ? "translate-x-full" : "translate-x-0"
                }`}
              />
              <button
                type="button"
                onClick={() => setPrimaryAction("post-now")}
                className={`relative z-[1] h-full flex-1 transition-colors duration-300 ${
                  primaryAction === "post-now" ? "font-semibold text-[#302b23]" : "text-[#756e64]"
                }`}
              >
                Now
              </button>
              <button
                type="button"
                onClick={() => setPrimaryAction("schedule")}
                className={`relative z-[1] h-full flex-1 transition-colors duration-300 ${
                  primaryAction === "schedule" ? "font-semibold text-[#302b23]" : "text-[#756e64]"
                }`}
              >
                Schedule
              </button>
            </div>
            <label
              onClick={showSchedulePicker}
              className={`flex h-9 cursor-pointer items-center gap-2 overflow-hidden rounded-lg bg-paper transition-[width,opacity,transform,border-color,padding] duration-300 ease-out ${
                primaryAction === "schedule"
                  ? "w-[214px] translate-x-0 border border-[#e7e1d6] px-3 opacity-100"
                  : "pointer-events-none w-0 translate-x-2 border border-transparent px-0 opacity-0"
              }`}
            >
                <Calendar className="size-3.5 text-[#756e64]" strokeWidth={1.8} />
                <input
                  ref={scheduledForRef}
                  aria-label="Scheduled date and time"
                  type="datetime-local"
                  value={scheduledFor}
                  min={minScheduledFor}
                  onChange={(e) => setScheduledFor(e.target.value)}
                  className="min-w-[170px] cursor-pointer bg-transparent text-[10px] font-medium text-[#4e4840] focus:outline-none"
                />
            </label>
            <div className="flex h-9 items-center rounded-lg bg-[#171510] text-white">
              <button
                type="button"
                disabled={scheduleDisabled}
                onClick={() => void handleSubmit(primaryAction)}
                className="flex h-full items-center rounded-lg px-5 text-[11px] font-semibold disabled:opacity-60"
              >
                {submitButtonLabel}
              </button>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
