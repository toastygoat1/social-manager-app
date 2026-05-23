import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';
import {
  MediaType,
  PostStatus,
  PostType,
  Prisma,
  PublishAttemptStatus,
  PublishTrigger,
} from '@social-manager/database';
import { PrismaService } from '../prisma/prisma.service.js';
import { decryptSecret } from '../common/crypto.util.js';

const DEFAULT_GRAPH_API_VERSION = 'v21.0';
const DEFAULT_MEDIA_BUCKET = 'media-assets';
const SIGNED_MEDIA_URL_TTL_SECONDS = 60 * 60;
const CONTAINER_POLL_ATTEMPTS = 12;
const CONTAINER_POLL_DELAY_MS = 5_000;
const FEED_IMAGE_MIN_ASPECT = 4 / 5;
const FEED_IMAGE_MAX_ASPECT = 1.91;

const PUBLISHABLE_POST_INCLUDE = {
  instagramAccount: {
    select: {
      id: true,
      userId: true,
      username: true,
      igUserId: true,
      accessTokenEncrypted: true,
      isActive: true,
    },
  },
  postMedia: {
    orderBy: { sortOrder: 'asc' },
    include: { mediaAsset: true },
  },
} satisfies Prisma.ContentPostInclude;

type PublishablePost = Prisma.ContentPostGetPayload<{
  include: typeof PUBLISHABLE_POST_INCLUDE;
}>;

type MediaForPublish = PublishablePost['postMedia'][number] & {
  signedUrl: string;
};

type GraphApiError = {
  error?: {
    message?: string;
    type?: string;
    code?: number;
  };
};

type GraphIdResponse = GraphApiError & {
  id?: string;
};

type GraphContainerStatusResponse = GraphApiError & {
  status_code?: string;
};

type GraphMediaResponse = GraphApiError & {
  permalink?: string;
};

type PublishResult = {
  containerId: string;
  mediaId: string;
  permalink: string | null;
  raw: unknown;
};

