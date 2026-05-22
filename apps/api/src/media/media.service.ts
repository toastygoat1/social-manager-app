import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { MediaType } from '@social-manager/database';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthUser } from '../auth/auth.types.js';

const DEFAULT_MEDIA_BUCKET = 'media-assets';
const MAX_FILE_SIZE = 100 * 1024 * 1024;

type MediaUploadInput = {
  name: string;
  mimeType: string;
  fileSize: number;
};

type CompletedUploadInput = {
  storagePath: string;
  mimeType: string;
  fileSize: number;
  width?: number;
  height?: number;
  durationSeconds?: number;
};

@Injectable()
export class MediaService {
  private readonly bucket: string;
  private readonly supabase: ReturnType<typeof createClient>;
  private bucketChecked = false;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.bucket =
      this.config.get<string>('SUPABASE_MEDIA_BUCKET')?.trim() ||
      DEFAULT_MEDIA_BUCKET;
    this.supabase = createClient(
      this.config.getOrThrow<string>('SUPABASE_URL'),
      this.config.getOrThrow<string>('SUPABASE_SERVICE_ROLE_KEY'),
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );
  }

  async createUploadUrls(user: AuthUser, files: MediaUploadInput[]) {
    await this.ensureBucket();

    const uploads = await Promise.all(
      files.map(async (file) => {
        this.validateFile(file.mimeType, file.fileSize);
        const storagePath = `${user.userId}/${randomUUID()}/${sanitizeFileName(
          file.name,
        )}`;
        const { data, error } = await this.supabase.storage
          .from(this.bucket)
          .createSignedUploadUrl(storagePath);

        if (error || !data) {
          throw new InternalServerErrorException(
            error?.message ?? 'Could not create upload URL',
          );
        }

        return {
          bucket: this.bucket,
          storagePath: data.path || storagePath,
          token: data.token,
          signedUrl: data.signedUrl,
        };
      }),
    );

    return { bucket: this.bucket, uploads };
  }

  async completeUploads(user: AuthUser, files: CompletedUploadInput[]) {
    await this.ensureUser(user);

    const created = await this.prisma.$transaction(
      files.map((file) => {
        this.validateCompletedFile(user.userId, file);
        return this.prisma.mediaAsset.create({
          data: {
            userId: user.userId,
            storagePath: file.storagePath,
            fileType: toMediaType(file.mimeType),
            mimeType: file.mimeType,
            fileSize: file.fileSize,
            width: file.width,
            height: file.height,
            durationSeconds: file.durationSeconds,
          },
          select: {
            id: true,
            storagePath: true,
            fileType: true,
            mimeType: true,
            fileSize: true,
            width: true,
            height: true,
            durationSeconds: true,
          },
        });
      }),
    );

    return { assets: created };
  }

  private async ensureUser(user: AuthUser) {
    await this.prisma.user.upsert({
      where: { id: user.userId },
      update: { email: user.email },
      create: { id: user.userId, email: user.email },
    });
  }

  private async ensureBucket() {
    if (this.bucketChecked) return;

    const existing = await this.supabase.storage.getBucket(this.bucket);
    if (!existing.error) {
      this.bucketChecked = true;
      return;
    }

    const created = await this.supabase.storage.createBucket(this.bucket, {
      public: false,
    });
    if (
      created.error &&
      !created.error.message.toLowerCase().includes('already exists')
    ) {
      throw new InternalServerErrorException(created.error.message);
    }

    this.bucketChecked = true;
  }

  private validateCompletedFile(userId: string, file: CompletedUploadInput) {
    if (!file.storagePath.startsWith(`${userId}/`)) {
      throw new BadRequestException('Invalid storage path');
    }
    this.validateFile(file.mimeType, file.fileSize);
  }

  private validateFile(mimeType: string, fileSize: number) {
    if (!mimeType.startsWith('image/') && !mimeType.startsWith('video/')) {
      throw new BadRequestException('Only image and video uploads are allowed');
    }
    if (fileSize > MAX_FILE_SIZE) {
      throw new BadRequestException('Media file is too large');
    }
  }
}

function sanitizeFileName(name: string): string {
  const clean = name
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 120);
  return clean || 'upload';
}

function toMediaType(mimeType: string): MediaType {
  if (mimeType.startsWith('image/')) return MediaType.IMAGE;
  if (mimeType.startsWith('video/')) return MediaType.VIDEO;
  throw new BadRequestException('Unsupported media type');
}
