import { POST_FORMAT_COLORS } from "@/app/dashboard/_components/post-formats";

export function getPostFormatColor(label: string, fallback = "#5D9BFE") {
  const normalized = label.trim().toLowerCase();

  if (normalized.includes("carousel")) return POST_FORMAT_COLORS.Carousel;
  if (normalized.includes("reel")) return POST_FORMAT_COLORS.Reel;
  if (normalized.includes("story")) return POST_FORMAT_COLORS.Story;
  if (normalized.includes("post") || normalized.includes("feed")) {
    return POST_FORMAT_COLORS.Post;
  }

  return fallback;
}
