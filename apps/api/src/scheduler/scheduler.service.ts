import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  MediaType,
  PostStatus,
  PublishAttemptStatus,
  type PostType,
  type Prisma,
} from '@social-manager/database';
import { InstagramPublisherService } from '../publishing/instagram-publisher.service.js';
import { PublishQueueService } from '../queue/publish-queue.service.js';
import { MediaService } from '../media/media.service.js';
import { decryptSecret } from '../common/crypto.util.js';
import {
  validateInstagramMediaForPostType,
  validateInstagramMediaForPublishing,
} from '../common/instagram-media-rules.js';
import type { UpdateDraftAction } from './dto/update-draft.dto.js';
import type { PostMetadataDto } from './dto/post-metadata.dto.js';

export type SchedulerEventSource = 'scheduled_post';
type CreateEventAction = 'SCHEDULE' | 'POST_NOW' | 'DRAFT';
export type PostMetadata = Record<string, string>;
type PostMetadataInput = PostMetadataDto;
const MAX_METADATA_FIELDS = 12;
const MAX_METADATA_KEY_LENGTH = 40;
const MAX_METADATA_VALUE_LENGTH = 160;
const DEFAULT_GRAPH_API_VERSION = 'v21.0';
const COMMENT_SYNC_TTL_MS = 15 * 60 * 1000;
const COMMENT_SYNC_LIMIT = 25;
const COMMENT_FIELDS =
  'id,text,username,timestamp,like_count,hidden,replies{id,text,username,timestamp,like_count,hidden}';

export type SchedulerEvent = {
  id: string;
  source: SchedulerEventSource;
  title: string;
  start: string;
  end: string | null;
  allDay: boolean;
  status: 'published' | 'scheduled' | 'pending' | 'draft' | null;
  postType: PostType | null;
  accountId: string | null;
  accountUsername: string | null;
  caption: string | null;
};

export type SchedulerPayload = {
  events: SchedulerEvent[];
};

export type SchedulerMetadataField = {
  id: string;
  label: string;
  sortOrder: number;
};

const POST_DETAIL_INCLUDE = {
  instagramAccount: {
    select: {
      id: true,
      userId: true,
      username: true,
      isActive: true,
      accessTokenEncrypted: true,
    },
  },
  postMedia: {
    orderBy: { sortOrder: 'asc' },
    include: { mediaAsset: true },
  },
  publishAttempts: {
    orderBy: { startedAt: 'desc' },
    take: 1,
  },
  postAnalytics: {
    orderBy: { fetchedAt: 'desc' },
    take: 1,
  },
  postComments: {
    orderBy: [{ timestamp: 'desc' }, { createdAt: 'desc' }],
    take: COMMENT_SYNC_LIMIT,
  },
  metadataValues: {
    include: {
      field: true,
    },
  },
} satisfies Prisma.ContentPostInclude;

type PostDetailRecord = Prisma.ContentPostGetPayload<{
  include: typeof POST_DETAIL_INCLUDE;
}>;

export type SchedulerPostDetail = {
  id: string;
  title: string | null;
  caption: string | null;
  metadataFields: SchedulerMetadataField[];
  metadata: PostMetadata;
  postType: PostType;
  status: 'published' | 'scheduled' | 'pending' | 'draft';
  accountId: string;
  accountUsername: string;
  scheduledFor: string | null;
  publishedAt: string | null;
  createdAt: string;
  permalink: string | null;
  media: {
    id: string;
    fileType: MediaType;
    mimeType: string;
    fileSize: number;
    width: number | null;
    height: number | null;
    durationSeconds: number | null;
    previewUrl: string | null;
    sourceUrl: string | null;
    thumbnailUrl: string | null;
  }[];
  analytics: {
    views: number | null;
    reach: number | null;
    likes: number | null;
    comments: number | null;
    shares: number | null;
    saves: number | null;
    interactions: number | null;
    fetchedAt: string | null;
  } | null;
  comments: {
    items: SchedulerPostComment[];
    syncedAt: string | null;
    status: 'synced' | 'cached' | 'unavailable' | 'not_available';
    errorMessage: string | null;
  };
  latestFailure: {
    id: string;
    attemptNumber: number;
    errorMessage: string | null;
    startedAt: string;
    retryable: boolean;
  } | null;
};

export type SchedulerPostComment = {
  id: string;
  instagramCommentId: string;
  parentInstagramCommentId: string | null;
  username: string | null;
  text: string | null;
  likeCount: number | null;
  hidden: boolean | null;
  timestamp: string | null;
  syncedAt: string;
};

type InstagramCommentResponse = {
  id?: string;
  text?: string;
  username?: string;
  timestamp?: string;
  like_count?: unknown;
  hidden?: boolean;
  replies?: {
    data?: InstagramCommentResponse[];
  };
};

type InstagramCommentsResponse = {
  data?: InstagramCommentResponse[];
  error?: {
    message?: string;
    type?: string;
    code?: number;
  };
};

type FetchedInstagramComment = {
  instagramCommentId: string;
  parentInstagramCommentId: string | null;
  username: string | null;
  text: string | null;
  likeCount: number | null;
  hidden: boolean | null;
  timestamp: Date | null;
};

export type SchedulerWorkItem = {
  id: string;
  title: string;
  postType: PostType;
  status: 'pending' | 'draft';
  accountUsername: string;
  scheduledFor: string | null;
  createdAt: string;
};

export type SchedulerFailedPost = {
  id: string;
  title: string;
  postType: PostType;
  accountUsername: string;
  scheduledFor: string | null;
  attemptNumber: number;
  errorMessage: string | null;
  failedAt: string;
  retryable: boolean;
};

