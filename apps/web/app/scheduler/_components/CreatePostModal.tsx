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
  Pencil,
  Play,
  Plus,
  Save,
  Send,
  Trash2,
  User,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AvatarImage } from "@/app/_components/AvatarImage";
import { ApiError, apiFetchBrowser } from "@/lib/api/browser-client";
import {
  createMetadataField,
  metadataDefinitionsToFields,
  metadataFieldsToPayload,
  type MetadataField,
  type UserMetadataField,
} from "@/lib/post-metadata";
import { createClient } from "@/lib/supabase/client";
import type { SchedulerPostType } from "./data";
import {
  buildInstagramMediaIssues,
  FEED_IMAGE_MAX_ASPECT,
  FEED_IMAGE_MIN_ASPECT,
  firstBlockingInstagramIssue,
  INSTAGRAM_FEED_IMAGE_MAX_WIDTH,
  INSTAGRAM_IMAGE_MAX_SIZE,
  INSTAGRAM_VIDEO_MAX_SIZE,
  type InstagramMediaIssue,
  type InstagramRuleMediaItem,
} from "./instagram-media-rules";

export type CreatePostType = "post" | "story" | "reels" | "carousel";
type ComposePostType = CreatePostType;
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

const TYPE_TO_POST_TYPE: Record<ComposePostType, SchedulerPostType> = {
  post: "FEED",
  story: "STORY",
  reels: "REEL",
  carousel: "CAROUSEL",
};

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
  if (type === "post") return "image/*";
  if (type === "carousel") return "image/*,video/*";
  return type === "reels" ? "video/*" : "image/*,video/*";
}

