import { BadRequestException } from '@nestjs/common';
import { MediaType, type PostType } from '@social-manager/database';

const IMAGE_MAX_SIZE = 8 * 1024 * 1024;
const VIDEO_MAX_SIZE = 300 * 1024 * 1024;
const STORY_VIDEO_MAX_SIZE = 100 * 1024 * 1024;
const VIDEO_MIN_DURATION_SECONDS = 3;
const VIDEO_MAX_DURATION_SECONDS = 15 * 60;
const STORY_VIDEO_MAX_DURATION_SECONDS = 60;
const VIDEO_MAX_WIDTH = 1920;
const FEED_IMAGE_MIN_ASPECT = 4 / 5;
const FEED_IMAGE_MAX_ASPECT = 1.91;

type InstagramMediaAsset = {
  fileType: MediaType;
  mimeType?: string | null;
  fileSize?: number | null;
  width?: number | null;
  height?: number | null;
  durationSeconds?: number | null;
};

export function validateInstagramMediaForPostType(
  postType: PostType,
  mediaAssets: InstagramMediaAsset[],
) {
  if (mediaAssets.length === 0) return;
  if (mediaAssets.length > 10) {
    throw new BadRequestException('Instagram posts can include up to 10 files');
  }
  if (postType !== 'CAROUSEL' && mediaAssets.length > 1) {
    throw new BadRequestException('Only carousel posts can use multiple files');
  }
  if (
    postType === 'FEED' &&
    mediaAssets.some((m) => m.fileType !== MediaType.IMAGE)
  ) {
    throw new BadRequestException('Feed posts require an image upload');
  }
  if (
    postType === 'REEL' &&
    mediaAssets.some((m) => m.fileType !== MediaType.VIDEO)
  ) {
    throw new BadRequestException('Reels require a video upload');
  }
}

export function validateInstagramMediaForPublishing(
  postType: PostType,
  mediaAssets: InstagramMediaAsset[],
) {
  validateInstagramMediaForPostType(postType, mediaAssets);

  if (mediaAssets.length === 0) {
    throw new BadRequestException('Add media before publishing');
  }
  if (postType === 'CAROUSEL' && mediaAssets.length < 2) {
    throw new BadRequestException('Carousel posts need at least 2 files');
  }

  for (const asset of mediaAssets) {
    if (asset.fileType === MediaType.IMAGE) {
      validateImageAsset(postType, asset);
      continue;
    }
    validateVideoAsset(postType, asset);
  }
}

function validateImageAsset(postType: PostType, asset: InstagramMediaAsset) {
  if (!isJpeg(asset.mimeType)) {
    throw new BadRequestException(
      'Instagram Graph API image uploads must be JPEG files',
    );
  }
  if (asset.fileSize != null && asset.fileSize > IMAGE_MAX_SIZE) {
    throw new BadRequestException('Instagram images must be 8 MB or smaller');
  }
  if (
    (postType === 'FEED' || postType === 'CAROUSEL') &&
    asset.width &&
    asset.height
  ) {
    const aspect = asset.width / asset.height;
    if (aspect < FEED_IMAGE_MIN_ASPECT || aspect > FEED_IMAGE_MAX_ASPECT) {
      throw new BadRequestException(
        'Instagram feed images must be between 4:5 and 1.91:1',
      );
    }
  }
}

function validateVideoAsset(postType: PostType, asset: InstagramMediaAsset) {
  const maxFileSize =
    postType === 'STORY' ? STORY_VIDEO_MAX_SIZE : VIDEO_MAX_SIZE;
  const maxDuration =
    postType === 'STORY'
      ? STORY_VIDEO_MAX_DURATION_SECONDS
      : VIDEO_MAX_DURATION_SECONDS;
  const minAspect = postType === 'STORY' ? 0.1 : 0.01;

  if (!isSupportedVideo(asset.mimeType)) {
    throw new BadRequestException('Instagram videos must be MP4 or MOV files');
  }
  if (asset.fileSize != null && asset.fileSize > maxFileSize) {
    throw new BadRequestException(
      postType === 'STORY'
        ? 'Instagram story videos must be 100 MB or smaller'
        : 'Instagram videos must be 300 MB or smaller',
    );
  }
  if (asset.durationSeconds != null) {
    if (asset.durationSeconds < VIDEO_MIN_DURATION_SECONDS) {
      throw new BadRequestException(
        'Instagram videos must be at least 3 seconds long',
      );
    }
    if (asset.durationSeconds > maxDuration) {
      throw new BadRequestException(
        postType === 'STORY'
          ? 'Instagram story videos must be 60 seconds or shorter'
          : 'Instagram videos must be 15 minutes or shorter',
      );
    }
  }
  if (asset.width && asset.width > VIDEO_MAX_WIDTH) {
    throw new BadRequestException(
      'Instagram videos can be up to 1920 horizontal pixels',
    );
  }
  if (asset.width && asset.height) {
    const aspect = asset.width / asset.height;
    if (aspect < minAspect || aspect > 10) {
      throw new BadRequestException(
        'This video aspect ratio is outside Instagram Graph API limits',
      );
    }
  }
}

function isJpeg(mimeType?: string | null) {
  return mimeType === 'image/jpeg' || mimeType === 'image/jpg';
}

function isSupportedVideo(mimeType?: string | null) {
  return mimeType === 'video/mp4' || mimeType === 'video/quicktime';
}
