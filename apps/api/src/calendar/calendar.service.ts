import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { GoogleService } from '../integrations/google/google.service.js';
import { PostStatus, type PostType } from '@social-manager/database';

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
      throw new NotFoundException('Invalid date range');
    }

    const accounts = await this.prisma.instagramAccount.findMany({
      where: { userId },
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

    events.sort((a, b) => a.start.localeCompare(b.start));

    return { googleConnected, events };
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
    },
  ): Promise<CalendarEvent> {
    const account = await this.prisma.instagramAccount.findUnique({
      where: { id: input.instagramAccountId },
      select: { id: true, userId: true, username: true },
    });
    if (!account) throw new NotFoundException('Instagram account not found');
    if (account.userId !== userId) {
      throw new ForbiddenException('Account belongs to another user');
    }

    const scheduledFor = new Date(input.scheduledFor);
    if (Number.isNaN(scheduledFor.getTime())) {
      throw new NotFoundException('Invalid scheduledFor');
    }

    const status: PostStatus = input.requiresApproval
      ? PostStatus.PENDING
      : PostStatus.READY;

    const post = await this.prisma.contentPost.create({
      data: {
        instagramAccountId: account.id,
        postType: input.postType,
        scheduledFor,
        status,
        title: input.title,
        caption: input.caption,
      },
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
}
