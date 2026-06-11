export const POST_FORMATS = ["Post", "Reel", "Carousel", "Story"] as const;

export type PostFormat = (typeof POST_FORMATS)[number];

export const POST_FORMAT_COLORS: Record<PostFormat, string> = {
  Post: "#0d0d0d",
  Reel: "#2aa889",
  Carousel: "#5e6ad2",
  Story: "#e17b5f",
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