function validateMediaFiles(type: ComposePostType, files: File[]) {
  const limit = mediaLimitForType(type);
  if (files.length > limit) {
    return type === "post" || type === "carousel"
      ? "Posts and carousels can include up to 10 files"
      : "Stories and reels can include 1 file";
  }
  if (files.some((file) => file.size > INSTAGRAM_VIDEO_MAX_SIZE)) {
    return "Each media file must be 300 MB or smaller";
  }
  if (files.some((file) => !file.type.startsWith("image/") && !file.type.startsWith("video/"))) {
    return "Only image and video files are supported";
  }
  if (
    type === "post" &&
    files.some((file) => file.type.startsWith("video/"))
  ) {
    return "Posts support images only. Use reels for single videos or carousel for mixed media";
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
  const needsAspectCrop =
    aspect < FEED_IMAGE_MIN_ASPECT || aspect > FEED_IMAGE_MAX_ASPECT;
  const needsJpeg =
    item.file.type !== "image/jpeg" && item.file.type !== "image/jpg";
  const needsDownscale =
    item.width > INSTAGRAM_FEED_IMAGE_MAX_WIDTH ||
    item.file.size > INSTAGRAM_IMAGE_MAX_SIZE;

  if (!needsAspectCrop && !needsJpeg && !needsDownscale) {
    return item;
  }

  const image = await loadImage(item.previewUrl);
  const targetAspect = needsAspectCrop
    ? aspect < FEED_IMAGE_MIN_ASPECT
      ? FEED_IMAGE_MIN_ASPECT
      : FEED_IMAGE_MAX_ASPECT
    : aspect;
  const sourceWidth =
    aspect > targetAspect ? item.height * targetAspect : item.width;
  const sourceHeight =
    aspect > targetAspect ? item.height : item.width / targetAspect;
  const sourceX = (item.width - sourceWidth) / 2;
  const sourceY = (item.height - sourceHeight) / 2;
  const outputScale = Math.min(
    1,
    INSTAGRAM_FEED_IMAGE_MAX_WIDTH / sourceWidth,
  );
  const outputWidth = Math.max(1, Math.round(sourceWidth * outputScale));
  const outputHeight = Math.max(1, Math.round(sourceHeight * outputScale));
  const canvas = document.createElement("canvas");
  canvas.width = outputWidth;
  canvas.height = outputHeight;
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

  if (croppedFile.size > INSTAGRAM_IMAGE_MAX_SIZE) {
    throw new Error("Instagram images must be 8 MB or smaller");
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

function validateSelectedMediaForPublish(
  type: ComposePostType,
  items: SelectedMedia[],
) {
  return firstBlockingInstagramIssue(
    type,
    selectedMediaToRuleItems(items),
    { autoCarouselPost: true, forPublish: true },
  )?.message ?? null;
}

function buildSelectedMediaIssues(type: ComposePostType, items: SelectedMedia[]) {
  return buildInstagramMediaIssues(type, selectedMediaToRuleItems(items), {
    autoCarouselPost: true,
    convertsFeedImages: true,
  });
}

function selectedMediaToRuleItems(
  items: SelectedMedia[],
): InstagramRuleMediaItem[] {
  return items.map((item) => ({
    id: item.id,
    fileType: item.kind === "image" ? "IMAGE" : "VIDEO",
    mimeType: item.file.type,
    fileSize: item.file.size,
    width: item.width,
    height: item.height,
    durationSeconds: item.durationSeconds,
  }));
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
  fallbackSeed,
}: {
  username: string;
  avatarUrl?: string | null;
  className?: string;
  fallbackSeed?: string;
}) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center overflow-hidden bg-[#4e8b73] text-[9px] font-semibold uppercase text-white ${className}`}
    >
      <AvatarImage
        src={avatarUrl}
        alt=""
        width={32}
        height={32}
        className="size-full object-cover"
        fallback={username.slice(0, 2)}
        fallbackSeed={fallbackSeed ?? username}
      />
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
  const mediaLabel = media.kind === "video" ? "MP4" : imageFileLabel(media.file);

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
        <span className="absolute left-2 top-2 rounded bg-paper px-1.5 py-1 text-[8px] font-semibold uppercase tracking-wide text-ink">
          Cover
        </span>
      ) : null}
      <span className="absolute bottom-2 left-2 rounded bg-[#181610]/80 px-1.5 py-1 text-[8px] font-semibold uppercase text-white">
        {mediaLabel}
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

function imageFileLabel(file: File) {
  if (file.type === "image/jpeg" || file.type === "image/jpg") return "JPG";
  if (file.type === "image/png") return "PNG";
  if (file.type === "image/webp") return "WEBP";
  return "IMG";
}

function MediaIssueList({
  issues,
  compact = false,
}: {
  issues: InstagramMediaIssue[];
  compact?: boolean;
}) {
  if (!issues.length) return null;

  return (
    <div
      className={
        compact
          ? "mt-2 text-[10px]"
          : "mt-2 rounded-md border border-line bg-paper p-3 text-[10px]"
      }
    >
      <p className="mb-1 font-semibold uppercase tracking-wide text-muted">
        Instagram media checks
      </p>
      <div className="flex flex-col gap-1">
        {issues.slice(0, 4).map((issue) => (
          <p
            key={issue.key}
            className={`flex items-start gap-2 leading-4 ${
              issue.severity === "error" ? "text-danger" : "text-chart-4"
            }`}
          >
            <CircleAlert className="mt-0.5 size-3 shrink-0" />
            <span>{issue.message}</span>
          </p>
        ))}
        {issues.length > 4 ? (
          <p className="text-muted">+{issues.length - 4} more checks</p>
        ) : null}
      </div>
    </div>
  );
}

function AccountChip({
  accountId,
  username,
  avatarUrl,
  selected,
  onClick,
}: {
  accountId: string;
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
        selected ? "border-line bg-paper" : "border-line bg-card"
      }`}
    >
      <AccountAvatar
        username={username}
        avatarUrl={avatarUrl}
        fallbackSeed={accountId}
      />
      <span className="min-w-0 flex-1 truncate">
        <span className="block truncate text-[11px] font-medium leading-4 text-ink">
          {username}
        </span>
        <span className="block truncate text-[9px] text-muted">
          IG - @{username}
        </span>
      </span>
      {selected ? (
        <X className="size-3 shrink-0 text-muted" strokeWidth={2} />
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
        className={`relative h-[18px] w-8 rounded-full ${on ? "bg-cta" : "bg-line"}`}
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
  const [userMetadataFields, setUserMetadataFields] = useState<
    UserMetadataField[]
  >([]);
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [accountPickerOpen, setAccountPickerOpen] = useState(false);
  const [caption, setCaption] = useState("");
  const [metadataFields, setMetadataFields] = useState<MetadataField[]>(() => [
    createMetadataField(),
  ]);
  const [metadataEditing, setMetadataEditing] = useState(false);
  const [metadataSaving, setMetadataSaving] = useState(false);
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
    Promise.all([
      apiFetchBrowser<InstagramAccountResponse[]>("/instagram/accounts"),
      apiFetchBrowser<UserMetadataField[]>("/scheduler/metadata-fields"),
    ])
      .then(([list, fields]) => {
        setAccounts(list);
        setUserMetadataFields(fields);
        setMetadataFields(metadataDefinitionsToFields(fields));
        setMetadataEditing(false);
        setMetadataSaving(false);
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
      setMetadataFields([createMetadataField()]);
      setMetadataEditing(false);
      setMetadataSaving(false);
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
    const nextComposeType =
      composeType !== "carousel" && combinedFiles.length > 1
        ? "carousel"
        : composeType;
    const validationError = validateMediaFiles(nextComposeType, combinedFiles);
    if (validationError) {
      setError(validationError);
      return;
    }

    const nextMedia = nextFiles.map(buildSelectedMedia);
    try {
      const preparedMedia = await prepareMediaForType(nextComposeType, nextMedia);
      const allMedia = [...media, ...preparedMedia];
      setMedia(allMedia);
      if (nextComposeType !== composeType) {
        setComposeType(nextComposeType);
      }
    } catch (mediaError) {
      revokePreviewUrls(nextMedia);
      setError(
        mediaError instanceof Error
          ? mediaError.message
          : "Could not read media dimensions",
      );
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

  const updateMetadataField = (
    id: string,
    field: "label" | "value",
    value: string,
  ) => {
    setMetadataFields((current) =>
      current.map((item) =>
        item.id === id ? { ...item, [field]: value } : item,
      ),
    );
  };

  const addMetadataField = () => {
    setMetadataFields((current) => [...current, createMetadataField()]);
  };

  const removeMetadataField = (id: string) => {
    setMetadataFields((current) => {
      const next = current.filter((item) => item.id !== id);
      return next.length ? next : [createMetadataField()];
    });
  };

  const saveMetadataFields = async () => {
    const { metadata, error: metadataError } =
      metadataFieldsToPayload(metadataFields);
    if (metadataError) {
      setError(metadataError);
      return;
    }

    const valueByFieldId = new Map(
      metadataFields.flatMap((field) =>
        field.fieldId ? [[field.fieldId, field.value] as const] : [],
      ),
    );
    const valueByLabel = new Map(
      metadataFields.flatMap((field) => {
        const label = field.label.trim().toLowerCase();
        return label ? [[label, field.value] as const] : [];
      }),
    );

    setMetadataSaving(true);
    setError(null);
    try {
      const savedFields = await apiFetchBrowser<UserMetadataField[]>(
        "/scheduler/metadata-fields",
        {
          method: "PATCH",
          body: { fields: metadata },
        },
      );
      const values = Object.fromEntries(
        savedFields.map((field) => [
          field.id,
          valueByFieldId.get(field.id) ??
            valueByLabel.get(field.label.toLowerCase()) ??
            "",
        ]),
      );
      setUserMetadataFields(savedFields);
      setMetadataFields(metadataDefinitionsToFields(savedFields, values));
      setMetadataEditing(false);
    } catch (saveError) {
      setError(readErrorMessage(saveError));
    } finally {
      setMetadataSaving(false);
    }
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
    const mediaValidationError =
      action === "draft"
        ? null
        : validateSelectedMediaForPublish(composeType, mediaForSubmit);
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
    const { metadata, error: metadataError } =
      metadataFieldsToPayload(metadataFields);
    if (metadataError) {
      setError(metadataError);
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
            await apiFetchBrowser("/scheduler/events", {
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
                metadata,
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
      setMetadataFields(metadataDefinitionsToFields(userMetadataFields));
      setMetadataEditing(false);
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

  const minScheduledFor = toLocalDatetimeInputValue(new Date().toISOString());
  const previewMedia = media[0] ?? null;
  const mediaIssues = buildSelectedMediaIssues(composeType, media);
  const mediaErrorCount = mediaIssues.filter(
    (issue) => issue.severity === "error",
  ).length;
  const mediaWarningCount = mediaIssues.length - mediaErrorCount;
  const submitButtonLabel = submittingAction
    ? SUBMITTING_LABEL[submittingAction]
    : primaryAction === "post-now"
      ? "Post now"
      : "Schedule";
  const selectedAccounts = accounts.filter((account) =>
    selectedAccountIds.includes(account.id),
  );
  const hasBlockingPreviewError = selectedAccounts.length === 0;
  const scheduleDisabled =
    submitting || accountsLoading || hasBlockingPreviewError;
  const previewAccountLabel =
    selectedAccounts.length > 1
      ? `${selectedAccounts[0].username} +${selectedAccounts.length - 1}`
      : (selectedAccounts[0]?.username ?? "Preview");
  const isCarouselPreview =
    composeType === "carousel" || (composeType === "post" && media.length > 1);
  const captionCount = caption.length;
  const hashtagCount = countCaptionToken(caption, "#");
  const mentionCount = countCaptionToken(caption, "@");
  const visibleMetadataFields = metadataFields.filter(
    (field) => field.fieldId || field.label.trim() || field.value.trim(),
  );
  const hasCaption = Boolean(caption.trim());
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
        className="flex h-[min(860px,calc(100vh-16px))] w-[min(1240px,calc(100vw-16px))] flex-col overflow-hidden rounded-xl border border-line bg-paper shadow-[0_22px_60px_rgba(0,0,0,0.18)]"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex h-[60px] shrink-0 items-center justify-between border-b border-line px-5">
          <h2 className="text-base font-semibold tracking-[-0.02em] text-ink">
            Schedule a post
          </h2>
          <div className="flex items-center">
            <button
              type="button"
              aria-label="Close compose window"
              onClick={onClose}
              className="flex size-7 items-center justify-center rounded-full text-muted transition-colors hover:bg-card hover:text-ink"
            >
              <X className="size-3.5" />
            </button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1">
          <div className="flex min-w-0 flex-1 flex-col gap-4 overflow-y-auto border-r border-line px-6 py-4">
            <section>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-[11px] font-semibold text-ink">Publish to</h3>
                <span className="text-[10px] text-muted">
                  {selectedAccountIds.length} account{selectedAccountIds.length === 1 ? "" : "s"} selected
                </span>
              </div>
              <div className="relative flex flex-wrap gap-2 pb-1">
                {selectedAccounts.map((account) => (
                  <AccountChip
                    key={account.id}
                    accountId={account.id}
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
                  className="flex h-[44px] shrink-0 items-center gap-1.5 rounded-md border border-dashed border-line px-3 text-[10px] text-muted transition-colors hover:bg-card hover:text-ink"
                >
                  <Plus className="size-3" />
                  Add account
                </button>
                {accountPickerOpen ? (
                  <div className="absolute left-0 top-[52px] z-20 flex max-h-56 w-[360px] flex-col gap-2 overflow-y-auto rounded-lg border border-line bg-paper p-2 shadow-[0_14px_30px_rgba(0,0,0,0.16)]">
                    {accountsLoading ? (
                      <p className="px-2 py-3 text-xs text-muted">Loading accounts...</p>
                    ) : availableAccounts.length ? (
                      availableAccounts.map((account) => (
                        <AccountChip
                          key={account.id}
                          accountId={account.id}
                          username={account.username}
                          avatarUrl={account.avatarUrl}
                          selected={false}
                          onClick={() => addAccount(account.id)}
                        />
                      ))
                    ) : (
                      <p className="px-2 py-3 text-xs text-muted">
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
              <h3 className="mb-2 text-[11px] font-semibold text-ink">Post type</h3>
              <div className="grid grid-cols-4 gap-1.5">
                {(["post", "story", "reels", "carousel"] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={composeType === option}
                    onClick={() => setComposeType(option)}
                    className={`h-8 rounded-md border text-[11px] font-medium ${
                      composeType === option
                        ? "border-cta bg-cta/10 text-ink"
                        : "border-line bg-paper text-muted hover:bg-card hover:text-ink"
                    }`}
                  >
                    {TYPE_LABEL[option]}
                  </button>
                ))}
              </div>
            </section>

            <section>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-[11px] font-semibold text-ink">Caption</h3>
                <div className="flex items-center gap-3 text-[10px] text-muted">
                  <button
                    type="button"
                    onClick={() => insertCaptionToken("#")}
                    className="inline-flex items-center gap-1 rounded px-1.5 py-1 transition-colors hover:bg-card hover:text-ink"
                  >
                    <Hash className="size-3" />
                    Hashtag
                  </button>
                  <button
                    type="button"
                    onClick={() => insertCaptionToken("@")}
                    className="inline-flex items-center gap-1 rounded px-1.5 py-1 transition-colors hover:bg-card hover:text-ink"
                  >
                    <AtSign className="size-3" />
                    Mention
                  </button>
                </div>
              </div>
              <div className="overflow-hidden rounded-md border border-line bg-paper">
                <textarea
                  ref={captionRef}
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  maxLength={2200}
                  placeholder="Write a caption..."
                  className="h-[82px] w-full resize-none bg-transparent px-3 py-2.5 text-[11px] leading-5 text-ink placeholder:text-muted focus:outline-none"
                />
                <div className="flex min-h-7 flex-wrap items-center gap-x-3 gap-y-1 border-t border-line px-3 py-1.5 text-[9px] text-muted">
                  <span>{captionCount} / 2,200 characters</span>
                  <span>
                    {hashtagCount} hashtag{hashtagCount === 1 ? "" : "s"}
                  </span>
                  <span>
                    {mentionCount} mention{mentionCount === 1 ? "" : "s"}
                  </span>
                </div>
              </div>
            </section>

            <section>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-[11px] font-semibold text-ink">Media</h3>
                <span className="text-[10px] text-muted">
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
                  <label className="flex h-[188px] cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-line bg-paper text-muted transition-colors hover:bg-card hover:text-ink">
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
              <MediaIssueList issues={mediaIssues} />
            </section>

            <section>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-[11px] font-semibold text-ink">Metadata</h3>
                <button
                  type="button"
                  disabled={metadataSaving}
                  onClick={() =>
                    metadataEditing
                      ? void saveMetadataFields()
                      : setMetadataEditing(true)
                  }
                  className="inline-flex h-7 items-center gap-1 rounded px-1.5 text-[10px] text-muted transition-colors hover:bg-card hover:text-ink"
                >
                  {metadataEditing ? (
                    <Save className="size-3" />
                  ) : (
                    <Pencil className="size-3" />
                  )}
                  {metadataEditing
                    ? metadataSaving
                      ? "Saving..."
                      : "Save"
                    : "Edit"}
                </button>
              </div>
              {metadataEditing ? (
                <div className="flex flex-col gap-2">
                  {metadataFields.map((field) => (
                    <div
                      key={field.id}
                      className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)_32px] gap-2"
                    >
                      <input
                        value={field.label}
                        onChange={(event) =>
                          updateMetadataField(
                            field.id,
                            "label",
                            event.target.value,
                          )
                        }
                        placeholder="Label"
                        maxLength={40}
                        readOnly={field.fieldId !== null}
                        className="h-9 rounded-md border border-line bg-paper px-3 text-[11px] text-ink placeholder:text-muted focus:outline-none read-only:bg-card read-only:text-muted"
                      />
                      <input
                        value={field.value}
                        onChange={(event) =>
                          updateMetadataField(
                            field.id,
                            "value",
                            event.target.value,
                          )
                        }
                        placeholder="Value"
                        maxLength={160}
                        className="h-9 rounded-md border border-line bg-paper px-3 text-[11px] text-ink placeholder:text-muted focus:outline-none"
                      />
                      <button
                        type="button"
                        aria-label="Remove metadata field"
                        onClick={() => removeMetadataField(field.id)}
                        className="flex size-9 items-center justify-center rounded-md border border-line bg-paper text-muted transition-colors hover:bg-card hover:text-ink"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addMetadataField}
                    className="inline-flex h-8 w-fit items-center gap-1 rounded-md border border-line bg-paper px-2.5 text-[10px] font-medium text-muted transition-colors hover:bg-card hover:text-ink"
                  >
                    <Plus className="size-3" />
                    Add field
                  </button>
                </div>
              ) : visibleMetadataFields.length ? (
                <div className="grid grid-cols-1 gap-2">
                  {visibleMetadataFields.map((field) => (
                    <div
                      key={field.id}
                      className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] gap-2"
                    >
                      <div className="flex h-9 min-w-0 items-center rounded-md border border-line bg-card px-3">
                        <span className="truncate text-[10px] font-semibold text-muted">
                          {field.label || "Metadata"}
                        </span>
                      </div>
                      <input
                        value={field.value}
                        onChange={(event) =>
                          updateMetadataField(
                            field.id,
                            "value",
                            event.target.value,
                          )
                        }
                        placeholder="-"
                        maxLength={160}
                        className="h-9 min-w-0 rounded-md border border-line bg-paper px-3 text-[11px] text-ink placeholder:text-muted focus:outline-none"
                        aria-label={`${field.label || "Metadata"} value`}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setMetadataEditing(true)}
                  className="flex h-10 w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-line bg-paper text-[10px] font-medium text-muted transition-colors hover:bg-card hover:text-ink"
                >
                  <Pencil className="size-3" />
                  Add metadata
                </button>
              )}
            </section>

            <section>
              <h3 className="mb-2 text-[11px] font-semibold text-ink">Options</h3>
              <div className="flex items-center gap-3 rounded-md border border-line bg-paper px-3 py-2.5">
                <Switch
                  on={requiresApproval}
                  onToggle={() => setRequiresApproval((value) => !value)}
                />
                <span className="min-w-0">
                  <span className="block text-[11px] font-medium text-ink">
                    Wait for approval
                  </span>
                  <span className="block text-[10px] text-muted">
                    Require approval before publishing.
                  </span>
                </span>
              </div>
            </section>

            {error ? (
              <p className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-xs font-medium text-danger">
                {error}
              </p>
            ) : null}
            {accountResults.length ? (
              <div className="flex flex-col gap-2 rounded-md border border-line bg-paper p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                  Account results
                </p>
                {accountResults.map((result) => (
                  <div
                    key={result.accountId}
                    className="flex items-start justify-between gap-3 text-xs"
                  >
                    <span className="font-medium text-ink">@{result.username}</span>
                    <span className={result.ok ? "text-success" : "text-danger"}>
                      {result.ok ? "Success" : result.message}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <aside className="hidden w-[360px] shrink-0 flex-col gap-3 bg-card px-4 py-4 lg:flex">
            <div className="overflow-hidden rounded-lg border border-line bg-paper">
              <div className="flex h-[44px] items-center gap-2 px-3">
                {selectedAccounts[0] ? (
                  <AccountAvatar
                    username={selectedAccounts[0].username}
                    avatarUrl={selectedAccounts[0].avatarUrl}
                    className="size-7 rounded-full"
                    fallbackSeed={selectedAccounts[0].id}
                  />
                ) : (
                  <span className="flex size-7 items-center justify-center rounded-full bg-card text-muted">
                    <User className="size-3.5" />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[11px] font-semibold text-ink">
                    {previewAccountLabel}
                  </span>
                  <span className="block truncate text-[9px] text-muted">
                    Instagram - Sponsored
                  </span>
                </span>
                <MoreHorizontal className="size-3.5 text-muted" />
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
                <div className="flex items-center gap-3 text-ink">
                  <Heart className="size-4" />
                  <MessageCircle className="size-4" />
                  <Send className="size-4" />
                  <Bookmark className="ml-auto size-4" />
                </div>
                <p className="mt-1.5 text-[10px] font-semibold text-ink">
                  1,284 likes - {previewAccountLabel}
                </p>
                <p className="mt-1 line-clamp-2 text-[10px] leading-4 text-ink">
                  {caption || "Your caption preview will appear here as you write."}
                </p>
                <p className="mt-1.5 text-[9px] uppercase tracking-wide text-muted">
                  2 minutes ago
                </p>
              </div>
            </div>
            <div className="rounded-lg border border-line bg-paper p-3 text-[10px]">
              <p className={`flex items-center gap-2 ${hasBlockingPreviewError ? "text-danger" : "text-success"}`}>
                {hasBlockingPreviewError ? <CircleAlert className="size-3" /> : <Check className="size-3" />}
                {hasBlockingPreviewError ? "No accounts selected" : "Account selected"}
              </p>
              <p
                className={`mt-1 flex items-center gap-2 ${
                  mediaErrorCount
                    ? "text-danger"
                    : media.length
                      ? "text-success"
                      : "text-chart-4"
                }`}
              >
                {media.length && !mediaErrorCount ? (
                  <Check className="size-3" />
                ) : (
                  <CircleAlert className="size-3" />
                )}
                {mediaErrorCount
                  ? `${mediaErrorCount} media rule issue${mediaErrorCount === 1 ? "" : "s"}`
                  : media.length
                    ? mediaWarningCount
                      ? `${mediaWarningCount} media recommendation${mediaWarningCount === 1 ? "" : "s"}`
                      : "Media ready for preview"
                    : "Add media before publishing"}
              </p>
              <MediaIssueList issues={mediaIssues} compact />
              <p className={`mt-1 flex items-center gap-2 ${hasCaption ? "text-success" : "text-chart-4"}`}>
                {hasCaption ? <Check className="size-3" /> : <CircleAlert className="size-3" />}
                {hasCaption ? "Caption added" : "Add a caption"}
              </p>
              <p className={`mt-1 flex items-center gap-2 ${captionCount <= 125 ? "text-success" : "text-chart-4"}`}>
                {captionCount <= 125 ? <Check className="size-3" /> : <CircleAlert className="size-3" />}
                Caption {captionCount <= 125 ? "fits above the fold" : "may truncate in feed"}
              </p>
            </div>
          </aside>
        </div>

        <footer className="flex min-h-[64px] shrink-0 flex-wrap items-center justify-between gap-3 border-t border-line bg-paper px-6 py-3">
          <button
            type="button"
            disabled={scheduleDisabled}
            onClick={() => void handleSubmit("draft")}
            className="h-9 rounded-lg border border-line bg-paper px-4 text-[11px] font-medium text-muted transition-colors hover:bg-card hover:text-ink disabled:opacity-50"
          >
            {submittingAction === "draft" ? "Saving..." : "Save as draft"}
          </button>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <div className="relative grid h-9 w-[154px] grid-cols-2 items-center rounded-lg border border-line bg-card p-1 text-[10px]">
              <span
                aria-hidden="true"
                className={`absolute bottom-1 left-1 top-1 w-[calc(50%-4px)] rounded-md bg-ink transition-transform duration-300 ease-out ${
                  primaryAction === "schedule" ? "translate-x-full" : "translate-x-0"
                }`}
              />
              <button
                type="button"
                aria-pressed={primaryAction === "post-now"}
                onClick={() => setPrimaryAction("post-now")}
                className={`relative z-[1] h-full rounded-md transition-colors duration-300 ${
                  primaryAction === "post-now"
                    ? "font-semibold text-page"
                    : "text-muted hover:text-ink"
                }`}
              >
                Now
              </button>
              <button
                type="button"
                aria-pressed={primaryAction === "schedule"}
                onClick={() => setPrimaryAction("schedule")}
                className={`relative z-[1] h-full rounded-md transition-colors duration-300 ${
                  primaryAction === "schedule"
                    ? "font-semibold text-page"
                    : "text-muted hover:text-ink"
                }`}
              >
                Schedule
              </button>
            </div>
            <label
              onClick={showSchedulePicker}
              className={`flex h-9 cursor-pointer items-center gap-2 overflow-hidden rounded-lg bg-paper shadow-sm transition-[width,opacity,transform,border-color,padding] duration-300 ease-out ${
                primaryAction === "schedule"
                  ? "w-[214px] translate-x-0 border border-line px-3 opacity-100"
                  : "pointer-events-none w-0 translate-x-2 border border-transparent px-0 opacity-0"
              }`}
            >
              <Calendar className="size-3.5 text-muted" strokeWidth={1.8} />
              <input
                ref={scheduledForRef}
                aria-label="Scheduled date and time"
                type="datetime-local"
                value={scheduledFor}
                min={minScheduledFor}
                onChange={(e) => setScheduledFor(e.target.value)}
                className="schedule-datetime-input min-w-[170px] cursor-pointer bg-transparent text-[10px] font-medium text-ink focus:outline-none"
              />
            </label>
            <button
              type="button"
              disabled={scheduleDisabled}
              onClick={() => void handleSubmit(primaryAction)}
              className="flex h-9 min-w-[112px] items-center justify-center rounded-lg bg-ink px-5 text-[11px] font-semibold text-page transition-colors hover:opacity-90 disabled:opacity-60"
            >
              {submitButtonLabel}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
