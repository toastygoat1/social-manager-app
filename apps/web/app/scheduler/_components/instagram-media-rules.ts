export type InstagramRulePostType =
  | "post"
  | "story"
  | "reels"
  | "carousel"
  | "FEED"
  | "STORY"
  | "REEL"
  | "CAROUSEL";

export type InstagramRuleMediaItem = {
  id: string;
  fileType: "IMAGE" | "VIDEO";
  mimeType: string;
  fileSize: number;
  width?: number | null;
  height?: number | null;
  durationSeconds?: number | null;
};

export type InstagramMediaIssue = {
  key: string;
  severity: "error" | "warning";
  message: string;
};

export const INSTAGRAM_IMAGE_MAX_SIZE = 8 * 1024 * 1024;
export const INSTAGRAM_VIDEO_MAX_SIZE = 300 * 1024 * 1024;
export const INSTAGRAM_STORY_VIDEO_MAX_SIZE = 100 * 1024 * 1024;
export const INSTAGRAM_VIDEO_MIN_DURATION_SECONDS = 3;
export const INSTAGRAM_VIDEO_MAX_DURATION_SECONDS = 15 * 60;
export const INSTAGRAM_STORY_VIDEO_MAX_DURATION_SECONDS = 60;
export const INSTAGRAM_MAX_VIDEO_WIDTH = 1920;
export const FEED_IMAGE_MIN_ASPECT = 4 / 5;
export const FEED_IMAGE_MAX_ASPECT = 1.91;
export const INSTAGRAM_FEED_IMAGE_MAX_WIDTH = 1440;

const STORY_RECOMMENDED_ASPECT = 9 / 16;
const STORY_RECOMMENDED_ASPECT_TOLERANCE = 0.05;

export function normalizeRulePostType(
  postType: InstagramRulePostType,
): "FEED" | "STORY" | "REEL" | "CAROUSEL" {
  if (postType === "post") return "FEED";
  if (postType === "story") return "STORY";
  if (postType === "reels") return "REEL";
  if (postType === "carousel") return "CAROUSEL";
  return postType;
}

export function buildInstagramMediaIssues(
  postType: InstagramRulePostType,
  mediaItems: InstagramRuleMediaItem[],
  options: { forPublish?: boolean; autoCarouselPost?: boolean } = {},
): InstagramMediaIssue[] {
  const normalizedType = normalizeRulePostType(postType);
  const postWillAutoCarousel =
    postType === "post" && options.autoCarouselPost && mediaItems.length > 1;
  const effectiveType = postWillAutoCarousel ? "CAROUSEL" : normalizedType;
  const issues: InstagramMediaIssue[] = [];
  const maxCount = effectiveType === "CAROUSEL" ? 10 : 1;

  if (options.forPublish && mediaItems.length === 0) {
    issues.push(error("media-required", "Add media before publishing."));
  }
  if (mediaItems.length > maxCount) {
    issues.push(
      error(
        "media-count",
        effectiveType === "CAROUSEL"
          ? "Carousel posts can contain up to 10 media files."
          : "This post type supports one media file.",
      ),
    );
  }
  if (postWillAutoCarousel) {
    issues.push(
      warning(
        "post-auto-carousel",
        "Multiple images on a post will publish as an Instagram carousel.",
      ),
    );
  } else if (effectiveType !== "CAROUSEL" && mediaItems.length > 1) {
    issues.push(error("media-single", "Use carousel for multiple media files."));
  }
  if (effectiveType === "CAROUSEL") {
    if (options.forPublish && mediaItems.length > 0 && mediaItems.length < 2) {
      issues.push(
        error("carousel-min", "Carousel posts need at least 2 media files."),
      );
    } else if (!options.forPublish && mediaItems.length === 1) {
      issues.push(
        warning(
          "carousel-min-warning",
          "Add at least 2 media files before scheduling this carousel.",
        ),
      );
    }
  }

  for (const item of mediaItems) {
    if (effectiveType === "FEED" && item.fileType !== "IMAGE") {
      issues.push(error(`${item.id}-feed-image`, "Feed posts require an image."));
      continue;
    }
    if (effectiveType === "REEL" && item.fileType !== "VIDEO") {
      issues.push(error(`${item.id}-reel-video`, "Reels require a video."));
      continue;
    }

    if (item.fileType === "IMAGE") {
      issues.push(...buildImageIssues(effectiveType, item));
      continue;
    }
    issues.push(...buildVideoIssues(effectiveType, item));
  }

  return dedupeIssues(issues);
}

export function firstBlockingInstagramIssue(
  postType: InstagramRulePostType,
  mediaItems: InstagramRuleMediaItem[],
  options: { forPublish?: boolean; autoCarouselPost?: boolean } = {},
) {
  return buildInstagramMediaIssues(postType, mediaItems, options).find(
    (issue) => issue.severity === "error",
  );
}

export function formatInstagramFileSize(bytes: number) {
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}