const POST_STATUS_TO_UI: Record<
  PostStatus,
  'published' | 'scheduled' | 'pending' | 'draft'
> = {
  DRAFT: 'draft',
  PENDING: 'pending',
  READY: 'scheduled',
  PUBLISHED: 'published',
};

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly publisher: InstagramPublisherService,
    private readonly publishQueue: PublishQueueService,
    private readonly media: MediaService,
    private readonly config: ConfigService,
  ) {}

  async listMetadataFields(userId: string): Promise<SchedulerMetadataField[]> {
    const fields = await this.prisma.contentMetadataField.findMany({
      where: { userId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, label: true, sortOrder: true },
    });
    return fields.map(mapMetadataField);
  }

  async saveMetadataFields(
    userId: string,
    input: PostMetadataInput[],
  ): Promise<SchedulerMetadataField[]> {
    const entries = normalizeMetadataFieldDefinitions(input);

    return this.prisma.$transaction(async (tx) => {
      const existingFields = await tx.contentMetadataField.findMany({
        where: { userId },
        select: { id: true, label: true, sortOrder: true },
      });
      const fieldById = new Map(
        existingFields.map((field) => [field.id, field]),
      );
      const requestedExistingIds = new Set(
        entries.flatMap((entry) => (entry.fieldId ? [entry.fieldId] : [])),
      );
      for (const fieldId of requestedExistingIds) {
        if (!fieldById.has(fieldId)) {
          throw new ForbiddenException('Metadata field is not available');
        }
      }

      const fieldsToDelete = existingFields
        .filter((field) => !requestedExistingIds.has(field.id))
        .map((field) => field.id);
      if (fieldsToDelete.length) {
        await tx.contentMetadataField.deleteMany({
          where: { id: { in: fieldsToDelete }, userId },
        });
      }

      for (const [sortOrder, entry] of entries.entries()) {
        if (entry.fieldId) {
          await tx.contentMetadataField.update({
            where: { id: entry.fieldId },
            data: { label: entry.label, sortOrder },
          });
          continue;
        }

        await tx.contentMetadataField.create({
          data: {
            userId,
            label: entry.label,
            sortOrder,
          },
        });
      }

      const fields = await tx.contentMetadataField.findMany({
        where: { userId },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        select: { id: true, label: true, sortOrder: true },
      });
      return fields.map(mapMetadataField);
    });
  }

  async listEvents(
    userId: string,
    fromDate: Date,
    toDate: Date,
  ): Promise<SchedulerPayload> {
    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
      throw new BadRequestException('Invalid date range');
    }
    if (fromDate > toDate) {
      throw new BadRequestException('from must be before to');
    }

    const accounts = await this.prisma.instagramAccount.findMany({
      where: { userId, isActive: true },
      select: { id: true, username: true },
    });
    const accountIds = accounts.map((a) => a.id);
    const usernameByAccountId = new Map(
      accounts.map((a) => [a.id, a.username] as const),
    );

    const scheduledPosts = accountIds.length
      ? await this.prisma.contentPost.findMany({
          where: {
            instagramAccountId: { in: accountIds },
            OR: [
              { scheduledFor: { gte: fromDate, lte: toDate } },
              { publishedAt: { gte: fromDate, lte: toDate } },
              {
                status: PostStatus.DRAFT,
                createdAt: { gte: fromDate, lte: toDate },
              },
            ],
          },
          orderBy: { scheduledFor: 'asc' },
        })
      : [];

    const events: SchedulerEvent[] = scheduledPosts.map<SchedulerEvent>(
      (post) => {
        const when = post.scheduledFor ?? post.publishedAt ?? post.createdAt;
        return {
          id: `post:${post.id}`,
          source: 'scheduled_post',
          title: post.title ?? post.caption?.slice(0, 60) ?? 'Untitled post',
          start: when.toISOString(),
          end: null,
          allDay: false,
          status: POST_STATUS_TO_UI[post.status],
          postType: post.postType,
          accountId: post.instagramAccountId,
          accountUsername:
            usernameByAccountId.get(post.instagramAccountId) ?? null,
          caption: post.caption,
        };
      },
    );

    events.sort((a, b) => a.start.localeCompare(b.start));

    return { events };
  }

  async createScheduledEvent(
    userId: string,
    input: {
      instagramAccountId: string;
      postType: PostType;
      action?: CreateEventAction;
      scheduledFor?: string;
      title?: string;
      caption?: string;
      metadata?: PostMetadataInput[];
      requiresApproval?: boolean;
      mediaAssetIds?: string[];
    },
  ): Promise<SchedulerEvent> {
    const account = await this.prisma.instagramAccount.findUnique({
      where: { id: input.instagramAccountId },
      select: { id: true, userId: true, username: true, isActive: true },
    });
    if (!account) throw new NotFoundException('Instagram account not found');
    if (account.userId !== userId) {
      throw new ForbiddenException('Account belongs to another user');
    }
    if (!account.isActive) {
      throw new NotFoundException('Instagram account not found');
    }

    const action = input.action ?? 'SCHEDULE';
    const { scheduledFor, status } = resolveCreateAction(input, action);
    const mediaAssetIds = [...new Set(input.mediaAssetIds ?? [])];
    const mediaAssets = mediaAssetIds.length
      ? await this.prisma.mediaAsset.findMany({
          where: { id: { in: mediaAssetIds }, userId },
          select: {
            id: true,
            fileType: true,
            mimeType: true,
            fileSize: true,
            width: true,
            height: true,
            durationSeconds: true,
          },
        })
      : [];

    if (mediaAssets.length !== mediaAssetIds.length) {
      throw new ForbiddenException(
        'One or more media assets are not available',
      );
    }
    validateInstagramMediaForPostType(input.postType, mediaAssets);
    const publishWhenScheduled =
      action === 'SCHEDULE' && status === PostStatus.READY && !!scheduledFor;
    if (action === 'POST_NOW' || action === 'SCHEDULE') {
      validateInstagramMediaForPublishing(input.postType, mediaAssets);
    }
    if (publishWhenScheduled) {
      await this.publishQueue.ensureAvailable();
    }

    let post = await this.prisma.$transaction(async (tx) => {
      const created = await tx.contentPost.create({
        data: {
          instagramAccountId: account.id,
          postType: input.postType,
          scheduledFor,
          status,
          title: input.title,
          caption: input.caption,
        },
      });

      if (mediaAssetIds.length) {
        await tx.postMedia.createMany({
          data: mediaAssetIds.map((mediaAssetId, sortOrder) => ({
            contentPostId: created.id,
            mediaAssetId,
            sortOrder,
          })),
        });
      }

      if (input.metadata !== undefined) {
        await this.syncPostMetadataValues(
          tx,
          userId,
          created.id,
          input.metadata,
        );
      }

      return created;
    });

    if (publishWhenScheduled && scheduledFor) {
      try {
        await this.publishQueue.enqueueScheduledPost(post.id, scheduledFor);
      } catch (error) {
        await this.prisma.contentPost
          .delete({ where: { id: post.id } })
          .catch((rollbackError: unknown) => {
            this.logger.error(
              `Could not remove unqueued scheduled post ${post.id}: ${readMessage(rollbackError)}`,
            );
          });
        throw error;
      }
    }

    if (action === 'POST_NOW') {
      post = await this.publisher.publishNow(userId, post.id);
    }

    return {
      id: `post:${post.id}`,
      source: 'scheduled_post',
      title: post.title ?? post.caption?.slice(0, 60) ?? 'Untitled post',
      start: (
        post.scheduledFor ??
        post.publishedAt ??
        post.createdAt
      ).toISOString(),
      end: null,
      allDay: false,
      status: POST_STATUS_TO_UI[post.status],
      postType: post.postType,
      accountId: account.id,
      accountUsername: account.username,
      caption: post.caption,
    };
  }

  async listWorkItems(userId: string): Promise<{
    pending: SchedulerWorkItem[];
    drafts: SchedulerWorkItem[];
  }> {
    const posts = await this.prisma.contentPost.findMany({
      where: {
        status: { in: [PostStatus.PENDING, PostStatus.DRAFT] },
        instagramAccount: { userId, isActive: true },
      },
      include: {
        instagramAccount: { select: { username: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const items = posts.map((post) => ({
      id: post.id,
      title: post.title ?? post.caption?.slice(0, 60) ?? 'Untitled post',
      postType: post.postType,
      status:
        post.status === PostStatus.PENDING
          ? ('pending' as const)
          : ('draft' as const),
      accountUsername: post.instagramAccount.username,
      scheduledFor: post.scheduledFor?.toISOString() ?? null,
      createdAt: post.createdAt.toISOString(),
    }));

    return {
      pending: items.filter((item) => item.status === 'pending'),
      drafts: items.filter((item) => item.status === 'draft'),
    };
  }

  async listFailedPosts(userId: string): Promise<SchedulerFailedPost[]> {
    const posts = await this.prisma.contentPost.findMany({
      where: {
        status: PostStatus.READY,
        scheduledFor: { lte: new Date() },
        instagramAccount: { userId, isActive: true },
        OR: [
          { igMediaContainerId: { not: null } },
          {
            publishAttempts: { some: { status: PublishAttemptStatus.FAILED } },
          },
        ],
      },
      include: {
        instagramAccount: { select: { username: true } },
        publishAttempts: { orderBy: { startedAt: 'desc' }, take: 1 },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return posts.flatMap((post) => {
      const attempt = post.publishAttempts[0];
      const requiresReview = !!post.igMediaContainerId;
      if (
        !requiresReview &&
        (!attempt || attempt.status !== PublishAttemptStatus.FAILED)
      ) {
        return [];
      }
      return [
        {
          id: post.id,
          title: post.title ?? post.caption?.slice(0, 60) ?? 'Untitled post',
          postType: post.postType,
          accountUsername: post.instagramAccount.username,
          scheduledFor: post.scheduledFor?.toISOString() ?? null,
          attemptNumber: attempt?.attemptNumber ?? 1,
          errorMessage:
            attempt?.errorMessage ??
            (requiresReview
              ? 'Publishing may have completed on Instagram; confirm it before retrying.'
              : null),
          failedAt: (attempt?.startedAt ?? post.updatedAt).toISOString(),
          retryable: !requiresReview,
        },
      ];
    });
  }

  async getPostDetail(
    userId: string,
    contentPostId: string,
  ): Promise<SchedulerPostDetail> {
    const post = await this.getOwnedPost(userId, contentPostId);
    return this.mapPostDetail(post);
  }

  async approvePost(
    userId: string,
    contentPostId: string,
  ): Promise<SchedulerPostDetail> {
    const post = await this.getOwnedPost(userId, contentPostId);
    if (post.status !== PostStatus.PENDING || !post.scheduledFor) {
      throw new BadRequestException('This post is not awaiting approval');
    }

    validateInstagramMediaForPublishing(
      post.postType,
      post.postMedia.map((item) => item.mediaAsset),
    );
    await this.publishQueue.ensureAvailable();

    const result = await this.prisma.contentPost.updateMany({
      where: { id: post.id, status: PostStatus.PENDING },
      data: { status: PostStatus.READY },
    });
    if (result.count !== 1) {
      throw new BadRequestException('This post is no longer awaiting approval');
    }

    try {
      await this.publishQueue.enqueueScheduledPost(post.id, post.scheduledFor);
    } catch (error) {
      await this.prisma.contentPost.updateMany({
        where: { id: post.id, status: PostStatus.READY },
        data: { status: PostStatus.PENDING },
      });
      throw error;
    }

    return this.getPostDetail(userId, contentPostId);
  }

  async updateDraft(
    userId: string,
    contentPostId: string,
    input: {
      action?: UpdateDraftAction;
      scheduledFor?: string;
      title?: string;
      caption?: string;
      metadata?: PostMetadataInput[];
      requiresApproval?: boolean;
      mediaAssetIds?: string[];
    },
  ): Promise<SchedulerPostDetail> {
    const post = await this.getOwnedPost(userId, contentPostId);
    if (post.status !== PostStatus.DRAFT) {
      throw new BadRequestException('Only draft posts can be edited');
    }

    const action = input.action ?? 'DRAFT';
    const next =
      action === 'SCHEDULE'
        ? resolveCreateAction(input, 'SCHEDULE')
        : { scheduledFor: null, status: PostStatus.DRAFT };
    const publishWhenScheduled = next.status === PostStatus.READY;
    const mediaAssetIds = input.mediaAssetIds
      ? [...new Set(input.mediaAssetIds)]
      : post.postMedia.map((item) => item.mediaAsset.id);
    const mediaAssets = input.mediaAssetIds
      ? await this.prisma.mediaAsset.findMany({
          where: { id: { in: mediaAssetIds }, userId },
          select: {
            id: true,
            fileType: true,
            mimeType: true,
            fileSize: true,
            width: true,
            height: true,
            durationSeconds: true,
          },
        })
      : post.postMedia.map((item) => item.mediaAsset);

    if (mediaAssets.length !== mediaAssetIds.length) {
      throw new ForbiddenException(
        'One or more media assets are not available',
      );
    }
    validateInstagramMediaForPostType(post.postType, mediaAssets);
    if (action === 'SCHEDULE') {
      validateInstagramMediaForPublishing(post.postType, mediaAssets);
    }
    if (publishWhenScheduled) {
      await this.publishQueue.ensureAvailable();
    }

    await this.prisma.$transaction(async (tx) => {
      const result = await tx.contentPost.updateMany({
        where: { id: post.id, status: PostStatus.DRAFT },
        data: {
          title: normalizeOptionalText(input.title),
          caption: normalizeOptionalText(input.caption),
          scheduledFor: next.scheduledFor,
          status: next.status,
        },
      });
      if (result.count !== 1) {
        throw new BadRequestException('This draft was already updated');
      }

      if (input.mediaAssetIds) {
        await tx.postMedia.deleteMany({ where: { contentPostId: post.id } });
        if (mediaAssetIds.length) {
          await tx.postMedia.createMany({
            data: mediaAssetIds.map((mediaAssetId, sortOrder) => ({
              contentPostId: post.id,
              mediaAssetId,
              sortOrder,
            })),
          });
        }
      }

      if (input.metadata !== undefined) {
        await this.syncPostMetadataValues(tx, userId, post.id, input.metadata);
      }
    });

    if (publishWhenScheduled && next.scheduledFor) {
      try {
        await this.publishQueue.enqueueScheduledPost(
          post.id,
          next.scheduledFor,
        );
      } catch (error) {
        await this.prisma.contentPost.updateMany({
          where: { id: post.id, status: PostStatus.READY },
          data: { status: PostStatus.DRAFT, scheduledFor: null },
        });
        throw error;
      }
    }

    return this.getPostDetail(userId, contentPostId);
  }

  async updateScheduledPost(
    userId: string,
    contentPostId: string,
    input: {
      title?: string;
      caption?: string;
      metadata?: PostMetadataInput[];
      scheduledFor?: string;
    },
  ): Promise<SchedulerPostDetail> {
    const post = await this.getOwnedPost(userId, contentPostId);
    if (post.status !== PostStatus.READY || !post.scheduledFor) {
      throw new BadRequestException('Only scheduled posts can be edited');
    }
    if (post.igMediaContainerId) {
      throw new ConflictException(
        'Publishing may already have completed on Instagram. Verify the result before editing this post.',
      );
    }

    const nextScheduledFor = input.scheduledFor
      ? parseFutureSchedule(input.scheduledFor)
      : post.scheduledFor;
    const scheduleChanged =
      nextScheduledFor.getTime() !== post.scheduledFor.getTime();

    if (scheduleChanged) {
      await this.publishQueue.ensureAvailable();
      try {
        await this.publishQueue.replaceScheduledPost(post.id, nextScheduledFor);
      } catch (error) {
        try {
          await this.publishQueue.enqueueScheduledPost(
            post.id,
            post.scheduledFor,
          );
        } catch {
          this.logger.error(`Could not restore job for ${post.id}`);
        }
        throw error;
      }
    }

    const data: {
      title?: string | null;
      caption?: string | null;
      scheduledFor?: Date;
    } = {};
    if (input.title !== undefined)
      data.title = normalizeOptionalText(input.title);
    if (input.caption !== undefined) {
      data.caption = normalizeOptionalText(input.caption);
    }
    if (scheduleChanged) data.scheduledFor = nextScheduledFor;

    try {
      await this.prisma.$transaction(async (tx) => {
        const result = await tx.contentPost.updateMany({
          where: { id: post.id, status: PostStatus.READY },
          data,
        });
        if (result.count !== 1) {
          throw new BadRequestException(
            'This scheduled post was already updated',
          );
        }
        if (input.metadata !== undefined) {
          await this.syncPostMetadataValues(
            tx,
            userId,
            post.id,
            input.metadata,
          );
        }
      });
    } catch (error) {
      if (scheduleChanged) {
        await this.restoreScheduledPostJob(
          post.id,
          post.scheduledFor,
          'scheduled post update',
        );
      }
      throw error;
    }

    return this.getPostDetail(userId, contentPostId);
  }

  async updatePostMetadata(
    userId: string,
    contentPostId: string,
    metadata: PostMetadataInput[],
  ): Promise<SchedulerPostDetail> {
    const post = await this.getOwnedPost(userId, contentPostId);
    await this.prisma.$transaction(async (tx) => {
      await this.syncPostMetadataValues(tx, userId, post.id, metadata);
    });

    return this.getPostDetail(userId, contentPostId);
  }

  async retryFailedPost(
    userId: string,
    contentPostId: string,
  ): Promise<SchedulerPostDetail> {
    const post = await this.getOwnedPost(userId, contentPostId);
    const latestAttempt = post.publishAttempts[0];
    if (post.status === PostStatus.READY && post.igMediaContainerId) {
      throw new ConflictException(
        'Publishing may already have completed on Instagram. Verify the result before attempting another publish.',
      );
    }
    if (
      post.status !== PostStatus.READY ||
      !post.scheduledFor ||
      !latestAttempt ||
      latestAttempt.status !== PublishAttemptStatus.FAILED
    ) {
      throw new BadRequestException('This post does not have a failed publish');
    }
    if (post.scheduledFor > new Date()) {
      throw new BadRequestException('This post is not due for publishing yet');
    }

    validateInstagramMediaForPublishing(
      post.postType,
      post.postMedia.map((item) => item.mediaAsset),
    );
    await this.publishQueue.ensureAvailable();
    await this.publishQueue.replaceScheduledPost(post.id, new Date());
    return this.getPostDetail(userId, contentPostId);
  }

  async deletePost(userId: string, contentPostId: string): Promise<void> {
    const post = await this.getOwnedPost(userId, contentPostId);
    if (post.status === PostStatus.PUBLISHED) {
      throw new BadRequestException('Published posts cannot be deleted here');
    }
    if (post.status === PostStatus.READY && post.igMediaContainerId) {
      throw new ConflictException(
        'Publishing may already have completed on Instagram. Verify the result before deleting this post.',
      );
    }

    if (post.status === PostStatus.READY) {
      await this.publishQueue.ensureAvailable();
      await this.publishQueue.removeScheduledPost(post.id);
    }

    try {
      const result = await this.prisma.contentPost.deleteMany({
        where: {
          id: post.id,
          status: post.status,
          instagramAccount: { userId, isActive: true },
        },
      });
      if (result.count !== 1) {
        throw new BadRequestException('This post was already updated');
      }
    } catch (error) {
      if (post.status === PostStatus.READY && post.scheduledFor) {
        await this.restoreScheduledPostJob(
          post.id,
          post.scheduledFor,
          'scheduled post deletion',
        );
      }
      throw error;
    }
  }

  private async syncPostMetadataValues(
    tx: Prisma.TransactionClient,
    userId: string,
    contentPostId: string,
    input: PostMetadataInput[],
  ) {
    const entries = normalizePostMetadataInput(input);
    const values = await this.resolveMetadataValues(tx, userId, entries);

    await tx.contentPostMetadataValue.deleteMany({
      where: { contentPostId },
    });
    if (!values.length) return;

    await tx.contentPostMetadataValue.createMany({
      data: values.map((item) => ({
        contentPostId,
        fieldId: item.fieldId,
        value: item.value,
      })),
    });
  }

  private async resolveMetadataValues(
    tx: Prisma.TransactionClient,
    userId: string,
    entries: NormalizedMetadataInput[],
  ): Promise<ResolvedMetadataValue[]> {
    if (!entries.length) return [];

    const existingFields = await tx.contentMetadataField.findMany({
      where: { userId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, label: true, sortOrder: true },
    });
    const fieldById = new Map(existingFields.map((field) => [field.id, field]));
    const fieldByLabel = new Map(
      existingFields.map((field) => [field.label.toLowerCase(), field]),
    );
    let nextSortOrder = existingFields.reduce(
      (highest, field) => Math.max(highest, field.sortOrder),
      -1,
    );

    const valueByFieldId = new Map<string, string>();
    for (const entry of entries) {
      let field = entry.fieldId ? fieldById.get(entry.fieldId) : undefined;
      if (entry.fieldId && !field) {
        throw new ForbiddenException('Metadata field is not available');
      }

      if (!field && entry.label) {
        field = fieldByLabel.get(entry.label.toLowerCase());
      }

      if (!field && entry.label) {
        if (fieldById.size >= MAX_METADATA_FIELDS) {
          throw new BadRequestException(
            `Metadata supports up to ${MAX_METADATA_FIELDS} fields per user`,
          );
        }

        field = await tx.contentMetadataField.create({
          data: {
            userId,
            label: entry.label,
            sortOrder: ++nextSortOrder,
          },
          select: { id: true, label: true, sortOrder: true },
        });
        fieldById.set(field.id, field);
        fieldByLabel.set(field.label.toLowerCase(), field);
      }

      if (!field) continue;
      valueByFieldId.set(field.id, entry.value);
    }

    return [...valueByFieldId.entries()]
      .filter(([, value]) => value.length > 0)
      .map(([fieldId, value]) => ({ fieldId, value }));
  }

  private async restoreScheduledPostJob(
    contentPostId: string,
    scheduledFor: Date,
    operation: string,
  ) {
    try {
      await this.publishQueue.replaceScheduledPost(contentPostId, scheduledFor);
    } catch (error) {
      this.logger.error(
        `Could not restore queued job after ${operation} for ${contentPostId}: ${readMessage(error)}`,
      );
    }
  }

  private async getOwnedPost(userId: string, contentPostId: string) {
    const post = await this.prisma.contentPost.findFirst({
      where: {
        id: contentPostId,
        instagramAccount: { userId, isActive: true },
      },
      include: POST_DETAIL_INCLUDE,
    });

    if (!post) throw new NotFoundException('Post was not found');
    return post;
  }

  private async mapPostDetail(
    post: PostDetailRecord,
  ): Promise<SchedulerPostDetail> {
    const localMedia = await Promise.all(
      post.postMedia.map(async ({ mediaAsset }) => {
        const previewUrl = await this.media.createSignedPreviewUrl(
          mediaAsset.storagePath,
        );
        return {
          id: mediaAsset.id,
          fileType: mediaAsset.fileType,
          mimeType: mediaAsset.mimeType,
          fileSize: mediaAsset.fileSize,
          width: mediaAsset.width,
          height: mediaAsset.height,
          durationSeconds: mediaAsset.durationSeconds,
          previewUrl,
          sourceUrl: previewUrl,
          thumbnailUrl: null,
        };
      }),
    );
    const instagramMedia = buildInstagramMediaPreview(post);
    const media =
      localMedia.length > 0
        ? localMedia
        : instagramMedia
          ? [instagramMedia]
          : [];
    const latestAnalytics = post.postAnalytics[0] ?? null;
    const latestAttempt = post.publishAttempts[0];
    const requiresReview =
      post.status === PostStatus.READY && !!post.igMediaContainerId;
    const latestFailure =
      latestAttempt?.status === PublishAttemptStatus.FAILED || requiresReview
        ? {
            id: latestAttempt?.id ?? `review:${post.id}`,
            attemptNumber: latestAttempt?.attemptNumber ?? 1,
            errorMessage:
              latestAttempt?.errorMessage ??
              (requiresReview
                ? 'Publishing may have completed on Instagram; confirm it before retrying.'
                : null),
            startedAt: (
              latestAttempt?.startedAt ?? post.updatedAt
            ).toISOString(),
            retryable: !requiresReview,
          }
        : null;
    const metadataFields = await this.listMetadataFields(
      post.instagramAccount.userId,
    );
    const comments = await this.readPostComments(post);

    return {
      id: post.id,
      title: post.title,
      caption: post.caption,
      metadataFields,
      metadata: readPostMetadataValues(post.metadataValues),
      postType: post.postType,
      status: POST_STATUS_TO_UI[post.status],
      accountId: post.instagramAccount.id,
      accountUsername: post.instagramAccount.username,
      scheduledFor: post.scheduledFor?.toISOString() ?? null,
      publishedAt: post.publishedAt?.toISOString() ?? null,
      createdAt: post.createdAt.toISOString(),
      permalink: post.igPermalink,
      media,
      analytics: latestAnalytics
        ? {
            views: latestAnalytics.impressions,
            reach: latestAnalytics.reach,
            likes: latestAnalytics.likeCount,
            comments: latestAnalytics.commentsCount,
            shares: latestAnalytics.sharesCount,
            saves: latestAnalytics.savesCount,
            interactions: latestAnalytics.engagement,
            fetchedAt: latestAnalytics.fetchedAt.toISOString(),
          }
        : null,
      comments,
      latestFailure,
    };
  }

  private async readPostComments(
    post: PostDetailRecord,
  ): Promise<SchedulerPostDetail['comments']> {
    const cachedItems = post.postComments.map(mapStoredPostComment);
    const cachedSyncedAt =
      post.commentsSyncedAt?.toISOString() ??
      latestCommentSyncedAt(cachedItems);

    if (!post.igMediaId) {
      return {
        items: cachedItems,
        syncedAt: cachedSyncedAt,
        status: cachedItems.length ? 'cached' : 'not_available',
        errorMessage: null,
      };
    }

    if (hasFreshCommentSync(post.commentsSyncedAt)) {
      return {
        items: cachedItems,
        syncedAt: cachedSyncedAt,
        status: 'synced',
        errorMessage: null,
      };
    }

    try {
      return await this.syncPostComments(post);
    } catch (error) {
      this.logger.warn(
        `Instagram comments sync skipped for ${post.id}: ${readMessage(error)}`,
      );
      return {
        items: cachedItems,
        syncedAt: cachedSyncedAt,
        status: cachedItems.length ? 'cached' : 'unavailable',
        errorMessage: formatCommentSyncError(error),
      };
    }
  }

  private async syncPostComments(
    post: PostDetailRecord,
  ): Promise<SchedulerPostDetail['comments']> {
    if (!post.igMediaId) {
      return {
        items: post.postComments.map(mapStoredPostComment),
        syncedAt: post.commentsSyncedAt?.toISOString() ?? null,
        status: 'not_available',
        errorMessage: null,
      };
    }

    const fetchedAt = new Date();
    const fetchedComments = await this.fetchInstagramComments(
      post.igMediaId,
      decryptSecret(post.instagramAccount.accessTokenEncrypted),
    );
    const comments = dedupeFetchedComments(fetchedComments);

    await this.prisma.$transaction(async (tx) => {
      await tx.postComment.deleteMany({
        where: { contentPostId: post.id },
      });

      if (comments.length) {
        await tx.postComment.createMany({
          data: comments.map((comment) => ({
            id: randomUUID(),
            contentPostId: post.id,
            igCommentId: comment.instagramCommentId,
            parentIgCommentId: comment.parentInstagramCommentId,
            username: comment.username,
            text: comment.text,
            likeCount: comment.likeCount,
            hidden: comment.hidden,
            timestamp: comment.timestamp,
            syncedAt: fetchedAt,
            createdAt: fetchedAt,
            updatedAt: fetchedAt,
          })),
        });
      }

      await tx.contentPost.update({
        where: { id: post.id },
        data: { commentsSyncedAt: fetchedAt },
      });
    });

    return {
      items: comments.map((comment) =>
        mapFetchedPostComment(comment, fetchedAt),
      ),
      syncedAt: fetchedAt.toISOString(),
      status: 'synced',
      errorMessage: null,
    };
  }

  private async fetchInstagramComments(
    igMediaId: string,
    accessToken: string,
  ): Promise<FetchedInstagramComment[]> {
    const url = this.createGraphUrl(`${igMediaId}/comments`);
    url.searchParams.set('fields', COMMENT_FIELDS);
    url.searchParams.set('limit', String(COMMENT_SYNC_LIMIT));
    url.searchParams.set('access_token', accessToken);

    const response = await fetch(url);
    const body = (await response.json().catch(() => ({}))) as
      | InstagramCommentsResponse
      | undefined;

    if (!response.ok || body?.error) {
      throw new Error(
        body?.error?.message ??
          `Instagram comments request failed with status ${response.status}`,
      );
    }

    return flattenInstagramComments(body?.data ?? []);
  }

  private createGraphUrl(path: string) {
    return new URL(`${this.getGraphApiBaseUrl()}/${path}`);
  }

  private getGraphApiBaseUrl() {
    const baseUrl =
      this.config.get<string>('INSTAGRAM_GRAPH_API_BASE_URL')?.trim() ||
      'https://graph.instagram.com';
    return `${baseUrl.replace(/\/$/, '')}/${this.getGraphApiVersion()}`;
  }

  private getGraphApiVersion() {
    return (
      this.config.get<string>('INSTAGRAM_GRAPH_API_VERSION')?.trim() ||
      this.config.get<string>('META_GRAPH_API_VERSION')?.trim() ||
      DEFAULT_GRAPH_API_VERSION
    );
  }
}

function buildInstagramMediaPreview(
  post: PostDetailRecord,
): SchedulerPostDetail['media'][number] | null {
  const sourceUrl = post.igMediaUrl ?? null;
  const thumbnailUrl = post.igThumbnailUrl ?? null;
  const previewUrl = thumbnailUrl ?? sourceUrl;

  if (!previewUrl) return null;

  const fileType = inferInstagramPreviewType(post);

  return {
    id: `${post.id}:instagram-preview`,
    fileType,
    mimeType: fileType === MediaType.VIDEO ? 'video/mp4' : 'image/jpeg',
    fileSize: 0,
    width: null,
    height: null,
    durationSeconds: null,
    previewUrl,
    sourceUrl,
    thumbnailUrl,
  };
}

function inferInstagramPreviewType(post: PostDetailRecord): MediaType {
  if (post.postType === 'REEL') return MediaType.VIDEO;
  if (post.igThumbnailUrl && post.igMediaUrl) return MediaType.VIDEO;
  if (post.igMediaUrl && /\.(mp4|mov)(?:$|\?)/i.test(post.igMediaUrl)) {
    return MediaType.VIDEO;
  }
  return MediaType.IMAGE;
}

function flattenInstagramComments(
  comments: InstagramCommentResponse[],
): FetchedInstagramComment[] {
  return comments.flatMap((comment) => [
    ...mapInstagramComment(comment, null),
    ...((comment.replies?.data ?? []).flatMap((reply) =>
      mapInstagramComment(reply, comment.id ?? null),
    ) ?? []),
  ]);
}

function mapInstagramComment(
  comment: InstagramCommentResponse,
  parentInstagramCommentId: string | null,
): FetchedInstagramComment[] {
  const instagramCommentId = normalizeOptionalText(comment.id);
  if (!instagramCommentId) return [];

  return [
    {
      instagramCommentId,
      parentInstagramCommentId,
      username: normalizeOptionalText(comment.username),
      text: normalizeOptionalText(comment.text),
      likeCount: readNumber(comment.like_count),
      hidden: typeof comment.hidden === 'boolean' ? comment.hidden : null,
      timestamp: parseNullableDate(comment.timestamp),
    },
  ];
}

function dedupeFetchedComments(
  comments: FetchedInstagramComment[],
): FetchedInstagramComment[] {
  const byId = new Map<string, FetchedInstagramComment>();
  for (const comment of comments) {
    byId.set(comment.instagramCommentId, comment);
  }
  return [...byId.values()].sort(
    (left, right) =>
      (right.timestamp?.getTime() ?? 0) - (left.timestamp?.getTime() ?? 0),
  );
}

function mapStoredPostComment(
  comment: PostDetailRecord['postComments'][number],
): SchedulerPostComment {
  return {
    id: comment.id,
    instagramCommentId: comment.igCommentId,
    parentInstagramCommentId: comment.parentIgCommentId,
    username: comment.username,
    text: comment.text,
    likeCount: comment.likeCount,
    hidden: comment.hidden,
    timestamp: comment.timestamp?.toISOString() ?? null,
    syncedAt: comment.syncedAt.toISOString(),
  };
}

function mapFetchedPostComment(
  comment: FetchedInstagramComment,
  syncedAt: Date,
): SchedulerPostComment {
  return {
    id: comment.instagramCommentId,
    instagramCommentId: comment.instagramCommentId,
    parentInstagramCommentId: comment.parentInstagramCommentId,
    username: comment.username,
    text: comment.text,
    likeCount: comment.likeCount,
    hidden: comment.hidden,
    timestamp: comment.timestamp?.toISOString() ?? null,
    syncedAt: syncedAt.toISOString(),
  };
}

function latestCommentSyncedAt(comments: SchedulerPostComment[]) {
  return (
    comments
      .map((comment) => comment.syncedAt)
      .filter(Boolean)
      .sort()
      .at(-1) ?? null
  );
}

function hasFreshCommentSync(value: Date | null) {
  return value ? Date.now() - value.getTime() < COMMENT_SYNC_TTL_MS : false;
}

function formatCommentSyncError(error: unknown) {
  const message = readMessage(error);
  if (/permission|capability|scope|oauth|access token/i.test(message)) {
    return 'Reconnect Instagram with comment management permission to sync comment text.';
  }
  return 'Could not sync Instagram comments right now.';
}

function parseNullableDate(value: string | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function readNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }

  return null;
}

function readMessage(error: unknown) {
  return error instanceof Error && error.message
    ? error.message
    : 'Unknown error';
}

function normalizeOptionalText(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

type NormalizedMetadataInput = {
  fieldId: string | null;
  label: string | null;
  value: string;
};

type NormalizedMetadataFieldDefinition = {
  fieldId: string | null;
  label: string;
};

type ResolvedMetadataValue = {
  fieldId: string;
  value: string;
};

function mapMetadataField(field: {
  id: string;
  label: string;
  sortOrder: number;
}): SchedulerMetadataField {
  return {
    id: field.id,
    label: field.label,
    sortOrder: field.sortOrder,
  };
}

function normalizePostMetadataInput(
  input: PostMetadataInput[] | undefined,
): NormalizedMetadataInput[] {
  if (!input?.length) return [];
  if (input.length > MAX_METADATA_FIELDS) {
    throw new BadRequestException(
      `Metadata supports up to ${MAX_METADATA_FIELDS} fields per user`,
    );
  }

  return input.flatMap((item) => {
    const fieldId = item.fieldId?.trim() || null;
    const label = item.label?.trim() || null;
    const value = item.value?.trim() ?? '';

    if (!fieldId && !label && !value) return [];
    if (!fieldId && !label) {
      throw new BadRequestException('Metadata fields need a label');
    }
    if (label && label.length > MAX_METADATA_KEY_LENGTH) {
      throw new BadRequestException(
        `Metadata labels must be ${MAX_METADATA_KEY_LENGTH} characters or fewer`,
      );
    }
    if (value.length > MAX_METADATA_VALUE_LENGTH) {
      throw new BadRequestException(
        `Metadata values must be ${MAX_METADATA_VALUE_LENGTH} characters or fewer`,
      );
    }

    return [{ fieldId, label, value }];
  });
}

function normalizeMetadataFieldDefinitions(
  input: PostMetadataInput[] | undefined,
): NormalizedMetadataFieldDefinition[] {
  if (!input?.length) return [];
  if (input.length > MAX_METADATA_FIELDS) {
    throw new BadRequestException(
      `Metadata supports up to ${MAX_METADATA_FIELDS} fields per user`,
    );
  }

  const seenLabels = new Set<string>();
  return input.flatMap((item) => {
    const fieldId = item.fieldId?.trim() || null;
    const label = item.label?.trim() || null;
    const value = item.value?.trim() ?? '';

    if (!fieldId && !label && !value) return [];
    if (!label) {
      throw new BadRequestException('Metadata fields need a label');
    }
    if (label.length > MAX_METADATA_KEY_LENGTH) {
      throw new BadRequestException(
        `Metadata labels must be ${MAX_METADATA_KEY_LENGTH} characters or fewer`,
      );
    }

    const normalizedLabel = label.toLowerCase();
    if (seenLabels.has(normalizedLabel)) {
      throw new BadRequestException('Metadata labels must be unique');
    }
    seenLabels.add(normalizedLabel);

    return [{ fieldId, label }];
  });
}

function readPostMetadataValues(
  values: { fieldId: string; value: string }[],
): PostMetadata {
  const metadata: PostMetadata = {};
  for (const item of values) {
    metadata[item.fieldId] = item.value;
  }
  return metadata;
}

function parseFutureSchedule(value: string): Date {
  const scheduledFor = new Date(value);
  if (Number.isNaN(scheduledFor.getTime())) {
    throw new BadRequestException('Invalid scheduledFor');
  }
  if (scheduledFor <= new Date()) {
    throw new BadRequestException('scheduledFor must be in the future');
  }
  return scheduledFor;
}

function resolveCreateAction(
  input: {
    scheduledFor?: string;
    requiresApproval?: boolean;
  },
  action: CreateEventAction,
): { scheduledFor: Date | null; status: PostStatus } {
  if (action === 'DRAFT') {
    return { scheduledFor: null, status: PostStatus.DRAFT };
  }

  if (action === 'POST_NOW') {
    return { scheduledFor: new Date(), status: PostStatus.READY };
  }

  if (!input.scheduledFor) {
    throw new BadRequestException('scheduledFor is required');
  }

  const scheduledFor = parseFutureSchedule(input.scheduledFor);

  return {
    scheduledFor,
    status: input.requiresApproval ? PostStatus.PENDING : PostStatus.READY,
  };
}
