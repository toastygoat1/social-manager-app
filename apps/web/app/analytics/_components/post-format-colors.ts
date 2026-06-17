const POST_FORMAT_COLORS = {
  Post: "#5D9BFE",
  Carousel: "#FA962F",
  Reel: "#8B75FE",
  Story: "#31D8BB",
} as const;

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
