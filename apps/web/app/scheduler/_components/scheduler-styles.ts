import { POST_FORMAT_COLORS } from "@/app/dashboard/_components/post-formats";
import type { EventStatus, SchedulerPostType } from "./data";

export const SCHEDULER_STATUS_STYLE: Record<
  EventStatus,
  {
    label: string;
    card: string;
    time: string;
    dot: string;
    badge: string;
    chip: string;
    bg: string;
    text: string;
  }
> = {
  published: {
    label: "Published",
    card: "bg-[#e7f0e9] text-[#334f41]",
    time: "text-[#5f8270]",
    dot: "bg-[#6b917e]",
    badge: "bg-[#d7e6dc] text-[#446455]",
    chip: "border-[#cbded2] bg-[#e7f0e9] text-[#334f41]",
    bg: "bg-[#d7e6dc]",
    text: "text-[#446455]",
  },
  scheduled: {
    label: "Scheduled",
    card: "bg-[#edf0ff] text-[#354579]",
    time: "text-[#637bce]",
    dot: "bg-[#607ffc]",
    badge: "bg-[#dfe5ff] text-[#506bc8]",
    chip: "border-[#cfd8ff] bg-[#edf0ff] text-[#354579]",
    bg: "bg-[#dfe5ff]",
    text: "text-[#506bc8]",
  },
  pending: {
    label: "In review",
    card: "bg-[#fbf1dc] text-[#674d23]",
    time: "text-[#a67832]",
    dot: "bg-[#c79545]",
    badge: "bg-[#f5e5be] text-[#85602b]",
    chip: "border-[#ead8ad] bg-[#fbf1dc] text-[#674d23]",
    bg: "bg-[#f5e5be]",
    text: "text-[#85602b]",
  },
  draft: {
    label: "Draft",
    card: "bg-[#f0efec] text-[#544f48]",
    time: "text-[#777169]",
    dot: "bg-[#8c8982]",
    badge: "bg-[#e2dfd9] text-[#635e57]",
    chip: "border-[#dad7d1] bg-[#f0efec] text-[#544f48]",
    bg: "bg-[#e2dfd9]",
    text: "text-[#635e57]",
  },
  removed: {
    label: "Removed",
    card: "bg-card text-muted",
    time: "text-muted",
    dot: "bg-muted",
    badge: "bg-paper text-muted",
    chip: "border-[#d8d8d8] bg-[#f8f8f8] text-[#666666]",
    bg: "bg-paper",
    text: "text-muted",
  },
};

export const SCHEDULER_POST_TYPE_STYLE: Record<
  SchedulerPostType,
  { label: string; color: string }
> = {
  FEED: { label: "Post", color: POST_FORMAT_COLORS.Post },
  CAROUSEL: { label: "Carousel", color: POST_FORMAT_COLORS.Carousel },
  REEL: { label: "Reel", color: POST_FORMAT_COLORS.Reel },
  STORY: { label: "Story", color: POST_FORMAT_COLORS.Story },
};

export function getSchedulerStatusStyleFromLabel(label: string) {
  const normalized = label.trim().toLowerCase();
  if (normalized.includes("removed")) return SCHEDULER_STATUS_STYLE.removed;
  if (normalized.includes("publish")) return SCHEDULER_STATUS_STYLE.published;
  if (normalized.includes("ready") || normalized.includes("scheduled")) {
    return SCHEDULER_STATUS_STYLE.scheduled;
  }
  if (normalized.includes("pending") || normalized.includes("review")) {
    return SCHEDULER_STATUS_STYLE.pending;
  }
  return SCHEDULER_STATUS_STYLE.draft;
}
