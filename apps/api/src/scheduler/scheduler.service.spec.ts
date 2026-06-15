import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { ConfigService } from '@nestjs/config';
import { PostStatus, PostType } from '@social-manager/database';
import { encryptSecret } from '../common/crypto.util.js';
import { MediaService } from '../media/media.service.js';
import { InstagramPublisherService } from '../publishing/instagram-publisher.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PublishQueueService } from '../queue/publish-queue.service.js';
import { SchedulerService } from './scheduler.service.js';

type AsyncFn = (...args: unknown[]) => Promise<unknown>;

describe('SchedulerService queue compensation', () => {
  let service: SchedulerService;
  let previousEncryptionKey: string | undefined;
  let prisma: {
    $transaction: jest.Mock<AsyncFn>;
    contentPost: {
      findFirst: jest.Mock<AsyncFn>;
      update: jest.Mock<AsyncFn>;
      updateMany: jest.Mock<AsyncFn>;
      deleteMany: jest.Mock<AsyncFn>;
    };
    contentMetadataField: {
      findMany: jest.Mock<AsyncFn>;
    };
    postComment: {
      deleteMany: jest.Mock<AsyncFn>;
      createMany: jest.Mock<AsyncFn>;
    };
  };
  let publishQueue: {
    ensureAvailable: jest.Mock<AsyncFn>;
    replaceScheduledPost: jest.Mock<AsyncFn>;
    removeScheduledPost: jest.Mock<AsyncFn>;
  };
  let config: {
    get: jest.Mock<(key: string) => string | undefined>;
  };

  beforeEach(() => {
    previousEncryptionKey = process.env.ENCRYPTION_KEY;
    process.env.ENCRYPTION_KEY = 'a'.repeat(64);
    prisma = {
      $transaction: jest.fn<AsyncFn>(async (callback) =>
        (callback as (tx: typeof prisma) => Promise<unknown>)(prisma),
      ),
      contentPost: {
        findFirst: jest.fn<AsyncFn>(),
        update: jest.fn<AsyncFn>(),
        updateMany: jest.fn<AsyncFn>(),
        deleteMany: jest.fn<AsyncFn>(),
      },
      contentMetadataField: {
        findMany: jest.fn<AsyncFn>().mockResolvedValue([]),
      },
      postComment: {
        deleteMany: jest.fn<AsyncFn>().mockResolvedValue({ count: 0 }),
        createMany: jest.fn<AsyncFn>().mockResolvedValue({ count: 0 }),
      },
    };
    config = {
      get: jest.fn((key: string) => {
        if (key === 'INSTAGRAM_GRAPH_API_BASE_URL') {
          return 'https://graph.example.test';
        }
        if (key === 'INSTAGRAM_GRAPH_API_VERSION') return 'v22.0';
        return undefined;
      }),
    };
    publishQueue = {
      ensureAvailable: jest.fn<AsyncFn>().mockResolvedValue(undefined),
      replaceScheduledPost: jest.fn<AsyncFn>().mockResolvedValue(undefined),
      removeScheduledPost: jest.fn<AsyncFn>().mockResolvedValue(undefined),
    };
    service = new SchedulerService(
      prisma as unknown as PrismaService,
      {} as InstagramPublisherService,
      publishQueue as unknown as PublishQueueService,
      {} as MediaService,
      config as unknown as ConfigService,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (previousEncryptionKey === undefined) {
      delete process.env.ENCRYPTION_KEY;
    } else {
      process.env.ENCRYPTION_KEY = previousEncryptionKey;
    }
  });

  it('restores the original delayed job when reschedule persistence fails', async () => {
    const scheduledFor = new Date(Date.now() + 60 * 60 * 1000);
    const nextScheduledFor = new Date(Date.now() + 2 * 60 * 60 * 1000);
    prisma.contentPost.findFirst.mockResolvedValue(
      makeScheduledPost(scheduledFor),
    );
    prisma.contentPost.updateMany.mockRejectedValue(
      new Error('database unavailable'),
    );

    await expect(
      service.updateScheduledPost('user-1', 'post-1', {
        scheduledFor: nextScheduledFor.toISOString(),
      }),
    ).rejects.toThrow('database unavailable');

    expect(publishQueue.replaceScheduledPost).toHaveBeenNthCalledWith(
      1,
      'post-1',
      nextScheduledFor,
    );
    expect(publishQueue.replaceScheduledPost).toHaveBeenNthCalledWith(
      2,
      'post-1',
      scheduledFor,
    );
  });

  it('restores the removed delayed job when scheduled post deletion fails', async () => {
    const scheduledFor = new Date(Date.now() + 60 * 60 * 1000);
    prisma.contentPost.findFirst.mockResolvedValue(
      makeScheduledPost(scheduledFor),
    );
    prisma.contentPost.deleteMany.mockRejectedValue(
      new Error('database unavailable'),
    );

    await expect(service.deletePost('user-1', 'post-1')).rejects.toThrow(
      'database unavailable',
    );

    expect(publishQueue.removeScheduledPost).toHaveBeenCalledWith('post-1');
    expect(publishQueue.replaceScheduledPost).toHaveBeenCalledWith(
      'post-1',
      scheduledFor,
    );
  });

  it('syncs Instagram comments into post details', async () => {
    const publishedAt = new Date('2026-06-01T10:00:00.000Z');
    prisma.contentPost.findFirst.mockResolvedValue(
      makePublishedPost(publishedAt),
    );
    prisma.contentPost.update.mockResolvedValue({});
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          data: [
            {
              id: 'comment-1',
              text: 'Love this',
              username: 'fan_one',
              timestamp: '2026-06-01T11:00:00+0000',
              like_count: 3,
              replies: {
                data: [
                  {
                    id: 'reply-1',
                    text: 'Thank you',
                    username: 'brand',
                    timestamp: '2026-06-01T11:05:00+0000',
                    like_count: 1,
                  },
                ],
              },
            },
          ],
        }),
    } as Response);

    const result = await service.getPostDetail('user-1', 'post-1');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.href).toContain(
      'https://graph.example.test/v22.0/ig-media-1/comments',
    );
    expect(url.searchParams.get('access_token')).toBe('ig-token');
    expect(url.searchParams.get('limit')).toBe('25');
    expect(prisma.postComment.deleteMany).toHaveBeenCalledWith({
      where: { contentPostId: 'post-1' },
    });
    expect(prisma.postComment.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          contentPostId: 'post-1',
          igCommentId: 'comment-1',
          parentIgCommentId: null,
          username: 'fan_one',
          text: 'Love this',
          likeCount: 3,
        }),
        expect.objectContaining({
          contentPostId: 'post-1',
          igCommentId: 'reply-1',
          parentIgCommentId: 'comment-1',
          username: 'brand',
          text: 'Thank you',
          likeCount: 1,
        }),
      ]),
    });
    expect(prisma.contentPost.update).toHaveBeenCalledWith({
      where: { id: 'post-1' },
      data: { commentsSyncedAt: expect.any(Date) },
    });
    expect(result.comments.status).toBe('synced');
    expect(result.comments.items).toHaveLength(2);
  });
});

function makeScheduledPost(scheduledFor: Date) {
  return {
    id: 'post-1',
    status: PostStatus.READY,
    postType: PostType.FEED,
    scheduledFor,
    igMediaContainerId: null,
    publishAttempts: [],
    postMedia: [],
    postAnalytics: [],
    postComments: [],
    metadataValues: [],
    commentsSyncedAt: null,
    igMediaId: null,
    igPermalink: null,
    igMediaUrl: null,
    igThumbnailUrl: null,
    caption: null,
    publishedAt: null,
    createdAt: new Date('2026-06-01T09:00:00.000Z'),
    updatedAt: new Date('2026-06-01T09:00:00.000Z'),
    instagramAccount: {
      id: 'account-1',
      userId: 'user-1',
      username: 'brand',
      isActive: true,
      accessTokenEncrypted: encryptSecret('ig-token'),
    },
  };
}

function makePublishedPost(publishedAt: Date) {
  return {
    ...makeScheduledPost(publishedAt),
    status: PostStatus.PUBLISHED,
    publishedAt,
    scheduledFor: null,
    igMediaId: 'ig-media-1',
  };
}
