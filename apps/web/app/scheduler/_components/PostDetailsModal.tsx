"use client";

import {
  BarChart3,
  Bookmark,
  Calendar,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Eye,
  Heart,
  ImageIcon,
  Loader2,
  MessageSquareText,
  Pencil,
  Play,
  Plus,
  Share2,
  Trash2,
  TriangleAlert,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { ApiError, apiFetchBrowser } from "@/lib/api/browser-client";
import { formatNumber } from "@/lib/format";
import {
  createMetadataField,
  metadataDefinitionsToFields,
  metadataFieldsToPayload,
  type MetadataField,
} from "@/lib/post-metadata";
import { createClient } from "@/lib/supabase/client";
import type { SchedulerPostDetail, EventStatus } from "./data";
import {
  buildInstagramMediaIssues,
  firstBlockingInstagramIssue,
  INSTAGRAM_VIDEO_MAX_SIZE,
  type InstagramMediaIssue,
  type InstagramRuleMediaItem,
} from "./instagram-media-rules";

type Props = {
  postId: string | null;
  onClose: () => void;
  onChanged: () => void;
};

type DraftUpload = {
  id: string;
  file: File;
  previewUrl: string;
  fileType: "IMAGE" | "VIDEO";
  mimeType: string;
  fileSize: number;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
};

type MediaUploadUrlResponse = {
  uploads: {
    bucket: string;
    storagePath: string;
    token: string;
  }[];
};

type MediaAssetsResponse = {
  assets: { id: string }[];
};

const STATUS_STYLE: Record<
  EventStatus,
  { label: string; bg: string; text: string; Icon: typeof CheckCircle2 }
> = {
  published: {
    label: "Published",
    bg: "bg-[#bcb1f2]",
    text: "text-[#3a2a96]",
    Icon: CheckCircle2,
  },
  scheduled: {
    label: "Scheduled",
    bg: "bg-[#78dbe8]",
    text: "text-[#104e61]",
    Icon: Clock3,
  },
  pending: {
    label: "Awaiting approval",
    bg: "bg-[#f7c852]",
    text: "text-[#7a4a00]",
    Icon: TriangleAlert,
  },
  draft: {
    label: "Draft",
    bg: "bg-[#a9afbb]",
    text: "text-[#1f2a3a]",
    Icon: Pencil,
  },
  removed: {
    label: "Removed",
    bg: "bg-card",
    text: "text-muted",
    Icon: X,
  },
};

function toLocalDatetimeInputValue(iso: string): string {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function defaultScheduleValue() {
  return toLocalDatetimeInputValue(
    new Date(Date.now() + 15 * 60 * 1000).toISOString(),
  );
}

function formatDate(value: string | null) {
  if (!value) return "Not set";
  return new Date(value).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatFileSize(bytes: number) {
  if (bytes <= 0) return "Instagram media";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatFetchedAt(value: string | null) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return date.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatCommentTime(value: string | null) {
  if (!value) return "No time";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No time";

  return date.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function mediaLimit(postType: SchedulerPostDetail["postType"]) {
  return postType === "CAROUSEL" ? 10 : 1;
}

function mediaAccept(postType: SchedulerPostDetail["postType"]) {
  if (postType === "REEL") return "video/*";
  if (postType === "STORY") return "image/*,video/*";
  if (postType === "CAROUSEL") return "image/*,video/*";
  return "image/*";
}

async function buildDraftUpload(file: File): Promise<DraftUpload> {
  const previewUrl = URL.createObjectURL(file);
  try {
    if (file.type.startsWith("image/")) {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const element = new Image();
        element.onload = () => resolve(element);
        element.onerror = () => reject(new Error("Could not read image"));
        element.src = previewUrl;
      });
      return {
        id: crypto.randomUUID(),
        file,
        previewUrl,
        fileType: "IMAGE",
        mimeType: file.type,
        fileSize: file.size,
        width: image.naturalWidth,
        height: image.naturalHeight,
        durationSeconds: null,
      };
    }

    const dimensions = await new Promise<{
      width: number;
      height: number;
      durationSeconds: number | null;
    }>((resolve, reject) => {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.onloadedmetadata = () =>
        resolve({
          width: video.videoWidth,
          height: video.videoHeight,
          durationSeconds: Number.isFinite(video.duration)
            ? Math.max(1, Math.round(video.duration))
            : null,
        });
      video.onerror = () => reject(new Error("Could not read video"));
      video.src = previewUrl;
    });
    return {
      id: crypto.randomUUID(),
      file,
      previewUrl,
      fileType: "VIDEO",
      mimeType: file.type,
      fileSize: file.size,
      ...dimensions,
    };
  } catch (error) {
    URL.revokeObjectURL(previewUrl);
    throw error;
  }
}

function validateDraftFiles(
  postType: SchedulerPostDetail["postType"],
  files: File[],
  totalCount: number,
) {
  if (totalCount > mediaLimit(postType)) {
    return postType === "CAROUSEL"
      ? "Carousel posts can contain up to 10 media files."
      : "This post type supports one media file.";
  }
  if (files.some((file) => file.size > INSTAGRAM_VIDEO_MAX_SIZE)) {
    return "Each media file must be 300 MB or smaller.";
  }
  if (
    files.some(
      (file) =>
        !file.type.startsWith("image/") && !file.type.startsWith("video/"),
    )
  ) {
    return "Only image and video files are supported.";
  }
  if (
    postType === "FEED" &&
    files.some((file) => !file.type.startsWith("image/"))
  ) {
    return "Feed posts support images only.";
  }
  if (
    postType === "REEL" &&
    files.some((file) => !file.type.startsWith("video/"))
  ) {
    return "Reels require a video file.";
  }
  return null;
}

function buildDetailMediaIssues(
  postType: SchedulerPostDetail["postType"],
  items: (SchedulerPostDetail["media"][number] | DraftUpload)[],
  options: { forPublish?: boolean } = {},
) {
  return buildInstagramMediaIssues(
    postType,
    items.map(detailMediaToRuleItem),
    options,
  );
}

function validateDetailMediaForPublish(
  postType: SchedulerPostDetail["postType"],
  items: (SchedulerPostDetail["media"][number] | DraftUpload)[],
) {
  return firstBlockingInstagramIssue(
    postType,
    items.map(detailMediaToRuleItem),
    { forPublish: true },
  )?.message ?? null;
}

function detailMediaToRuleItem(
  item: SchedulerPostDetail["media"][number] | DraftUpload,
): InstagramRuleMediaItem {
  return {
    id: item.id,
    fileType: item.fileType,
    mimeType: item.mimeType,
    fileSize: item.fileSize,
    width: item.width,
    height: item.height,
    durationSeconds: item.durationSeconds,
  };
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
  return "Could not complete this action.";
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line py-2 text-sm last:border-b-0">
      <span className="text-muted">{label}</span>
      <span className="text-right font-medium text-ink">{value}</span>
    </div>
  );
}

function MediaIssueList({ issues }: { issues: InstagramMediaIssue[] }) {
  if (!issues.length) return null;

  return (
    <div className="mt-3 rounded-lg border border-line bg-card p-3 text-xs">
      <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.05em] text-muted">
        Instagram media checks
      </p>
      <div className="flex flex-col gap-1.5">
        {issues.slice(0, 4).map((issue) => (
          <p
            key={issue.key}
            className={`flex items-start gap-2 leading-5 ${
              issue.severity === "error" ? "text-danger" : "text-[#a57630]"
            }`}
          >
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
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

function PerformanceTile({
  label,
  value,
  Icon,
}: {
  label: string;
  value: number | null;
  Icon: typeof Eye;
}) {
  return (
    <div className="flex h-[72px] min-w-0 flex-col justify-between rounded-lg border border-line bg-card px-3 py-2.5">
      <span className="flex min-w-0 items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.05em] text-muted">
        <Icon className="size-3.5 shrink-0" strokeWidth={1.8} />
        <span className="truncate">{label}</span>
      </span>
      <span className="truncate font-mono text-[22px] leading-none text-ink">
        {formatNumber(value)}
      </span>
    </div>
  );
}

function commentStatusLabel(
  status: SchedulerPostDetail["comments"]["status"],
) {
  if (status === "synced") return "Synced";
  if (status === "cached") return "Cached";
  if (status === "unavailable") return "Needs access";
  return "No Instagram media";
}

function commentAuthorInitial(username: string | null) {
  return (username?.trim().charAt(0) || "?").toUpperCase();
}

function mediaPreviewUrl(item: SchedulerPostDetail["media"][number] | DraftUpload) {
  return "thumbnailUrl" in item
    ? (item.thumbnailUrl ?? item.previewUrl)
    : item.previewUrl;
}

function mediaSourceUrl(item: SchedulerPostDetail["media"][number] | DraftUpload) {
  return "sourceUrl" in item ? (item.sourceUrl ?? item.previewUrl) : item.previewUrl;
}

function StatusBadge({ status }: { status: EventStatus }) {
  const style = STATUS_STYLE[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${style.bg} ${style.text}`}
    >
      <style.Icon className="size-3.5" strokeWidth={2.2} />
      {style.label}
    </span>
  );
}

export function PostDetailsModal({ postId, onClose, onChanged }: Props) {
  const [post, setPost] = useState<SchedulerPostDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [metadataFields, setMetadataFields] = useState<MetadataField[]>(() => [
    createMetadataField(),
  ]);
  const [scheduledFor, setScheduledFor] = useState(defaultScheduleValue);
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [attachedMedia, setAttachedMedia] = useState<
    SchedulerPostDetail["media"]
  >([]);
  const [draftUploads, setDraftUploads] = useState<DraftUpload[]>([]);

  useEffect(() => {
    if (!postId) return;
    let active = true;
    setPost(null);
    setError(null);
    setNotice(null);
    setLoading(true);

    apiFetchBrowser<SchedulerPostDetail>(`/scheduler/posts/${postId}`)
      .then((result) => {
        if (!active) return;
        setPost(result);
        setCaption(result.caption ?? "");
        setMetadataFields(
          metadataDefinitionsToFields(result.metadataFields, result.metadata),
        );
        setAttachedMedia(result.media);
        setDraftUploads((current) => {
          current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
          return [];
        });
        setScheduledFor(
          result.scheduledFor
            ? toLocalDatetimeInputValue(result.scheduledFor)
            : defaultScheduleValue(),
        );
        setRequiresApproval(false);
      })
      .catch((fetchError) => {
        if (active) setError(readErrorMessage(fetchError));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [postId]);

  useEffect(() => {
    if (!postId) return;
    const previousOverflow = document.body.style.overflow;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [postId, onClose]);

  useEffect(
    () => () => {
      draftUploads.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    },
    [draftUploads],
  );

  if (!postId) return null;

  async function approve() {
    if (!post) return;
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      const updated = await apiFetchBrowser<SchedulerPostDetail>(
        `/scheduler/posts/${post.id}/approve`,
        { method: "POST" },
      );
      setPost(updated);
      setNotice("Post approved and queued for publishing.");
      onChanged();
    } catch (submitError) {
      setError(readErrorMessage(submitError));
    } finally {
      setSubmitting(false);
    }
  }

  async function updateDraft(action: "DRAFT" | "SCHEDULE") {
    if (!post) return;
    const { metadata, error: metadataError } =
      metadataFieldsToPayload(metadataFields);
    if (metadataError) {
      setError(metadataError);
      return;
    }
    let scheduleIso: string | undefined;
    if (action === "SCHEDULE") {
      const mediaError = validateDetailMediaForPublish(
        post.postType,
        shownMedia,
      );
      if (mediaError) {
        setError(mediaError);
        return;
      }
      const date = new Date(scheduledFor);
      if (Number.isNaN(date.getTime()) || date <= new Date()) {
        setError("Pick a future schedule time.");
        return;
      }
      scheduleIso = date.toISOString();
    }

    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      const addedMediaAssetIds = await uploadDraftMedia();
      const updated = await apiFetchBrowser<SchedulerPostDetail>(
        `/scheduler/posts/${post.id}/draft`,
        {
          method: "PATCH",
          body: {
            action,
            caption,
            metadata,
            scheduledFor: scheduleIso,
            requiresApproval,
            mediaAssetIds: [
              ...attachedMedia.map((item) => item.id),
              ...addedMediaAssetIds,
            ],
          },
        },
      );
      setPost(updated);
      setMetadataFields(
        metadataDefinitionsToFields(updated.metadataFields, updated.metadata),
      );
      setAttachedMedia(updated.media);
      setDraftUploads([]);
      setNotice(
        action === "SCHEDULE"
          ? "Draft scheduled successfully."
          : "Draft saved.",
      );
      onChanged();
    } catch (submitError) {
      setError(readErrorMessage(submitError));
    } finally {
      setSubmitting(false);
    }
  }

  const isDraft = post?.status === "draft";
  const isScheduled = post?.status === "scheduled";
  const canManageScheduled =
    isScheduled && post?.latestFailure?.retryable !== false;
  const isEditable = isDraft || canManageScheduled;
  const shownMedia = isDraft
    ? [...attachedMedia, ...draftUploads]
    : (post?.media ?? []);
  const mediaIssues = post ? buildDetailMediaIssues(post.postType, shownMedia) : [];
  const analyticsUpdatedAt = post?.analytics
    ? formatFetchedAt(post.analytics.fetchedAt)
    : null;
  const commentItems = post?.comments.items ?? [];
  const commentsSyncedAt = post?.comments.syncedAt
    ? formatFetchedAt(post.comments.syncedAt)
    : null;
  const commentsTotal =
    post?.analytics?.comments ?? (post?.comments.syncedAt ? commentItems.length : null);

  function updateMetadataField(
    id: string,
    field: "label" | "value",
    value: string,
  ) {
    setMetadataFields((current) =>
      current.map((item) =>
        item.id === id ? { ...item, [field]: value } : item,
      ),
    );
  }

  function addMetadataField() {
    setMetadataFields((current) => [...current, createMetadataField()]);
  }

  function removeMetadataField(id: string) {
    setMetadataFields((current) => {
      const next = current.filter((item) => item.id !== id);
      return next.length ? next : [createMetadataField()];
    });
  }

  async function addDraftMedia(files: FileList | null) {
    if (!files || !post) return;
    setError(null);
    const nextFiles = Array.from(files);
    const fileError = validateDraftFiles(
      post.postType,
      nextFiles,
      shownMedia.length + nextFiles.length,
    );
    if (fileError) {
      setError(fileError);
      return;
    }

    try {
      const prepared = await Promise.all(nextFiles.map(buildDraftUpload));
      setDraftUploads((current) => [...current, ...prepared]);
    } catch {
      setError("Could not read media details.");
    }
  }

  async function uploadDraftMedia() {
    if (draftUploads.length === 0) return [];

    const uploadIntent = await apiFetchBrowser<MediaUploadUrlResponse>(
      "/media/upload-urls",
      {
        method: "POST",
        body: {
          files: draftUploads.map((item) => ({
            name: item.file.name,
            mimeType: item.mimeType,
            fileSize: item.fileSize,
          })),
        },
      },
    );
    const supabase = createClient();
    await Promise.all(
      draftUploads.map(async (item, index) => {
        const upload = uploadIntent.uploads[index];
        const { error: uploadError } = await supabase.storage
          .from(upload.bucket)
          .uploadToSignedUrl(upload.storagePath, upload.token, item.file, {
            contentType: item.mimeType,
          });
        if (uploadError) throw uploadError;
      }),
    );
    const completed = await apiFetchBrowser<MediaAssetsResponse>(
      "/media/assets",
      {
        method: "POST",
        body: {
          files: draftUploads.map((item, index) => ({
            storagePath: uploadIntent.uploads[index].storagePath,
            mimeType: item.mimeType,
            fileSize: item.fileSize,
            width: item.width ?? undefined,
            height: item.height ?? undefined,
            durationSeconds: item.durationSeconds ?? undefined,
          })),
        },
      },
    );
    return completed.assets.map((item) => item.id);
  }

  function removeMedia(mediaId: string) {
    const upload = draftUploads.find((item) => item.id === mediaId);
    if (upload) {
      URL.revokeObjectURL(upload.previewUrl);
      setDraftUploads((current) =>
        current.filter((item) => item.id !== mediaId),
      );
      return;
    }
    setAttachedMedia((current) =>
      current.filter((item) => item.id !== mediaId),
    );
  }

  async function updateScheduledPost() {
    if (!post) return;
    const { metadata, error: metadataError } =
      metadataFieldsToPayload(metadataFields);
    if (metadataError) {
      setError(metadataError);
      return;
    }
    const date = new Date(scheduledFor);
    if (Number.isNaN(date.getTime()) || date <= new Date()) {
      setError("Pick a future schedule time.");
      return;
    }
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      const updated = await apiFetchBrowser<SchedulerPostDetail>(
        `/scheduler/posts/${post.id}/scheduled`,
        {
          method: "PATCH",
          body: {
            caption,
            metadata,
            scheduledFor: date.toISOString(),
          },
        },
      );
      setPost(updated);
      setMetadataFields(
        metadataDefinitionsToFields(updated.metadataFields, updated.metadata),
      );
      setNotice("Scheduled post updated.");
      onChanged();
    } catch (submitError) {
      setError(readErrorMessage(submitError));
    } finally {
      setSubmitting(false);
    }
  }

  async function saveMetadata() {
    if (!post) return;
    const { metadata, error: metadataError } =
      metadataFieldsToPayload(metadataFields);
    if (metadataError) {
      setError(metadataError);
      return;
    }

    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      const updated = await apiFetchBrowser<SchedulerPostDetail>(
        `/scheduler/posts/${post.id}/metadata`,
        {
          method: "PATCH",
          body: { metadata },
        },
      );
      setPost(updated);
      setMetadataFields(
        metadataDefinitionsToFields(updated.metadataFields, updated.metadata),
      );
      setNotice("Metadata saved.");
      onChanged();
    } catch (submitError) {
      setError(readErrorMessage(submitError));
    } finally {
      setSubmitting(false);
    }
  }

  async function deletePost() {
    if (!post) return;
    const confirmed = window.confirm(
      "Delete this post? This action cannot be undone.",
    );
    if (!confirmed) return;
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      await apiFetchBrowser(`/scheduler/posts/${post.id}`, { method: "DELETE" });
      onChanged();
      onClose();
    } catch (submitError) {
      setError(readErrorMessage(submitError));
    } finally {
      setSubmitting(false);
    }
  }

  async function retryPublish() {
    if (!post) return;
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      const updated = await apiFetchBrowser<SchedulerPostDetail>(
        `/scheduler/posts/${post.id}/retry`,
        { method: "POST" },
      );
      setPost(updated);
      setNotice("Retry queued. Refresh after the worker processes it.");
      onChanged();
    } catch (submitError) {
      setError(readErrorMessage(submitError));
    } finally {
      setSubmitting(false);
    }
  }

  const metadataEditor = (
    <div className="rounded-xl border border-line bg-card p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold text-ink">Metadata</h3>
        <div className="flex shrink-0 items-center gap-1">
          {!isEditable ? (
            <button
              type="button"
              disabled={submitting}
              onClick={() => void saveMetadata()}
              className="inline-flex h-7 items-center rounded-md bg-cta px-2 text-xs font-semibold text-paper disabled:opacity-60"
            >
              {submitting ? "Saving..." : "Save"}
            </button>
          ) : null}
          <button
            type="button"
            onClick={addMetadataField}
            className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-semibold text-muted hover:bg-paper"
          >
            <Plus className="size-3" />
            Add field
          </button>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        {metadataFields.map((field) => (
          <div
            key={field.id}
            className="grid grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)_34px] gap-2"
          >
            <input
              value={field.label}
              onChange={(event) =>
                updateMetadataField(field.id, "label", event.target.value)
              }
              placeholder="Label"
              maxLength={40}
              readOnly={field.fieldId !== null}
              className="h-9 rounded-lg border border-line bg-paper px-3 text-xs text-ink placeholder:text-muted focus:outline-none read-only:bg-card read-only:text-muted"
            />
            <input
              value={field.value}
              onChange={(event) =>
                updateMetadataField(field.id, "value", event.target.value)
              }
              placeholder="Value"
              maxLength={160}
              className="h-9 rounded-lg border border-line bg-paper px-3 text-xs text-ink placeholder:text-muted focus:outline-none"
            />
            <button
              type="button"
              aria-label="Remove metadata field"
              onClick={() => removeMetadataField(field.id)}
              className="flex size-[34px] items-center justify-center rounded-lg border border-line bg-paper text-muted hover:bg-card"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Post details"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/55 p-3 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[calc(100vh-24px)] w-full max-w-5xl flex-col overflow-hidden rounded-[10px] border border-line bg-paper shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div className="flex min-w-0 flex-col gap-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-muted">
              Post details
            </p>
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h2 className="line-clamp-2 text-lg font-semibold leading-6 text-ink">
                {post?.caption || "Post details"}
              </h2>
              {post ? <StatusBadge status={post.status} /> : null}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close post details"
            className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted transition hover:bg-card hover:text-ink"
          >
            <X className="size-5" strokeWidth={1.8} />
          </button>
        </header>

        {loading ? (
          <div className="flex h-64 items-center justify-center gap-2 text-sm font-medium text-muted">
            <Loader2 className="size-5 animate-spin" />
            Loading post...
          </div>
        ) : post ? (
          <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto md:grid-cols-[1.05fr_0.95fr]">
            <section className="flex flex-col gap-5 border-b border-line p-7 md:border-b-0 md:border-r">
              {isEditable ? (
                <>
                  <textarea
                    value={caption}
                    onChange={(event) => setCaption(event.target.value)}
                    placeholder="Write a caption"
                    maxLength={2200}
                    className="min-h-28 resize-none rounded-xl border border-line bg-card p-3 text-sm text-ink placeholder:text-muted focus:border-cta-edge focus:outline-none"
                  />
                  {metadataEditor}
                </>
              ) : (
                <>
                  <p className="whitespace-pre-wrap rounded-xl bg-card p-4 text-sm leading-6 text-ink">
                    {post.caption || "No caption"}
                  </p>
                  {metadataEditor}
                </>
              )}

              <div>
                <h3 className="mb-3 text-sm font-semibold text-ink">Media</h3>
                {shownMedia.length ? (
                  <div className="grid grid-cols-2 gap-3">
                    {shownMedia.map((item) => {
                      const previewUrl = mediaPreviewUrl(item);
                      const sourceUrl = mediaSourceUrl(item);
                      const imageUrl = previewUrl ?? sourceUrl;

                      return (
                        <div
                          key={item.id}
                          className="group relative overflow-hidden rounded-lg border border-line bg-card"
                        >
                          <div className="relative flex aspect-square items-center justify-center overflow-hidden bg-[#495057]">
                            {item.fileType === "IMAGE" && imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={imageUrl}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            ) : item.fileType === "VIDEO" && sourceUrl ? (
                              <>
                                <video
                                  src={sourceUrl}
                                  poster={previewUrl ?? undefined}
                                  className="h-full w-full object-cover"
                                  muted
                                  playsInline
                                />
                                <Play className="absolute size-9 fill-current text-paper" />
                              </>
                            ) : item.fileType === "VIDEO" && imageUrl ? (
                              <>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={imageUrl}
                                  alt=""
                                  className="h-full w-full object-cover"
                                />
                                <Play className="absolute size-9 fill-current text-paper" />
                              </>
                            ) : (
                              <ImageIcon className="size-10 text-paper/70" />
                            )}
                          </div>
                          <p className="px-3 pt-2 text-xs font-semibold text-ink">
                            {item.fileType === "IMAGE" ? "Image" : "Video"} -{" "}
                            {formatFileSize(item.fileSize)}
                          </p>
                          <p className="px-3 pb-2 text-[11px] text-muted">
                            {item.width && item.height
                              ? `${item.width} x ${item.height}`
                              : item.mimeType}
                          </p>
                          {isDraft ? (
                            <button
                              type="button"
                              aria-label="Remove media"
                              onClick={() => removeMedia(item.id)}
                              className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full bg-ink/75 text-paper opacity-0 transition group-hover:opacity-100"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-line bg-card px-4 py-8 text-center text-sm text-muted">
                    No media attached.
                  </div>
                )}
                {isDraft && shownMedia.length < mediaLimit(post.postType) ? (
                  <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-muted bg-card px-4 py-3 text-sm font-semibold text-muted hover:border-cta-edge">
                    <Upload className="size-4" />
                    Add media
                    <input
                      type="file"
                      accept={mediaAccept(post.postType)}
                      multiple={post.postType === "CAROUSEL"}
                      className="sr-only"
                      onChange={(event) => {
                        void addDraftMedia(event.target.files);
                        event.target.value = "";
                      }}
                    />
                  </label>
                ) : null}
                <MediaIssueList issues={mediaIssues} />
              </div>
            </section>

            <section className="flex flex-col gap-5 p-7">
              <div>
                <h3 className="mb-2 text-sm font-semibold text-ink">
                  Information
                </h3>
                <DetailRow label="Account" value={`@${post.accountUsername}`} />
                <DetailRow label="Format" value={post.postType} />
                <DetailRow label="Created" value={formatDate(post.createdAt)} />
                <DetailRow
                  label="Scheduled"
                  value={formatDate(post.scheduledFor)}
                />
                <DetailRow
                  label="Published"
                  value={formatDate(post.publishedAt)}
                />
              </div>

              {post.permalink ? (
                <a
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-ink px-4 text-sm font-semibold text-page transition hover:opacity-90"
                  href={post.permalink}
                  rel="noreferrer"
                  target="_blank"
                >
                  <ExternalLink className="size-4" strokeWidth={1.8} />
                  Open Instagram
                </a>
              ) : null}

              {post.analytics ? (
                <div className="rounded-lg border border-line bg-paper p-4">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-ink">
                        Performance
                      </h3>
                      {analyticsUpdatedAt ? (
                        <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.05em] text-muted">
                          Synced {analyticsUpdatedAt}
                        </p>
                      ) : null}
                    </div>
                    <BarChart3 className="size-4 text-muted" strokeWidth={1.8} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <PerformanceTile
                      label="Views"
                      value={post.analytics.views}
                      Icon={Eye}
                    />
                    <PerformanceTile
                      label="Reach"
                      value={post.analytics.reach}
                      Icon={BarChart3}
                    />
                    <PerformanceTile
                      label="Likes"
                      value={post.analytics.likes}
                      Icon={Heart}
                    />
                    <PerformanceTile
                      label="Comments"
                      value={post.analytics.comments}
                      Icon={MessageSquareText}
                    />
                    <PerformanceTile
                      label="Shares"
                      value={post.analytics.shares}
                      Icon={Share2}
                    />
                    <PerformanceTile
                      label="Saves"
                      value={post.analytics.saves}
                      Icon={Bookmark}
                    />
                  </div>
                </div>
              ) : null}

              <div className="rounded-lg border border-line bg-card p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-ink">
                      Comments
                    </h3>
                    {commentsSyncedAt ? (
                      <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.05em] text-muted">
                        Synced {commentsSyncedAt}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="rounded border border-line bg-paper px-2 py-1 font-mono text-[10px] uppercase tracking-[0.05em] text-muted">
                      {formatNumber(commentsTotal)} total
                    </span>
                    <span className="font-mono text-[9px] uppercase tracking-[0.05em] text-muted">
                      {commentStatusLabel(post.comments.status)}
                    </span>
                  </div>
                </div>
                {commentItems.length ? (
                  <div className="mt-4 flex max-h-72 flex-col gap-3 overflow-y-auto pr-1">
                    {commentItems.map((comment) => (
                      <article
                        key={comment.id}
                        className="rounded-lg border border-line bg-paper p-3"
                      >
                        <div className="flex items-start gap-3">
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-ink font-mono text-xs font-semibold text-page">
                            {commentAuthorInitial(comment.username)}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                              <p className="truncate text-sm font-semibold text-ink">
                                {comment.username
                                  ? `@${comment.username}`
                                  : "Instagram user"}
                              </p>
                              <span className="font-mono text-[10px] uppercase tracking-[0.04em] text-muted">
                                {formatCommentTime(comment.timestamp)}
                              </span>
                              {comment.parentInstagramCommentId ? (
                                <span className="rounded border border-line px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.04em] text-muted">
                                  Reply
                                </span>
                              ) : null}
                              {comment.hidden ? (
                                <span className="rounded border border-line px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.04em] text-muted">
                                  Hidden
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-2 whitespace-pre-wrap text-sm leading-5 text-ink">
                              {comment.text || "No comment text"}
                            </p>
                            {comment.likeCount !== null ? (
                              <p className="mt-2 inline-flex items-center gap-1 font-mono text-[10px] text-muted">
                                <Heart className="size-3" strokeWidth={1.8} />
                                {formatNumber(comment.likeCount)}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-sm leading-6 text-muted">
                    {post.comments.errorMessage ??
                      (post.comments.status === "synced"
                        ? "No comments found for this post."
                        : "Comments will appear here after this post is published and the Instagram account has comment access.")}
                  </p>
                )}
                {post.comments.errorMessage && commentItems.length ? (
                  <p className="mt-3 rounded-lg bg-[#fff8e8] px-3 py-2 text-xs font-medium text-muted">
                    {post.comments.errorMessage}
                  </p>
                ) : null}
              </div>

              {isDraft ? (
                <div className="flex flex-col gap-4 rounded-xl border border-line bg-card p-4">
                  <p className="text-sm font-semibold text-ink">
                    Finish this draft
                  </p>
                  <label className="flex flex-col gap-1 text-xs font-medium text-muted">
                    Schedule time
                    <span className="flex h-10 items-center gap-2 rounded-lg border border-line bg-paper px-3">
                      <Calendar className="size-4" />
                      <input
                        type="datetime-local"
                        value={scheduledFor}
                        min={toLocalDatetimeInputValue(
                          new Date().toISOString(),
                        )}
                        onChange={(event) =>
                          setScheduledFor(event.target.value)
                        }
                        className="min-w-0 flex-1 bg-transparent text-sm text-ink focus:outline-none"
                      />
                    </span>
                  </label>
                  <label className="flex items-center justify-between gap-4 text-sm text-ink">
                    Require approval
                    <input
                      type="checkbox"
                      checked={requiresApproval}
                      onChange={(event) =>
                        setRequiresApproval(event.target.checked)
                      }
                      className="size-4 accent-[#1d6b81]"
                    />
                  </label>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => void updateDraft("DRAFT")}
                      className="flex-1 rounded-lg border border-line bg-paper px-4 py-2 text-sm font-semibold text-ink disabled:opacity-60"
                    >
                      Save Draft
                    </button>
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => void updateDraft("SCHEDULE")}
                      className="flex-1 rounded-lg bg-cta px-4 py-2 text-sm font-semibold text-paper disabled:opacity-60"
                    >
                      Schedule
                    </button>
                  </div>
                </div>
              ) : null}

              {canManageScheduled ? (
                <div className="flex flex-col gap-4 rounded-xl border border-line bg-card p-4">
                  <p className="text-sm font-semibold text-ink">
                    Manage scheduled post
                  </p>
                  <label className="flex flex-col gap-1 text-xs font-medium text-muted">
                    Schedule time
                    <span className="flex h-10 items-center gap-2 rounded-lg border border-line bg-paper px-3">
                      <Calendar className="size-4" />
                      <input
                        type="datetime-local"
                        value={scheduledFor}
                        min={toLocalDatetimeInputValue(
                          new Date().toISOString(),
                        )}
                        onChange={(event) =>
                          setScheduledFor(event.target.value)
                        }
                        className="min-w-0 flex-1 bg-transparent text-sm text-ink focus:outline-none"
                      />
                    </span>
                  </label>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => void deletePost()}
                      className="flex-1 rounded-lg border border-red-200 bg-paper px-4 py-2 text-sm font-semibold text-danger disabled:opacity-60"
                    >
                      Delete
                    </button>
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => void updateScheduledPost()}
                      className="flex-1 rounded-lg bg-cta px-4 py-2 text-sm font-semibold text-paper disabled:opacity-60"
                    >
                      Save Changes
                    </button>
                  </div>
                </div>
              ) : null}

              {post.status === "pending" ? (
                <div className="rounded-xl border border-[#f7c852] bg-[#fff8e8] p-4">
                  <p className="text-sm font-semibold text-ink">
                    This post is waiting for approval.
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    Approving it queues publishing for its scheduled time.
                  </p>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => void approve()}
                    className="mt-4 w-full rounded-lg bg-cta px-4 py-2.5 text-sm font-semibold text-paper disabled:opacity-60"
                  >
                    {submitting ? "Approving..." : "Approve Post"}
                  </button>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => void deletePost()}
                    className="mt-2 w-full rounded-lg border border-red-200 bg-paper px-4 py-2.5 text-sm font-semibold text-danger disabled:opacity-60"
                  >
                    Delete Post
                  </button>
                </div>
              ) : null}

              {isDraft ? (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => void deletePost()}
                  className="rounded-lg border border-red-200 bg-paper px-4 py-2 text-sm font-semibold text-danger disabled:opacity-60"
                >
                  Delete Draft
                </button>
              ) : null}

              {post.latestFailure ? (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                  <p className="text-sm font-semibold text-danger">
                    {post.latestFailure.retryable
                      ? "Publishing failed"
                      : "Publishing needs confirmation"}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    Attempt {post.latestFailure.attemptNumber}:{" "}
                    {post.latestFailure.errorMessage || "Unknown publish error"}
                  </p>
                  {post.latestFailure.retryable ? (
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => void retryPublish()}
                      className="mt-4 w-full rounded-lg bg-cta px-4 py-2.5 text-sm font-semibold text-paper disabled:opacity-60"
                    >
                      {submitting ? "Queueing..." : "Retry Publish"}
                    </button>
                  ) : (
                    <p className="mt-3 text-xs font-medium text-danger">
                      Check Instagram before creating or publishing this content
                      again.
                    </p>
                  )}
                </div>
              ) : null}

              {notice ? (
                <p className="rounded-lg bg-[#e6f7fa] px-3 py-2 text-sm font-medium text-ink">
                  {notice}
                </p>
              ) : null}
              {error ? (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-danger">
                  {error}
                </p>
              ) : null}
            </section>
          </div>
        ) : (
          <div className="flex h-64 flex-col items-center justify-center gap-3 text-sm text-muted">
            <p>{error || "Could not load post details."}</p>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-line px-4 py-2 font-semibold text-ink"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
