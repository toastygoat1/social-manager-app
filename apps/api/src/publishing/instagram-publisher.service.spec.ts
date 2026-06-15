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
  let originalFetch: typeof globalThis.fetch | undefined;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    if (!globalThis.fetch) {
      Object.defineProperty(globalThis, 'fetch', {
        value: jest.fn(),
        writable: true,
        configurable: true,
      });
    }
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
            createSignedUrl: jest.fn<PrismaFn>((storagePath) => {
              const path =
                typeof storagePath === 'string' ? storagePath : 'media.jpg';
              return Promise.resolve({
                data: { signedUrl: `https://signed.example/${path}` },
                error: null,
              });
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

  it('publishes mixed image and video carousel media through carousel child containers', async () => {
    const carouselPost = makePost(null, {
      postType: PostType.CAROUSEL,
      media: [
        {
          id: 'image-asset',
          storagePath: 'user-1/image.jpg',
          fileType: MediaType.IMAGE,
          mimeType: 'image/jpeg',
          width: 1080,
          height: 1080,
          durationSeconds: null,
        },
        {
          id: 'video-asset',
          storagePath: 'user-1/video.mp4',
          fileType: MediaType.VIDEO,
          mimeType: 'video/mp4',
          width: 1080,
          height: 1920,
          durationSeconds: 12,
        },
      ],
    });
    const mediaRequests: URLSearchParams[] = [];

    prisma.contentPost.findUnique.mockResolvedValue(carouselPost);
    prisma.contentPost.updateMany.mockResolvedValue({ count: 1 });
    prisma.contentPost.update.mockResolvedValue(
      makePost('carousel-parent', { postType: PostType.CAROUSEL }),
    );
    prisma.publishAttempt.count.mockResolvedValue(0);
    prisma.publishAttempt.create.mockResolvedValue({ id: 'attempt-1' });
    prisma.publishAttempt.update.mockResolvedValue({});

    jest.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url =
        input instanceof URL
          ? input
          : new URL(typeof input === 'string' ? input : input.url);
      const method = init?.method ?? 'GET';

      if (method === 'POST' && url.pathname.endsWith('/account-1/media')) {
        if (!init?.body) throw new Error('Expected media request body');
        const params = new URLSearchParams(init.body as URLSearchParams);
        mediaRequests.push(params);

        if (params.get('image_url')) {
          expect(params.get('is_carousel_item')).toBe('true');
          return Promise.resolve(jsonResponse({ id: 'image-child' }));
        }

        if (params.get('video_url')) {
          expect(params.get('media_type')).toBe('VIDEO');
          expect(params.get('is_carousel_item')).toBe('true');
          return Promise.resolve(jsonResponse({ id: 'video-child' }));
        }

        expect(params.get('media_type')).toBe('CAROUSEL');
        expect(params.get('children')).toBe('image-child,video-child');
        expect(params.get('caption')).toBe('Caption');
        return Promise.resolve(jsonResponse({ id: 'carousel-parent' }));
      }

      if (
        url.pathname.endsWith('/image-child') ||
        url.pathname.endsWith('/video-child') ||
        url.pathname.endsWith('/carousel-parent')
      ) {
        return Promise.resolve(jsonResponse({ status_code: 'FINISHED' }));
      }

      if (
        method === 'POST' &&
        url.pathname.endsWith('/account-1/media_publish')
      ) {
        if (!init?.body) throw new Error('Expected publish request body');
        const params = new URLSearchParams(init.body as URLSearchParams);
        expect(params.get('creation_id')).toBe('carousel-parent');
        return Promise.resolve(jsonResponse({ id: 'published-carousel' }));
      }

      if (url.pathname.endsWith('/published-carousel')) {
        return Promise.resolve(
          jsonResponse({ permalink: 'https://instagram.test/p/carousel' }),
        );
      }

      throw new Error(`Unexpected Meta call: ${method} ${url.pathname}`);
    });

    await service.publishScheduled('post-1');

    const imageRequest = mediaRequests.find((params) =>
      Boolean(params.get('image_url')),
    );
    const videoRequest = mediaRequests.find((params) =>
      Boolean(params.get('video_url')),
    );
    const parentRequest = mediaRequests.find(
      (params) => params.get('media_type') === 'CAROUSEL',
    );

    expect(imageRequest?.get('image_url')).toBe(
      'https://signed.example/user-1/image.jpg',
    );
    expect(videoRequest?.get('video_url')).toBe(
      'https://signed.example/user-1/video.mp4',
    );
    expect(parentRequest?.get('children')).toBe('image-child,video-child');
    expect(prisma.contentPost.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'post-1',
        status: PostStatus.READY,
        igMediaContainerId: null,
      },
      data: { igMediaContainerId: 'carousel-parent' },
    });
  });

  it('rejects story videos longer than the Instagram Graph API story limit', async () => {
    const storyPost = makePost(null, {
      postType: PostType.STORY,
      media: [
        {
          id: 'story-video',
          storagePath: 'user-1/story.mov',
          fileType: MediaType.VIDEO,
          mimeType: 'video/quicktime',
          width: 1080,
          height: 1920,
          durationSeconds: 90,
        },
      ],
    });
    const fetchMock = jest
      .spyOn(globalThis, 'fetch')
      .mockImplementation(() => Promise.resolve(jsonResponse({ id: 'noop' })));

    prisma.contentPost.findUnique.mockResolvedValue(storyPost);

    await expect(service.publishScheduled('post-1')).rejects.toThrow(
      'Instagram story videos must be 60 seconds or shorter',
    );

    expect(prisma.publishAttempt.create).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (!originalFetch) {
      delete (globalThis as { fetch?: typeof globalThis.fetch }).fetch;
    }
    process.env.ENCRYPTION_KEY = originalEncryptionKey;
  });
});

function makePost(
  igMediaContainerId: string | null,
  options: {
    postType?: PostType;
    media?: {
      id: string;
      storagePath: string;
      fileType: MediaType;
      mimeType: string;
      width: number;
      height: number;
      durationSeconds: number | null;
    }[];
  } = {},
) {
  const media = options.media ?? [
    {
      id: 'media-1',
      storagePath: 'user-1/media.jpg',
      fileType: MediaType.IMAGE,
      mimeType: 'image/jpeg',
      width: 1080,
      height: 1080,
      durationSeconds: null,
    },
  ];

  return {
    id: 'post-1',
    instagramAccountId: 'db-account-1',
    caption: 'Caption',
    postType: options.postType ?? PostType.FEED,
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
    postMedia: media.map((item, sortOrder) => ({
      id: `post-media-${sortOrder + 1}`,
      contentPostId: 'post-1',
      mediaAssetId: item.id,
      sortOrder,
      mediaAsset: {
        id: item.id,
        userId: 'user-1',
        storagePath: item.storagePath,
        fileType: item.fileType,
        mimeType: item.mimeType,
        fileSize: 10,
        width: item.width,
        height: item.height,
        durationSeconds: item.durationSeconds,
        createdAt: new Date('2026-05-22T09:00:00.000Z'),
        updatedAt: new Date('2026-05-22T09:00:00.000Z'),
      },
    })),
  };
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
