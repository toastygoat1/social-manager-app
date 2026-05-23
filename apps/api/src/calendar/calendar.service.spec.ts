import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { PostStatus, PostType } from '@social-manager/database';
import { GoogleService } from '../integrations/google/google.service.js';
import { MediaService } from '../media/media.service.js';
import { InstagramPublisherService } from '../publishing/instagram-publisher.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PublishQueueService } from '../queue/publish-queue.service.js';
import { CalendarService } from './calendar.service.js';

type AsyncFn = (...args: unknown[]) => Promise<unknown>;

describe('CalendarService queue compensation', () => {
  let service: CalendarService;
  let prisma: {
    contentPost: {
      findFirst: jest.Mock<AsyncFn>;
      updateMany: jest.Mock<AsyncFn>;
      deleteMany: jest.Mock<AsyncFn>;
    };
  };
  let publishQueue: {
    ensureAvailable: jest.Mock<AsyncFn>;
    replaceScheduledPost: jest.Mock<AsyncFn>;
    removeScheduledPost: jest.Mock<AsyncFn>;
  };

  beforeEach(() => {
    prisma = {
      contentPost: {
        findFirst: jest.fn<AsyncFn>(),
        updateMany: jest.fn<AsyncFn>(),
        deleteMany: jest.fn<AsyncFn>(),
      },
    };
    publishQueue = {
      ensureAvailable: jest.fn<AsyncFn>().mockResolvedValue(undefined),
      replaceScheduledPost: jest.fn<AsyncFn>().mockResolvedValue(undefined),
      removeScheduledPost: jest.fn<AsyncFn>().mockResolvedValue(undefined),
    };
    service = new CalendarService(
      prisma as unknown as PrismaService,
      {} as GoogleService,
      {} as InstagramPublisherService,
      publishQueue as unknown as PublishQueueService,
      {} as MediaService,
    );
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
    instagramAccount: {
      id: 'account-1',
      userId: 'user-1',
      username: 'brand',
      isActive: true,
    },
  };
}
