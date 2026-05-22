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

export type CalendarEventSource = 'scheduled_post' | 'google';

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
      scheduledFor: string;
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

    const scheduledFor = new Date(input.scheduledFor);
    if (Number.isNaN(scheduledFor.getTime())) {
      throw new BadRequestException('Invalid scheduledFor');
    }
    if (scheduledFor <= new Date()) {
      throw new BadRequestException('scheduledFor must be in the future');
    }

    const status: PostStatus = input.requiresApproval
      ? PostStatus.PENDING
      : PostStatus.READY;
    const mediaAssetIds = [...new Set(input.mediaAssetIds ?? [])];
    const mediaAssets = mediaAssetIds.length
      ? await this.prisma.mediaAsset.findMany({
          where: { id: { in: mediaAssetIds }, userId },
          select: { id: true, fileType: true },
        })
      : [];

    if (mediaAssets.length !== mediaAssetIds.length) {
      throw new ForbiddenException(
        'One or more media assets are not available',
      );
    }
    validateMediaForPostType(input.postType, mediaAssets);

    const post = await this.prisma.$transaction(async (tx) => {
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

    return {
      id: `post:${post.id}`,
      source: 'scheduled_post',
      title: post.title ?? post.caption?.slice(0, 60) ?? 'Untitled post',
      start: scheduledFor.toISOString(),
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
