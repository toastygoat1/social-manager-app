import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { ConfigService } from '@nestjs/config';
import { MediaType, PostStatus, PostType } from '@social-manager/database';
import { encryptSecret } from '../common/crypto.util.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { InstagramPublisherService } from './instagram-publisher.service.js';

type PrismaFn = (...args: unknown[]) => Promise<unknown>;

describe('InstagramPublisherService', () => {
  let service: InstagramPublisherService;
  let prisma: {
    contentPost: {
      findUnique: jest.Mock<PrismaFn>;
      update: jest.Mock<PrismaFn>;
      updateMany: jest.Mock<PrismaFn>;
    };
    publishAttempt: {
      count: jest.Mock<PrismaFn>;
      create: jest.Mock<PrismaFn>;
      update: jest.Mock<PrismaFn>;
    };
  };
  const originalEncryptionKey = process.env.ENCRYPTION_KEY;

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = 'a'.repeat(64);
    prisma = {
      contentPost: {
        findUnique: jest.fn<PrismaFn>(),
        update: jest.fn<PrismaFn>(),
        updateMany: jest.fn<PrismaFn>(),
      },
      publishAttempt: {
        count: jest.fn<PrismaFn>(),
        create: jest.fn<PrismaFn>(),
        update: jest.fn<PrismaFn>(),
      },
    };
    const values: Record<string, string> = {
      SUPABASE_URL: 'https://unit-test.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
      ENCRYPTION_KEY: 'a'.repeat(64),
    };
    const config = {
      get: (key: string) => values[key],
      getOrThrow: (key: string) => {
        const value = values[key];
        if (!value) throw new Error(`${key} missing`);
        return value;
      },
    };

    service = new InstagramPublisherService(
      prisma as unknown as PrismaService,
      config as unknown as ConfigService,
    );
    Object.defineProperty(service, 'supabase', {
      value: {
        storage: {
          from: () => ({
            createSignedUrl: jest.fn<PrismaFn>().mockResolvedValue({
              data: { signedUrl: 'https://signed.example/media.jpg' },
              error: null,
            }),
          }),
        },
      },
    });
  });

  it('blocks retry when a final Instagram publish may already have started', async () => {
    prisma.contentPost.findUnique.mockResolvedValue(makePost('container-1'));

    await expect(service.publishScheduled('post-1')).rejects.toThrow(
      'Verify Instagram before trying again',
    );

    expect(prisma.publishAttempt.create).not.toHaveBeenCalled();
  });

  it('records the publish container before the irreversible publish call and never republishes after an uncertain result', async () => {
    prisma.contentPost.findUnique
      .mockResolvedValueOnce(makePost(null))
      .mockResolvedValueOnce(makePost('container-1'));
    prisma.contentPost.updateMany.mockResolvedValue({ count: 1 });
    prisma.contentPost.update.mockRejectedValue(
      new Error('database unavailable'),
    );
    prisma.publishAttempt.count.mockResolvedValue(0);
    prisma.publishAttempt.create.mockResolvedValue({ id: 'attempt-1' });
    prisma.publishAttempt.update.mockResolvedValue({});

    const fetchMock = jest
      .spyOn(globalThis, 'fetch')
      .mockImplementation((input, init) => {
        const url =
          input instanceof URL
            ? input
            : new URL(typeof input === 'string' ? input : input.url);
        const method = init?.method ?? 'GET';

        if (method === 'POST' && url.pathname.endsWith('/account-1/media')) {
          return Promise.resolve(jsonResponse({ id: 'container-1' }));
        }
        if (url.pathname.endsWith('/container-1')) {
          return Promise.resolve(jsonResponse({ status_code: 'FINISHED' }));
        }
        if (
          method === 'POST' &&
          url.pathname.endsWith('/account-1/media_publish')
        ) {
          expect(prisma.contentPost.updateMany).toHaveBeenCalledWith({
            where: {
              id: 'post-1',
              status: PostStatus.READY,
              igMediaContainerId: null,
            },
            data: { igMediaContainerId: 'container-1' },
          });
          return Promise.resolve(jsonResponse({ id: 'published-1' }));
        }
        if (url.pathname.endsWith('/published-1')) {
          return Promise.resolve(
            jsonResponse({ permalink: 'https://instagram.test/p/published-1' }),
          );
        }

        throw new Error(`Unexpected Meta call: ${method} ${url.pathname}`);
      });

    await expect(service.publishScheduled('post-1')).rejects.toThrow(
      'Instagram publish failed: database unavailable',
    );
    await expect(service.publishScheduled('post-1')).rejects.toThrow(
      'Verify Instagram before trying again',
    );

    const mediaPublishCalls = fetchMock.mock.calls.filter(([input, init]) => {
      const url =
        input instanceof URL
          ? input
          : new URL(typeof input === 'string' ? input : input.url);
      return init?.method === 'POST' && url.pathname.endsWith('/media_publish');
    });
    expect(mediaPublishCalls).toHaveLength(1);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    process.env.ENCRYPTION_KEY = originalEncryptionKey;
  });
});

function makePost(igMediaContainerId: string | null) {
  return {
    id: 'post-1',
    instagramAccountId: 'db-account-1',
    title: 'Post',
    caption: 'Caption',
    postType: PostType.FEED,
    status: PostStatus.READY,
    scheduledFor: new Date(Date.now() - 60 * 1000),
    publishedAt: null,
    igMediaId: null,
    igMediaContainerId,
    igPermalink: null,
    isAiGenerated: false,
    createdAt: new Date('2026-05-22T09:00:00.000Z'),
    updatedAt: new Date('2026-05-22T09:00:00.000Z'),
    instagramAccount: {
      id: 'db-account-1',
      userId: 'user-1',
      username: 'brand',
      igUserId: 'account-1',
      accessTokenEncrypted: encryptSecret('token'),
      isActive: true,
    },
    postMedia: [
      {
        id: 'post-media-1',
        contentPostId: 'post-1',
        mediaAssetId: 'media-1',
        sortOrder: 0,
        mediaAsset: {
          id: 'media-1',
          userId: 'user-1',
          storagePath: 'user-1/media.jpg',
          fileType: MediaType.IMAGE,
          mimeType: 'image/jpeg',
          fileSize: 10,
          width: 1080,
          height: 1080,
          durationSeconds: null,
          createdAt: new Date('2026-05-22T09:00:00.000Z'),
          updatedAt: new Date('2026-05-22T09:00:00.000Z'),
        },
      },
    ],
  };
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
