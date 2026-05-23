import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  GoogleService,
  type GoogleCalendarEvent,
} from '../integrations/google/google.service.js';
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
import type { UpdateDraftAction } from './dto/update-draft.dto.js';

export type CalendarEventSource = 'scheduled_post' | 'google';
type CreateEventAction = 'SCHEDULE' | 'POST_NOW' | 'DRAFT';
const FEED_IMAGE_MIN_ASPECT = 4 / 5;
const FEED_IMAGE_MAX_ASPECT = 1.91;

export type CalendarEvent = {
  id: string;
  source: CalendarEventSource;
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

export type CalendarPayload = {
  googleConnected: boolean;
  events: CalendarEvent[];
};

const POST_DETAIL_INCLUDE = {
  instagramAccount: {
    select: {
      id: true,
      userId: true,
      username: true,
      isActive: true,
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
} satisfies Prisma.ContentPostInclude;

type PostDetailRecord = Prisma.ContentPostGetPayload<{
  include: typeof POST_DETAIL_INCLUDE;
}>;

export type CalendarPostDetail = {
  id: string;
  title: string | null;
  caption: string | null;
  postType: PostType;
  status: 'published' | 'scheduled' | 'pending' | 'draft';
  accountId: string;
  accountUsername: string;
  scheduledFor: string | null;
  publishedAt: string | null;
  createdAt: string;
  media: {
    id: string;
    fileType: MediaType;
    mimeType: string;
    fileSize: number;
    width: number | null;
    height: number | null;
    durationSeconds: number | null;
    previewUrl: string | null;
  }[];
  latestFailure: {
    id: string;
    attemptNumber: number;
    errorMessage: string | null;
    startedAt: string;
    retryable: boolean;
  } | null;
};

export type CalendarWorkItem = {
  id: string;
  title: string;
  postType: PostType;
  status: 'pending' | 'draft';
  accountUsername: string;
  scheduledFor: string | null;
  createdAt: string;
};

export type CalendarFailedPost = {
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
export class CalendarService {
  private readonly logger = new Logger(CalendarService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly google: GoogleService,
    private readonly publisher: InstagramPublisherService,
    private readonly publishQueue: PublishQueueService,
    private readonly media: MediaService,
  ) {}

  async listEvents(
    userId: string,
    fromDate: Date,
    toDate: Date,
  ): Promise<CalendarPayload> {
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

    const googleConnected = await this.google.isConnected(userId);
    const googleEvents = googleConnected
      ? await this.getGoogleEvents(userId, fromDate, toDate)
      : [];
    const currentGoogleConnected = googleConnected
      ? await this.google.isConnected(userId)
      : false;

    const events: CalendarEvent[] = scheduledPosts.map<CalendarEvent>(
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
    events.push(...googleEvents.map(mapGoogleEvent).filter(isCalendarEvent));

    events.sort((a, b) => a.start.localeCompare(b.start));

    return { googleConnected: currentGoogleConnected, events };
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
      requiresApproval?: boolean;
      mediaAssetIds?: string[];
    },
  ): Promise<CalendarEvent> {
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
          select: { id: true, fileType: true, width: true, height: true },
        })
      : [];

    if (mediaAssets.length !== mediaAssetIds.length) {
      throw new ForbiddenException(
        'One or more media assets are not available',
      );
    }
    validateMediaForPostType(input.postType, mediaAssets);
    const publishWhenScheduled =
      action === 'SCHEDULE' && status === PostStatus.READY && !!scheduledFor;
    if (action === 'POST_NOW' || action === 'SCHEDULE') {
      validateMediaForPublishing(input.postType, mediaAssets);
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
    pending: CalendarWorkItem[];
    drafts: CalendarWorkItem[];
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

  async listFailedPosts(userId: string): Promise<CalendarFailedPost[]> {
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
  ): Promise<CalendarPostDetail> {
    const post = await this.getOwnedPost(userId, contentPostId);
    return this.mapPostDetail(post);
  }

  async approvePost(
    userId: string,
    contentPostId: string,
  ): Promise<CalendarPostDetail> {
    const post = await this.getOwnedPost(userId, contentPostId);
    if (post.status !== PostStatus.PENDING || !post.scheduledFor) {
      throw new BadRequestException('This post is not awaiting approval');
    }

    validateMediaForPublishing(
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
      requiresApproval?: boolean;
      mediaAssetIds?: string[];
    },
  ): Promise<CalendarPostDetail> {
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
          select: { id: true, fileType: true, width: true, height: true },
        })
      : post.postMedia.map((item) => item.mediaAsset);

    if (mediaAssets.length !== mediaAssetIds.length) {
      throw new ForbiddenException(
        'One or more media assets are not available',
      );
    }
    validateMediaForPostType(post.postType, mediaAssets);
    if (action === 'SCHEDULE') {
      validateMediaForPublishing(post.postType, mediaAssets);
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
      scheduledFor?: string;
    },
  ): Promise<CalendarPostDetail> {
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
      const result = await this.prisma.contentPost.updateMany({
        where: { id: post.id, status: PostStatus.READY },
        data,
      });
      if (result.count !== 1) {
        throw new BadRequestException(
          'This scheduled post was already updated',
        );
      }
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

  async retryFailedPost(
    userId: string,
    contentPostId: string,
  ): Promise<CalendarPostDetail> {
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

    validateMediaForPublishing(
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
  ): Promise<CalendarPostDetail> {
    const media = await Promise.all(
      post.postMedia.map(async ({ mediaAsset }) => ({
        id: mediaAsset.id,
        fileType: mediaAsset.fileType,
        mimeType: mediaAsset.mimeType,
        fileSize: mediaAsset.fileSize,
        width: mediaAsset.width,
        height: mediaAsset.height,
        durationSeconds: mediaAsset.durationSeconds,
        previewUrl: await this.media.createSignedPreviewUrl(
          mediaAsset.storagePath,
        ),
      })),
    );
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

    return {
      id: post.id,
      title: post.title,
      caption: post.caption,
      postType: post.postType,
      status: POST_STATUS_TO_UI[post.status],
      accountId: post.instagramAccount.id,
      accountUsername: post.instagramAccount.username,
      scheduledFor: post.scheduledFor?.toISOString() ?? null,
      publishedAt: post.publishedAt?.toISOString() ?? null,
      createdAt: post.createdAt.toISOString(),
      media,
      latestFailure,
    };
  }

  private async getGoogleEvents(
    userId: string,
    fromDate: Date,
    toDate: Date,
  ): Promise<GoogleCalendarEvent[]> {
    try {
      return await this.google.getCalendarEvents(userId, fromDate, toDate);
    } catch (err) {
      this.logger.warn(
        `Google Calendar events skipped for ${userId}: ${(err as Error).message}`,
      );
      return [];
    }
  }
}

function mapGoogleEvent(event: GoogleCalendarEvent): CalendarEvent | null {
  const start = normalizeGoogleDate(event.start, event.allDay);
  if (!start) return null;

  return {
    id: `google:${event.id || `${start}:${event.summary}`}`,
    source: 'google',
    title: event.summary || '(no title)',
    start,
    end: normalizeGoogleDate(event.end, event.allDay),
    allDay: event.allDay,
    status: null,
    postType: null,
    accountId: null,
    accountUsername: null,
    caption: null,
  };
}

function normalizeGoogleDate(
  value: string | null,
  allDay: boolean,
): string | null {
  if (!value) return null;
  if (allDay && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return `${value}T00:00:00`;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function isCalendarEvent(event: CalendarEvent | null): event is CalendarEvent {
  return event !== null;
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

function validateMediaForPostType(
  postType: PostType,
  mediaAssets: { fileType: MediaType }[],
) {
  if (mediaAssets.length === 0) return;
  if (postType === 'REEL' && mediaAssets.some((m) => m.fileType !== 'VIDEO')) {
    throw new BadRequestException('Reels require a video upload');
  }
  if (postType !== 'CAROUSEL' && mediaAssets.length > 1) {
    throw new BadRequestException('Only carousel posts can use multiple files');
  }
}

function validateMediaForPublishing(
  postType: PostType,
  mediaAssets: {
    fileType: MediaType;
    width?: number | null;
    height?: number | null;
  }[],
) {
  if (mediaAssets.length === 0) {
    throw new BadRequestException('Add media before publishing');
  }
  if (postType === 'CAROUSEL' && mediaAssets.length < 2) {
    throw new BadRequestException('Carousel posts need at least 2 files');
  }
  if (postType === 'FEED' && mediaAssets[0]?.fileType !== 'IMAGE') {
    throw new BadRequestException('Feed posts require an image upload');
  }

  if (postType === 'FEED' || postType === 'CAROUSEL') {
    const unsupportedImage = mediaAssets.find((asset) => {
      if (asset.fileType !== 'IMAGE' || !asset.width || !asset.height) {
        return false;
      }
      const aspect = asset.width / asset.height;
      return aspect < FEED_IMAGE_MIN_ASPECT || aspect > FEED_IMAGE_MAX_ASPECT;
    });

    if (unsupportedImage) {
      throw new BadRequestException(
        'Instagram feed images must be between 4:5 and 1.91:1',
      );
    }
  }
}
