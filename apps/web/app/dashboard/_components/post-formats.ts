export const POST_FORMATS = ["Post", "Reel", "Carousel", "Story"] as const;

export type PostFormat = (typeof POST_FORMATS)[number];

export const POST_FORMAT_COLORS: Record<PostFormat, string> = {
  Post: "#b2a4ed",
  Carousel: "#73b1f4",
  Reel: "#66d4ef",
  Story: "#61ddbb",
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
