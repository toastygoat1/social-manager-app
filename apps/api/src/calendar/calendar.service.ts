import {
  BadRequestException,
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
import { MediaType, PostStatus, type PostType } from '@social-manager/database';
import { InstagramPublisherService } from '../publishing/instagram-publisher.service.js';
import { PublishQueueService } from '../queue/publish-queue.service.js';

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
  status: 'published' | 'pending' | 'draft' | null;
  postType: PostType | null;
  accountId: string | null;
  accountUsername: string | null;
  caption: string | null;
};

export type CalendarPayload = {
  googleConnected: boolean;
  events: CalendarEvent[];
};

const POST_STATUS_TO_UI: Record<PostStatus, 'published' | 'pending' | 'draft'> =
  {
    DRAFT: 'draft',
    PENDING: 'pending',
    READY: 'pending',
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
    if (action === 'POST_NOW' || publishWhenScheduled) {
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

      if (publishWhenScheduled && scheduledFor) {
        await this.publishQueue.enqueueScheduledPost(created.id, scheduledFor);
      }

      return created;
    });

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

  const scheduledFor = new Date(input.scheduledFor);
  if (Number.isNaN(scheduledFor.getTime())) {
    throw new BadRequestException('Invalid scheduledFor');
  }
  if (scheduledFor <= new Date()) {
    throw new BadRequestException('scheduledFor must be in the future');
  }

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
    throw new BadRequestException('Add media before posting now');
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