@Injectable()
export class InstagramPublisherService {
  private readonly bucket: string;
  private readonly supabase: ReturnType<typeof createClient>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.bucket =
      this.config.get<string>('SUPABASE_MEDIA_BUCKET')?.trim() ||
      DEFAULT_MEDIA_BUCKET;
    this.supabase = createClient(
      this.config.getOrThrow<string>('SUPABASE_URL'),
      this.config.getOrThrow<string>('SUPABASE_SERVICE_ROLE_KEY'),
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );
  }

  async publishNow(userId: string, contentPostId: string) {
    const post = await this.prisma.contentPost.findFirst({
      where: {
        id: contentPostId,
        instagramAccount: { userId, isActive: true },
      },
      include: PUBLISHABLE_POST_INCLUDE,
    });

    if (!post) {
      throw new NotFoundException('Post was not found');
    }

    return this.publishPost(post, PublishTrigger.MANUAL);
  }

  async publishScheduled(contentPostId: string, jobReference?: string) {
    const post = await this.prisma.contentPost.findUnique({
      where: { id: contentPostId },
      include: PUBLISHABLE_POST_INCLUDE,
    });

    if (!post || !post.instagramAccount.isActive) {
      throw new NotFoundException('Post was not found');
    }
    if (post.status === PostStatus.PUBLISHED) {
      return post;
    }
    if (post.status !== PostStatus.READY) {
      throw new BadRequestException(
        'Scheduled post is not approved for publishing',
      );
    }
    if (!post.scheduledFor || post.scheduledFor > new Date()) {
      throw new BadRequestException('Scheduled publish time has not arrived');
    }

    return this.publishPost(post, PublishTrigger.SCHEDULED, jobReference);
  }

  private async publishPost(
    post: PublishablePost,
    trigger: PublishTrigger,
    jobReference?: string,
  ) {
    if (post.status === PostStatus.PUBLISHED) {
      return post;
    }
    if (post.igMediaContainerId) {
      throw new ConflictException(
        'Publishing has already started for this post. Verify Instagram before trying again.',
      );
    }

    this.validatePost(post);
    const attempt = await this.createPublishAttempt(
      post.id,
      trigger,
      jobReference,
    );

    try {
      const result = await this.publishToInstagram(post);
      const publishedAt = new Date();
      const updated = await this.prisma.contentPost.update({
        where: { id: post.id },
        data: {
          status: PostStatus.PUBLISHED,
          publishedAt,
          igMediaId: result.mediaId,
          igMediaContainerId: result.containerId,
          igPermalink: result.permalink,
        },
        include: PUBLISHABLE_POST_INCLUDE,
      });

      await this.prisma.publishAttempt.update({
        where: { id: attempt.id },
        data: {
          status: PublishAttemptStatus.SUCCESS,
          finishedAt: publishedAt,
          responseJson: result.raw as Prisma.InputJsonValue,
        },
      });

      return updated;
    } catch (error) {
      const message = readErrorMessage(error);
      await this.prisma.publishAttempt.update({
        where: { id: attempt.id },
        data: {
          status: PublishAttemptStatus.FAILED,
          finishedAt: new Date(),
          errorMessage: message,
        },
      });
      if (error instanceof ConflictException) throw error;
      throw new BadGatewayException(`Instagram publish failed: ${message}`);
    }
  }

  private async createPublishAttempt(
    contentPostId: string,
    trigger: PublishTrigger,
    jobReference?: string,
  ) {
    const previousAttempts = await this.prisma.publishAttempt.count({
      where: { contentPostId },
    });

    return this.prisma.publishAttempt.create({
      data: {
        contentPostId,
        trigger:
          trigger === PublishTrigger.SCHEDULED && previousAttempts > 0
            ? PublishTrigger.RETRY
            : trigger,
        attemptNumber: previousAttempts + 1,
        jobReference,
      },
    });
  }

  private async publishToInstagram(
    post: PublishablePost,
  ): Promise<PublishResult> {
    const accessToken = decryptSecret(
      post.instagramAccount.accessTokenEncrypted,
    );
    const media = await this.withSignedUrls(post.postMedia);

    const containerId =
      post.postType === PostType.CAROUSEL
        ? await this.createCarouselContainer(post, media, accessToken)
        : await this.createSingleReadyContainer(post, media[0], accessToken);
    await this.claimPublishContainer(post.id, containerId);
    return this.publishContainer(
      post.instagramAccount.igUserId,
      containerId,
      accessToken,
    );
  }

  private async createCarouselContainer(
    post: PublishablePost,
    media: MediaForPublish[],
    accessToken: string,
  ) {
    const childContainers = await Promise.all(
      media.map(async (item) => {
        const container = await this.createCarouselItemContainer(
          post.instagramAccount.igUserId,
          item,
          accessToken,
        );
        await this.waitForContainer(container.id, accessToken);
        return container.id;
      }),
    );

    const parent = await this.createContainer(
      post.instagramAccount.igUserId,
      {
        media_type: 'CAROUSEL',
        children: childContainers.join(','),
        caption: post.caption ?? '',
      },
      accessToken,
    );
    await this.waitForContainer(parent.id, accessToken);
    return parent.id;
  }

  private async createSingleReadyContainer(
    post: PublishablePost,
    media: MediaForPublish,
    accessToken: string,
  ) {
    const container = await this.createSingleMediaContainer(
      post,
      media,
      accessToken,
    );
    await this.waitForContainer(container.id, accessToken);
    return container.id;
  }

  private async claimPublishContainer(
    contentPostId: string,
    containerId: string,
  ) {
    const result = await this.prisma.contentPost.updateMany({
      where: {
        id: contentPostId,
        status: PostStatus.READY,
        igMediaContainerId: null,
      },
      data: { igMediaContainerId: containerId },
    });

    if (result.count !== 1) {
      throw new ConflictException(
        'Publishing has already started for this post. Verify Instagram before trying again.',
      );
    }
  }

  private async createSingleMediaContainer(
    post: PublishablePost,
    media: MediaForPublish,
    accessToken: string,
  ) {
    if (post.postType === PostType.STORY) {
      return this.createContainer(
        post.instagramAccount.igUserId,
        {
          media_type: 'STORIES',
          ...mediaUrlParam(media),
        },
        accessToken,
      );
    }

    if (post.postType === PostType.REEL) {
      return this.createContainer(
        post.instagramAccount.igUserId,
        {
          media_type: 'REELS',
          video_url: media.signedUrl,
          caption: post.caption ?? '',
        },
        accessToken,
      );
    }

    return this.createContainer(
      post.instagramAccount.igUserId,
      {
        image_url: media.signedUrl,
        caption: post.caption ?? '',
      },
      accessToken,
    );
  }

  private async createCarouselItemContainer(
    igUserId: string,
    media: MediaForPublish,
    accessToken: string,
  ) {
    return this.createContainer(
      igUserId,
      {
        is_carousel_item: 'true',
        ...(media.mediaAsset.fileType === MediaType.VIDEO
          ? { media_type: 'VIDEO', video_url: media.signedUrl }
          : { image_url: media.signedUrl }),
      },
      accessToken,
    );
  }

  private async createContainer(
    igUserId: string,
    params: Record<string, string>,
    accessToken: string,
  ) {
    const body = await this.requestGraphPost<GraphIdResponse>(
      `${igUserId}/media`,
      params,
      accessToken,
    );

    if (!body.id) {
      throw new Error('Instagram did not return a media container id');
    }

    return { id: body.id };
  }

  private async publishContainer(
    igUserId: string,
    creationId: string,
    accessToken: string,
  ): Promise<PublishResult> {
    const body = await this.requestGraphPost<GraphIdResponse>(
      `${igUserId}/media_publish`,
      { creation_id: creationId },
      accessToken,
    );

    if (!body.id) {
      throw new Error('Instagram did not return a published media id');
    }

    const media = await this.requestGraphGet<GraphMediaResponse>(
      body.id,
      { fields: 'permalink' },
      accessToken,
    ).catch(() => null);

    return {
      containerId: creationId,
      mediaId: body.id,
      permalink: media?.permalink ?? null,
      raw: body,
    };
  }

  private async waitForContainer(containerId: string, accessToken: string) {
    for (let attempt = 0; attempt < CONTAINER_POLL_ATTEMPTS; attempt += 1) {
      const status = await this.requestGraphGet<GraphContainerStatusResponse>(
        containerId,
        { fields: 'status_code' },
        accessToken,
      );

      if (!status.status_code || status.status_code === 'FINISHED') {
        return;
      }
      if (status.status_code === 'ERROR' || status.status_code === 'EXPIRED') {
        throw new Error(`Instagram media container ${status.status_code}`);
      }

      await sleep(CONTAINER_POLL_DELAY_MS);
    }

    throw new Error('Instagram media is still processing');
  }

  private async withSignedUrls(postMedia: PublishablePost['postMedia']) {
    return Promise.all(
      postMedia.map(async (item) => {
        const { data, error } = await this.supabase.storage
          .from(this.bucket)
          .createSignedUrl(
            item.mediaAsset.storagePath,
            SIGNED_MEDIA_URL_TTL_SECONDS,
          );

        if (error || !data?.signedUrl) {
          throw new Error(error?.message ?? 'Could not sign media URL');
        }

        return { ...item, signedUrl: data.signedUrl };
      }),
    );
  }

  private validatePost(post: PublishablePost) {
    if (post.status === PostStatus.PENDING) {
      throw new BadRequestException('Approve this post before publishing');
    }
    if (post.postMedia.length === 0) {
      throw new BadRequestException('Add media before posting now');
    }

    if (post.postType === PostType.CAROUSEL) {
      if (post.postMedia.length < 2) {
        throw new BadRequestException('Carousel posts need at least 2 files');
      }
      this.validateImageAspectRatios(post);
      return;
    }

    if (post.postMedia.length > 1) {
      throw new BadRequestException('Use a carousel for multiple files');
    }

    const onlyMedia = post.postMedia[0]?.mediaAsset;
    if (!onlyMedia) {
      throw new BadRequestException('Add media before posting now');
    }
    if (
      post.postType === PostType.FEED &&
      onlyMedia.fileType !== MediaType.IMAGE
    ) {
      throw new BadRequestException('Feed posts require an image upload');
    }
    if (
      post.postType === PostType.REEL &&
      onlyMedia.fileType !== MediaType.VIDEO
    ) {
      throw new BadRequestException('Reels require a video upload');
    }

    this.validateImageAspectRatios(post);
  }

  private validateImageAspectRatios(post: PublishablePost) {
    if (
      post.postType !== PostType.FEED &&
      post.postType !== PostType.CAROUSEL
    ) {
      return;
    }

    const unsupportedImage = post.postMedia.find(({ mediaAsset }) => {
      if (
        mediaAsset.fileType !== MediaType.IMAGE ||
        !mediaAsset.width ||
        !mediaAsset.height
      ) {
        return false;
      }
      const aspect = mediaAsset.width / mediaAsset.height;
      return aspect < FEED_IMAGE_MIN_ASPECT || aspect > FEED_IMAGE_MAX_ASPECT;
    });

    if (unsupportedImage) {
      throw new BadRequestException(
        'Instagram feed images must be between 4:5 and 1.91:1',
      );
    }
  }

  private async requestGraphPost<T extends GraphApiError>(
    path: string,
    params: Record<string, string>,
    accessToken: string,
  ): Promise<T> {
    const response = await fetch(this.createGraphUrl(path), {
      method: 'POST',
      body: new URLSearchParams({ ...params, access_token: accessToken }),
    });
    return this.readGraphResponse<T>(response);
  }

  private async requestGraphGet<T extends GraphApiError>(
    path: string,
    params: Record<string, string>,
    accessToken: string,
  ): Promise<T> {
    const url = this.createGraphUrl(path);
    Object.entries(params).forEach(([key, value]) =>
      url.searchParams.set(key, value),
    );
    url.searchParams.set('access_token', accessToken);

    const response = await fetch(url);
    return this.readGraphResponse<T>(response);
  }

  private async readGraphResponse<T extends GraphApiError>(response: Response) {
    const body = (await response.json().catch(() => ({}))) as T;

    if (!response.ok || body.error) {
      throw new Error(
        body.error?.message ??
          `Meta Graph API request failed with status ${response.status}`,
      );
    }

    return body;
  }

  private createGraphUrl(path: string) {
    return new URL(
      `${this.getGraphBaseUrl()}/${path.startsWith('/') ? path.slice(1) : path}`,
    );
  }

  private getGraphBaseUrl() {
    return `https://graph.instagram.com/${this.getGraphApiVersion()}`;
  }

  private getGraphApiVersion() {
    return (
      this.config.get<string>('META_GRAPH_API_VERSION')?.trim() ||
      DEFAULT_GRAPH_API_VERSION
    );
  }
}

function mediaUrlParam(media: MediaForPublish): Record<string, string> {
  return media.mediaAsset.fileType === MediaType.VIDEO
    ? { video_url: media.signedUrl }
    : { image_url: media.signedUrl };
}

function readErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  return 'Unknown publish error';
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