function buildImageIssues(
  postType: "FEED" | "STORY" | "REEL" | "CAROUSEL",
  item: InstagramRuleMediaItem,
) {
  const issues: InstagramMediaIssue[] = [];
  if (!isJpeg(item.mimeType)) {
    issues.push(
      error(
        `${item.id}-image-format`,
        "Instagram Graph API image uploads must be JPEG files.",
      ),
    );
  }
  if (item.fileSize > INSTAGRAM_IMAGE_MAX_SIZE) {
    issues.push(
      error(
        `${item.id}-image-size`,
        "Instagram images must be 8 MB or smaller.",
      ),
    );
  }
  if (
    (postType === "FEED" || postType === "CAROUSEL") &&
    item.width &&
    item.height
  ) {
    const aspect = item.width / item.height;
    if (aspect < FEED_IMAGE_MIN_ASPECT || aspect > FEED_IMAGE_MAX_ASPECT) {
      issues.push(
        error(
          `${item.id}-feed-aspect`,
          "Feed and carousel images must be between 4:5 and 1.91:1.",
        ),
      );
    }
  }
  if (postType === "STORY" && item.width && item.height) {
    const aspect = item.width / item.height;
    if (!isCloseToStoryAspect(aspect)) {
      issues.push(
        warning(
          `${item.id}-story-image-aspect`,
          "Instagram recommends 9:16 story images to avoid cropping or blank space.",
        ),
      );
    }
  }
  return issues;
}

function buildVideoIssues(
  postType: "FEED" | "STORY" | "REEL" | "CAROUSEL",
  item: InstagramRuleMediaItem,
) {
  const issues: InstagramMediaIssue[] = [];
  const maxFileSize =
    postType === "STORY"
      ? INSTAGRAM_STORY_VIDEO_MAX_SIZE
      : INSTAGRAM_VIDEO_MAX_SIZE;
  const maxDuration =
    postType === "STORY"
      ? INSTAGRAM_STORY_VIDEO_MAX_DURATION_SECONDS
      : INSTAGRAM_VIDEO_MAX_DURATION_SECONDS;
  const aspectMin = postType === "STORY" ? 0.1 : 0.01;

  if (!isSupportedVideo(item.mimeType)) {
    issues.push(
      error(
        `${item.id}-video-format`,
        "Instagram videos must be MP4 or MOV files.",
      ),
    );
  }
  if (item.fileSize > maxFileSize) {
    issues.push(
      error(
        `${item.id}-video-size`,
        `Instagram ${postType === "STORY" ? "story videos" : "videos"} must be ${formatInstagramFileSize(maxFileSize)} or smaller.`,
      ),
    );
  }
  if (item.durationSeconds != null) {
    if (item.durationSeconds < INSTAGRAM_VIDEO_MIN_DURATION_SECONDS) {
      issues.push(
        error(
          `${item.id}-video-min-duration`,
          "Instagram videos must be at least 3 seconds long.",
        ),
      );
    }
    if (item.durationSeconds > maxDuration) {
      issues.push(
        error(
          `${item.id}-video-max-duration`,
          postType === "STORY"
            ? "Instagram story videos must be 60 seconds or shorter."
            : "Instagram videos must be 15 minutes or shorter.",
        ),
      );
    }
  }
  if (item.width && item.width > INSTAGRAM_MAX_VIDEO_WIDTH) {
    issues.push(
      error(
        `${item.id}-video-width`,
        "Instagram videos can be up to 1920 horizontal pixels.",
      ),
    );
  }
  if (item.width && item.height) {
    const aspect = item.width / item.height;
    if (aspect < aspectMin || aspect > 10) {
      issues.push(
        error(
          `${item.id}-video-aspect`,
          "This video aspect ratio is outside Instagram Graph API limits.",
        ),
      );
    } else if (
      (postType === "STORY" || postType === "REEL") &&
      !isCloseToStoryAspect(aspect)
    ) {
      issues.push(
        warning(
          `${item.id}-video-recommended-aspect`,
          `Instagram recommends 9:16 ${postType === "STORY" ? "story" : "reel"} videos to avoid cropping or blank space.`,
        ),
      );
    }
  }
  return issues;
}

function isJpeg(mimeType: string) {
  return mimeType === "image/jpeg" || mimeType === "image/jpg";
}

function isSupportedVideo(mimeType: string) {
  return mimeType === "video/mp4" || mimeType === "video/quicktime";
}

function isCloseToStoryAspect(aspect: number) {
  return (
    Math.abs(aspect - STORY_RECOMMENDED_ASPECT) <=
    STORY_RECOMMENDED_ASPECT_TOLERANCE
  );
}

function error(key: string, message: string): InstagramMediaIssue {
  return { key, message, severity: "error" };
}

function warning(key: string, message: string): InstagramMediaIssue {
  return { key, message, severity: "warning" };
}

function dedupeIssues(issues: InstagramMediaIssue[]) {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    const key = `${issue.severity}:${issue.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
