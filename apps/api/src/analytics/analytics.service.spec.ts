import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MediaType, PostStatus } from '@social-manager/database';
import { MediaService } from '../media/media.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AnalyticsService } from './analytics.service.js';
import { encryptSecret } from '../common/crypto.util.js';

type AsyncFn = (...args: unknown[]) => Promise<unknown>;

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let prisma: {
    instagramAccount: { findMany: jest.Mock<AsyncFn> };
    contentPost: { findMany: jest.Mock<AsyncFn> };
    postAnalytics: { create: jest.Mock<AsyncFn> };
  };
  let media: { createSignedPreviewUrl: jest.Mock<AsyncFn> };
  let config: { get: jest.Mock<(key: string) => string | undefined> };
  const originalEncryptionKey = process.env.ENCRYPTION_KEY;

  beforeEach(async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-05-23T10:00:00Z'));
    process.env.ENCRYPTION_KEY = 'a'.repeat(64);

    prisma = {
      instagramAccount: { findMany: jest.fn<AsyncFn>() },
      contentPost: { findMany: jest.fn<AsyncFn>() },
      postAnalytics: { create: jest.fn<AsyncFn>() },
    };
    media = {
      createSignedPreviewUrl: jest.fn<AsyncFn>(),
    };
    config = {
      get: jest.fn((key: string) => {
        const values: Record<string, string> = {
          META_GRAPH_API_VERSION: 'v21.0',
        };

        return values[key];
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: PrismaService, useValue: prisma },
        { provide: MediaService, useValue: media },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
  });

  afterEach(() => {
    process.env.ENCRYPTION_KEY = originalEncryptionKey;
    jest.useRealTimers();
    jest.restoreAllMocks();
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

    expect(overview.lastUpdatedAt).toBe('2026-05-21T08:00:00.000Z');
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

  it('fetches fresh Instagram insights and stores a post analytics snapshot', async () => {
    prisma.instagramAccount.findMany.mockResolvedValue([
      {
        id: 'account-1',
        username: 'ambacafe',
        accessTokenEncrypted: encryptSecret('ig-token'),
      },
    ]);
    prisma.contentPost.findMany.mockResolvedValue([
      {
        id: 'post-1',
        title: 'Launch post',
        caption: null,
        igMediaId: 'ig-media-1',
        instagramAccountId: 'account-1',
      },
    ]);
    prisma.postAnalytics.create.mockResolvedValue({});

    const fetchMock = jest
      .spyOn(globalThis, 'fetch')
      .mockImplementation((input) => {
        const url =
          input instanceof URL
            ? input
            : new URL(typeof input === 'string' ? input : input.url);

        if (url.pathname === '/v21.0/ig-media-1') {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                id: 'ig-media-1',
                like_count: 21,
                comments_count: 9,
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } },
            ),
          );
        }

        return Promise.resolve(
          new Response(
            JSON.stringify({
              data: [
                { name: 'views', total_value: { value: 130 } },
                { name: 'reach', total_value: { value: 90 } },
                { name: 'shares', total_value: { value: 4 } },
                { name: 'saved', total_value: { value: 7 } },
                { name: 'total_interactions', total_value: { value: 41 } },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        );
      });

    const result = await service.refreshInsights('user-1', {
      accountId: 'account-1',
      range: '30d',
    });

    const urls = fetchMock.mock.calls.map(([input]) =>
      input instanceof URL
        ? input
        : new URL(typeof input === 'string' ? input : input.url),
    );

    expect(prisma.instagramAccount.findMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        isActive: true,
        id: 'account-1',
      },
      select: {
        id: true,
        username: true,
        accessTokenEncrypted: true,
      },
    });
    expect(prisma.contentPost.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          instagramAccountId: { in: ['account-1'] },
          status: PostStatus.PUBLISHED,
          igMediaId: { not: null },
        }),
        take: 50,
      }),
    );
    expect(urls[0]?.searchParams.get('access_token')).toBe('ig-token');
    expect(prisma.postAnalytics.create).toHaveBeenCalledWith({
      data: {
        contentPostId: 'post-1',
        fetchedAt: new Date('2026-05-23T10:00:00Z'),
        likeCount: 21,
        commentsCount: 9,
        sharesCount: 4,
        savesCount: 7,
        reach: 90,
        impressions: 130,
        engagement: 41,
      },
    });
    expect(result).toEqual({
      refreshed: 1,
      skipped: 0,
      failed: 0,
      fetchedAt: '2026-05-23T10:00:00.000Z',
      errors: [],
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
