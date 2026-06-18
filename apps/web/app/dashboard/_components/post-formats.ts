export const POST_FORMATS = ["Post", "Reel", "Carousel", "Story"] as const;

export type PostFormat = (typeof POST_FORMATS)[number];

export const POST_FORMAT_COLORS: Record<PostFormat, string> = {
  Post: "#5D9BFE",
  Carousel: "#FA962F",
  Reel: "#8B75FE",
  Story: "#31D8BB",
};

export function normalizePostFormat(type: string): PostFormat {
  const normalized = type.toLowerCase();
  if (normalized.includes("story")) return "Story";
  if (normalized.includes("reel")) return "Reel";
  if (normalized.includes("carousel")) return "Carousel";
  return "Post";
}

export function emptyBreakdown(): Record<PostFormat, number> {
  return { Post: 0, Reel: 0, Carousel: 0, Story: 0 };
}
