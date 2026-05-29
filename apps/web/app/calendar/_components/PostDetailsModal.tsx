"use client";

import {
  Calendar,
  CheckCircle2,
  Clock3,
  ImageIcon,
  Loader2,
  Pencil,
  Play,
  Plus,
  Trash2,
  TriangleAlert,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { ApiError, apiFetchBrowser } from "@/lib/api/browser-client";
import {
  createMetadataField,
  metadataDefinitionsToFields,
  metadataFieldsToPayload,
  type MetadataField,
} from "@/lib/post-metadata";
import { createClient } from "@/lib/supabase/client";
import type { CalendarPostDetail, EventStatus } from "./data";

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

const MAX_MEDIA_SIZE = 100 * 1024 * 1024;
const FEED_IMAGE_MIN_ASPECT = 4 / 5;
const FEED_IMAGE_MAX_ASPECT = 1.91;

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
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function mediaLimit(postType: CalendarPostDetail["postType"]) {
  return postType === "CAROUSEL" ? 10 : 1;
}

function mediaAccept(postType: CalendarPostDetail["postType"]) {
  if (postType === "REEL") return "video/*";
  if (postType === "STORY") return "image/*,video/*";
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
  postType: CalendarPostDetail["postType"],
  files: File[],
  totalCount: number,
) {
  if (totalCount > mediaLimit(postType)) {
    return postType === "CAROUSEL"
      ? "Carousel posts can contain up to 10 images."
      : "This post type supports one media file.";
  }
  if (files.some((file) => file.size > MAX_MEDIA_SIZE)) {
    return "Each media file must be 100 MB or smaller.";
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
    (postType === "FEED" || postType === "CAROUSEL") &&
    files.some((file) => !file.type.startsWith("image/"))
  ) {
    return "Feed posts and carousels support images only.";
  }
  if (
    postType === "REEL" &&
    files.some((file) => !file.type.startsWith("video/"))
  ) {
    return "Reels require a video file.";
  }
  return null;
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
  const [post, setPost] = useState<CalendarPostDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [metadataFields, setMetadataFields] = useState<MetadataField[]>(() => [
    createMetadataField(),
  ]);
  const [scheduledFor, setScheduledFor] = useState(defaultScheduleValue);
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [attachedMedia, setAttachedMedia] = useState<
    CalendarPostDetail["media"]
  >([]);
  const [draftUploads, setDraftUploads] = useState<DraftUpload[]>([]);

  useEffect(() => {
    if (!postId) return;
    let active = true;
    setPost(null);
    setError(null);
    setNotice(null);
    setLoading(true);

    apiFetchBrowser<CalendarPostDetail>(`/calendar/posts/${postId}`)
      .then((result) => {
        if (!active) return;
        setPost(result);
        setTitle(result.title ?? "");
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
      const updated = await apiFetchBrowser<CalendarPostDetail>(
        `/calendar/posts/${post.id}/approve`,
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
      const updated = await apiFetchBrowser<CalendarPostDetail>(
        `/calendar/posts/${post.id}/draft`,
        {
          method: "PATCH",
          body: {
            action,
            title,
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
  const metadataEntries =
    post?.metadataFields
      .map((field) => [field.label, post.metadata[field.id]] as const)
      .filter(([, value]) => Boolean(value)) ?? [];

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
      const invalidImage = prepared.find((item) => {
        if (
          (post.postType !== "FEED" && post.postType !== "CAROUSEL") ||
          item.fileType !== "IMAGE" ||
          !item.width ||
          !item.height
        ) {
          return false;
        }
        const aspect = item.width / item.height;
        return aspect < FEED_IMAGE_MIN_ASPECT || aspect > FEED_IMAGE_MAX_ASPECT;
      });
      if (invalidImage) {
        prepared.forEach((item) => URL.revokeObjectURL(item.previewUrl));
        setError("Feed images must be between 4:5 and 1.91:1.");
        return;
      }
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
      const updated = await apiFetchBrowser<CalendarPostDetail>(
        `/calendar/posts/${post.id}/scheduled`,
        {
          method: "PATCH",
          body: {
            title,
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
      await apiFetchBrowser(`/calendar/posts/${post.id}`, { method: "DELETE" });
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
      const updated = await apiFetchBrowser<CalendarPostDetail>(
        `/calendar/posts/${post.id}/retry`,
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

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Post details"
      className="fixed inset-0 z-50 flex items-center justify-center p-3"
      style={{ backgroundColor: "rgba(89, 89, 89, 0.8)" }}
      onClick={onClose}
    >
      <div
        className="flex max-h-[calc(100vh-24px)] w-[940px] max-w-[calc(100vw-24px)] flex-col overflow-hidden rounded-3xl border border-line bg-paper shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex shrink-0 items-center justify-between border-b border-line px-7 py-5">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold text-ink">Post Details</h2>
            {post ? <StatusBadge status={post.status} /> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close post details"
            className="flex size-8 items-center justify-center rounded-full text-muted hover:bg-card"
          >
            <X className="size-5" strokeWidth={2} />
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
                  <input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="Post title"
                    maxLength={200}
                    className="h-11 border-b border-line bg-transparent text-lg font-semibold text-ink placeholder:text-muted focus:outline-none"
                  />
                  <textarea
                    value={caption}
                    onChange={(event) => setCaption(event.target.value)}
                    placeholder="Write a caption"
                    maxLength={2200}
                    className="min-h-28 resize-none rounded-xl border border-line bg-card p-3 text-sm text-ink placeholder:text-muted focus:border-cta-edge focus:outline-none"
                  />
                  <div className="rounded-xl border border-line bg-card p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="text-xs font-semibold text-ink">
                        Metadata
                      </h3>
                      <button
                        type="button"
                        onClick={addMetadataField}
                        className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-semibold text-muted hover:bg-paper"
                      >
                        <Plus className="size-3" />
                        Add field
                      </button>
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
                              updateMetadataField(
                                field.id,
                                "label",
                                event.target.value,
                              )
                            }
                            placeholder="Label"
                            maxLength={40}
                            readOnly={field.fieldId !== null}
                            className="h-9 rounded-lg border border-line bg-paper px-3 text-xs text-ink placeholder:text-muted focus:outline-none read-only:bg-card read-only:text-muted"
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
                </>
              ) : (
                <>
                  <h3 className="text-lg font-semibold text-ink">
                    {post.title || "Untitled post"}
                  </h3>
                  <p className="whitespace-pre-wrap rounded-xl bg-card p-4 text-sm leading-6 text-ink">
                    {post.caption || "No caption"}
                  </p>
                  <div className="rounded-xl bg-card p-4">
                    <h3 className="text-sm font-semibold text-ink">
                      Metadata
                    </h3>
                    {metadataEntries.length ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {metadataEntries.map(([key, value]) => (
                          <span
                            key={key}
                            className="max-w-full rounded-lg border border-line bg-paper px-2.5 py-1 text-xs text-ink"
                          >
                            <span className="font-semibold">{key}</span>:{" "}
                            {value}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-sm text-muted">No metadata</p>
                    )}
                  </div>
                </>
              )}

              <div>
                <h3 className="mb-3 text-sm font-semibold text-ink">Media</h3>
                {shownMedia.length ? (
                  <div className="grid grid-cols-2 gap-3">
                    {shownMedia.map((item) => (
                      <div
                        key={item.id}
                        className="group relative overflow-hidden rounded-xl border border-line bg-card"
                      >
                        <div className="relative flex aspect-square items-center justify-center overflow-hidden bg-[#495057]">
                          {item.fileType === "IMAGE" && item.previewUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={item.previewUrl}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : item.fileType === "VIDEO" && item.previewUrl ? (
                            <>
                              <video
                                src={item.previewUrl}
                                className="h-full w-full object-cover"
                                muted
                                playsInline
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
                    ))}
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
