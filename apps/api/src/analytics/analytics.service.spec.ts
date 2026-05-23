import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { MediaType, PostStatus } from '@social-manager/database';
import { MediaService } from '../media/media.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AnalyticsService } from './analytics.service.js';

type AsyncFn = (...args: unknown[]) => Promise<unknown>;

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let prisma: {
    instagramAccount: { findMany: jest.Mock<AsyncFn> };
    contentPost: { findMany: jest.Mock<AsyncFn> };
  };
  let media: { createSignedPreviewUrl: jest.Mock<AsyncFn> };

  beforeEach(async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-05-23T10:00:00Z'));

    prisma = {
      instagramAccount: { findMany: jest.fn<AsyncFn>() },
      contentPost: { findMany: jest.fn<AsyncFn>() },
    };
    media = {
      createSignedPreviewUrl: jest.fn<AsyncFn>(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: PrismaService, useValue: prisma },
        { provide: MediaService, useValue: media },
      ],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns empty analytics without querying posts when no accounts are connected', async () => {
    prisma.instagramAccount.findMany.mockResolvedValue([]);

    const overview = await service.getOverview('user-1');

    expect(prisma.contentPost.findMany).not.toHaveBeenCalled();
    expect(overview.accounts).toEqual([]);
    expect(overview.statGrid).toEqual([
      {
        id: 'comments',
        title: 'Total Comments',
        value: null,
        delta: null,
        trend: null,
      },
      {
        id: 'shares',
        title: 'Total Shared',
        value: null,
        delta: null,
        trend: null,
      },
      {
        id: 'saves',
        title: 'Total Saves',
        value: null,
        delta: null,
        trend: null,
      },
      {
        id: 'likes',
        title: 'Total Likes',
        value: null,
        delta: null,
        trend: null,
      },
    ]);
    expect(overview.contentCalendar.label).toBe('May 2026');
  });

  it('aggregates latest post analytics into stats, recent posts, distribution, and table rows', async () => {
    const currentPost = makePost({
      id: 'post-1',
      likeCount: 20,
      commentsCount: 8,
      sharesCount: 2,
      savesCount: 5,
      impressions: 120,
    });
    const previousPost = makePost({
      id: 'post-previous',
      likeCount: 12,
      commentsCount: 3,
      sharesCount: 4,
      savesCount: 1,
      impressions: 80,
    });

    prisma.instagramAccount.findMany.mockResolvedValue([
      {
        id: 'account-1',
        username: 'ambacafe',
        accountType: 'BUSINESS',
        avatarUrl: 'https://example.test/avatar.jpg',
      },
    ]);
    prisma.contentPost.findMany
      .mockResolvedValueOnce([currentPost])
      .mockResolvedValueOnce([previousPost])
      .mockResolvedValueOnce([currentPost])
      .mockResolvedValueOnce([currentPost]);
    media.createSignedPreviewUrl.mockResolvedValue(
      'https://example.test/preview',
    );

    const overview = await service.getOverview('user-1', { range: '30d' });

    expect(overview.accounts).toEqual([
      {
        id: 'account-1',
        name: '@ambacafe',
        platform: 'Instagram',
        avatarUrl: 'https://example.test/avatar.jpg',
        tone: 'blue',
      },
    ]);
    expect(overview.statGrid).toEqual([
      {
        id: 'comments',
        title: 'Total Comments',
        value: 8,
        delta: 5,
        trend: 'up',
      },
      {
        id: 'shares',
        title: 'Total Shared',
        value: 2,
        delta: 2,
        trend: 'down',
      },
      {
        id: 'saves',
        title: 'Total Saves',
        value: 5,
        delta: 4,
        trend: 'up',
      },
      {
        id: 'likes',
        title: 'Total Likes',
        value: 20,
        delta: 8,
        trend: 'up',
      },
    ]);
    expect(overview.recentPosts[0]).toMatchObject({
      id: 'post-1',
      mediaUrl: 'https://example.test/preview',
      badge: { label: 'Post', color: 'var(--chart-3)' },
    });
    expect(overview.distribution).toEqual([
      {
        label: 'Post',
        value: 1,
        percentage: 100,
        color: 'var(--chart-3)',
      },
    ]);
    expect(overview.contentRows[0]).toMatchObject({
      id: 'post-1',
      account: {
        name: '@ambacafe',
        avatarUrl: 'https://example.test/avatar.jpg',
      },
      views: 120,
      likes: 20,
      comments: 8,
      shares: 2,
      media: 'Picture',
      mediaItems: [
        {
          id: 'post-1-asset',
          kind: MediaType.IMAGE,
          label: 'Picture',
          previewUrl: 'https://example.test/preview',
          mimeType: 'image/png',
        },
      ],
    });
  });
});

function makePost(input: {
  id: string;
  likeCount: number;
  commentsCount: number;
  sharesCount: number;
  savesCount: number;
  impressions: number;
}) {
  return {
    id: input.id,
    instagramAccountId: 'account-1',
    title: 'Launch post',
    caption: 'A real caption',
    postType: 'FEED',
    status: PostStatus.PUBLISHED,
    scheduledFor: null,
    publishedAt: new Date('2026-05-20T08:00:00Z'),
    createdAt: new Date('2026-05-19T08:00:00Z'),
    updatedAt: new Date('2026-05-20T08:00:00Z'),
    igMediaId: 'ig-media-1',
    igMediaContainerId: null,
    igPermalink: null,
    isAiGenerated: false,
    instagramAccount: {
      id: 'account-1',
      username: 'ambacafe',
      accountType: 'BUSINESS',
      avatarUrl: 'https://example.test/avatar.jpg',
    },
    postAnalytics: [
      {
        id: `${input.id}-analytics`,
        contentPostId: input.id,
        fetchedAt: new Date('2026-05-21T08:00:00Z'),
        likeCount: input.likeCount,
        commentsCount: input.commentsCount,
        sharesCount: input.sharesCount,
        savesCount: input.savesCount,
        reach: 100,
        impressions: input.impressions,
        engagement: 35,
      },
    ],
    postMedia: [
      {
        id: `${input.id}-media`,
        contentPostId: input.id,
        mediaAssetId: `${input.id}-asset`,
        sortOrder: 0,
        mediaAsset: {
          id: `${input.id}-asset`,
          userId: 'user-1',
          storagePath: 'user-1/image.png',
          fileType: MediaType.IMAGE,
          mimeType: 'image/png',
          fileSize: 1024,
          width: 1200,
          height: 1200,
          durationSeconds: null,
          createdAt: new Date('2026-05-19T08:00:00Z'),
          updatedAt: new Date('2026-05-19T08:00:00Z'),
        },
      },
    ],
    _count: { postMedia: 1 },
  };
}
