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
    instagramAccount: {
      findMany: jest.Mock<AsyncFn>;
      findFirst: jest.Mock<AsyncFn>;
    };
    contentPost: { findMany: jest.Mock<AsyncFn> };
    postAnalytics: { create: jest.Mock<AsyncFn> };
    analyticsSnapshot: {
      findMany: jest.Mock<AsyncFn>;
      upsert: jest.Mock<AsyncFn>;
    };
    analyticsNote: {
      create: jest.Mock<AsyncFn>;
      update: jest.Mock<AsyncFn>;
      deleteMany: jest.Mock<AsyncFn>;
      findMany: jest.Mock<AsyncFn>;
      findFirst: jest.Mock<AsyncFn>;
    };
  };
  let media: { createSignedPreviewUrl: jest.Mock<AsyncFn> };
  let config: { get: jest.Mock<(key: string) => string | undefined> };
  const originalEncryptionKey = process.env.ENCRYPTION_KEY;

  beforeEach(async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-05-23T10:00:00Z'));
    process.env.ENCRYPTION_KEY = 'a'.repeat(64);

    prisma = {
      instagramAccount: {
        findMany: jest.fn<AsyncFn>(),
        findFirst: jest.fn<AsyncFn>(),
      },
      contentPost: { findMany: jest.fn<AsyncFn>() },
      postAnalytics: { create: jest.fn<AsyncFn>() },
      analyticsSnapshot: {
        findMany: jest.fn<AsyncFn>().mockResolvedValue([]),
        upsert: jest.fn<AsyncFn>(),
      },
      analyticsNote: {
        create: jest.fn<AsyncFn>(),
        update: jest.fn<AsyncFn>(),
        deleteMany: jest.fn<AsyncFn>(),
        findMany: jest.fn<AsyncFn>().mockResolvedValue([]),
        findFirst: jest.fn<AsyncFn>(),
      },
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
        id: 'views',
        title: 'Total Views',
        value: null,
        delta: null,
        trend: null,
      },
      {
        id: 'reach',
        title: 'Total Reach',
        value: null,
        delta: null,
        trend: null,
      },
      {
        id: 'interactions',
        title: 'Interactions',
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
      {
        id: 'comments',
        title: 'Total Comments',
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
        id: 'shares',
        title: 'Total Shares',
        value: null,
        delta: null,
        trend: null,
      },
    ]);
    expect(overview.performanceSeries).toEqual([]);
    expect(overview.bestTime.sampleSize).toBe(0);
    expect(overview.leaderboard).toEqual([]);
    expect(overview.audience.followers).toBeNull();
    expect(overview.contentCalendar.label).toBe('May 2026');
    expect(overview.notes).toEqual([]);
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
    prisma.analyticsSnapshot.findMany.mockResolvedValue([
      makeSnapshot({
        snapshotDate: '2026-04-23T00:00:00Z',
        followersCount: 980,
      }),
      makeSnapshot({
        snapshotDate: '2026-05-23T00:00:00Z',
        followersCount: 1000,
      }),
    ]);
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
        id: 'views',
        title: 'Total Views',
        value: 120,
        delta: 40,
        trend: 'up',
      },
      {
        id: 'reach',
        title: 'Total Reach',
        value: 100,
        delta: 0,
        trend: null,
      },
      {
        id: 'interactions',
        title: 'Interactions',
        value: 35,
        delta: 0,
        trend: null,
      },
      {
        id: 'likes',
        title: 'Total Likes',
        value: 20,
        delta: 8,
        trend: 'up',
      },
      {
        id: 'comments',
        title: 'Total Comments',
        value: 8,
        delta: 5,
        trend: 'up',
      },
      {
        id: 'saves',
        title: 'Total Saves',
        value: 5,
        delta: 4,
        trend: 'up',
      },
      {
        id: 'shares',
        title: 'Total Shares',
        value: 2,
        delta: 2,
        trend: 'down',
      },
    ]);
    expect(overview.performanceSeries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          postCount: 1,
          views: 120,
          reach: 100,
          interactions: 35,
          likes: 20,
        }),
      ]),
    );
    expect(overview.bestTime).toMatchObject({
      timezone: 'UTC',
      sampleSize: 1,
      topWindow: 'WED 08:00 UTC',
    });
    expect(overview.leaderboard[0]).toMatchObject({
      postCount: 1,
      followers: 1000,
      followerGrowth: 20,
      views: 120,
      reach: 100,
      interactions: 35,
      engagementRate: 35,
    });
    expect(overview.audience).toMatchObject({
      followers: 1000,
      followerGrowth: 20,
      following: 90,
      mediaCount: 24,
      reach: 400,
      profileViews: 30,
      gender: [
        { label: 'Women', value: 60, percentage: 60 },
        { label: 'Men', value: 40, percentage: 40 },
      ],
    });
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
    expect(overview.notes).toEqual([]);
  });

  it('creates an account-scoped analytics note', async () => {
    const createdAt = new Date('2026-05-23T10:00:00Z');
    const updatedAt = new Date('2026-05-23T10:00:00Z');
    prisma.instagramAccount.findFirst.mockResolvedValue({ id: 'account-1' });
    prisma.analyticsNote.create.mockResolvedValue({
      id: 'note-1',
      instagramAccountId: 'account-1',
      body: 'Watch comment spikes after the reel.',
      createdAt,
      updatedAt,
    });

    const note = await service.createNote('user-1', {
      accountId: 'account-1',
      body: '  Watch comment spikes after the reel.  ',
    });

    expect(prisma.instagramAccount.findFirst).toHaveBeenCalledWith({
      where: { id: 'account-1', userId: 'user-1', isActive: true },
      select: { id: true },
    });
    expect(prisma.analyticsNote.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        instagramAccountId: 'account-1',
        body: 'Watch comment spikes after the reel.',
      },
      select: expect.objectContaining({
        id: true,
        body: true,
      }),
    });
    expect(note).toEqual({
      id: 'note-1',
      accountId: 'account-1',
      body: 'Watch comment spikes after the reel.',
      createdAt: '2026-05-23T10:00:00.000Z',
      updatedAt: '2026-05-23T10:00:00.000Z',
    });
  });

  it('fetches fresh Instagram insights and stores a post analytics snapshot', async () => {
    prisma.instagramAccount.findMany.mockResolvedValue([
      {
        id: 'account-1',
        igUserId: 'ig-account-1',
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
    prisma.analyticsSnapshot.upsert.mockResolvedValue({});

    const fetchMock = jest
      .spyOn(globalThis, 'fetch')
      .mockImplementation((input) => {
        const url =
          input instanceof URL
            ? input
            : new URL(typeof input === 'string' ? input : input.url);

        if (url.pathname === '/v21.0/ig-account-1') {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                followers_count: 1000,
                follows_count: 90,
                media_count: 24,
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } },
            ),
          );
        }

        if (url.pathname === '/v21.0/ig-account-1/insights') {
          const metric = url.searchParams.get('metric');

          if (metric === 'follower_demographics') {
            const breakdown = url.searchParams.get('breakdown');
            const result =
              breakdown === 'gender'
                ? [
                    { dimension_values: ['Women'], value: 60 },
                    { dimension_values: ['Men'], value: 40 },
                  ]
                : breakdown === 'age'
                  ? [{ dimension_values: ['25-34'], value: 70 }]
                  : [{ dimension_values: ['Bangkok'], value: 55 }];

            return Promise.resolve(
              new Response(
                JSON.stringify({
                  data: [
                    {
                      name: 'follower_demographics',
                      total_value: { breakdowns: [{ results: result }] },
                    },
                  ],
                }),
                {
                  status: 200,
                  headers: { 'Content-Type': 'application/json' },
                },
              ),
            );
          }

          const values: Record<string, number> = {
            reach: 400,
            views: 620,
            profile_views: 30,
          };

          return Promise.resolve(
            new Response(
              JSON.stringify({
                data: [
                  {
                    name: metric,
                    total_value: { value: values[metric ?? ''] },
                  },
                ],
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } },
            ),
          );
        }

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
        igUserId: true,
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
    expect(prisma.analyticsSnapshot.upsert).toHaveBeenCalledWith({
      where: {
        instagramAccountId_snapshotDate: {
          instagramAccountId: 'account-1',
          snapshotDate: new Date('2026-05-23T00:00:00Z'),
        },
      },
      update: expect.objectContaining({
        followersCount: 1000,
        followingCount: 90,
        mediaCount: 24,
        reach: 400,
        impressions: 620,
        profileViews: 30,
      }),
      create: expect.objectContaining({
        instagramAccountId: 'account-1',
        snapshotDate: new Date('2026-05-23T00:00:00Z'),
        followersCount: 1000,
      }),
    });
    expect(result).toEqual({
      refreshed: 1,
      accountSnapshots: 1,
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

function makeSnapshot(input: { snapshotDate: string; followersCount: number }) {
  return {
    instagramAccountId: 'account-1',
    snapshotDate: new Date(input.snapshotDate),
    followersCount: input.followersCount,
    followingCount: 90,
    mediaCount: 24,
    reach: 400,
    impressions: 620,
    profileViews: 30,
    audienceDemographics: {
      gender: [
        { label: 'Women', value: 60, percentage: 60 },
        { label: 'Men', value: 40, percentage: 40 },
      ],
      age: [{ label: '25-34', value: 70, percentage: 100 }],
      city: [{ label: 'Bangkok', value: 55, percentage: 100 }],
    },
    createdAt: new Date(input.snapshotDate),
  };
}
