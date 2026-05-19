import { Injectable, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@social-manager/database';
import { PrismaService } from '../prisma/prisma.service.js';
import { AddInstagramAccountDto } from './dto/add-instagram-account.dto.js';
import { encryptSecret } from '../common/crypto.util.js';

const SAFE_INSTAGRAM_ACCOUNT_SELECT = {
  id: true,
  userId: true,
  igUserId: true,
  username: true,
  accountType: true,
  pageId: true,
  isActive: true,
  tokenExpiresAt: true,
  connectedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.InstagramAccountSelect;

@Injectable()
export class InstagramService {
  constructor(private prisma: PrismaService) {}

  async addAccount(userId: string, data: AddInstagramAccountDto) {
    const accessTokenEncrypted = encryptSecret(data.accessToken);

    try {
      return await this.prisma.instagramAccount.create({
        data: {
          userId: userId,
          igUserId: data.igUserId,
          username: data.username,
          accessTokenEncrypted,
          accountType: data.accountType,
          pageId: data.pageId,
          tokenExpiresAt: data.tokenExpiresAt
            ? new Date(data.tokenExpiresAt)
            : null,
        },
        select: SAFE_INSTAGRAM_ACCOUNT_SELECT,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const updateResult = await this.prisma.instagramAccount.updateMany({
          where: {
            igUserId: data.igUserId,
            userId: userId,
          },
          data: {
            username: data.username,
            accessTokenEncrypted,
            accountType: data.accountType,
            pageId: data.pageId,
            tokenExpiresAt: data.tokenExpiresAt
              ? new Date(data.tokenExpiresAt)
              : null,
            isActive: true,
          },
        });

        if (updateResult.count === 0) {
          throw new ForbiddenException(
            'Akun Instagram ini sudah ditautkan oleh pengguna lain.',
          );
        }

        return this.prisma.instagramAccount.findUnique({
          where: { igUserId: data.igUserId },
          select: SAFE_INSTAGRAM_ACCOUNT_SELECT,
        });
      }

      throw error;
    }
  }

  async getAccounts(userId: string) {
    return this.prisma.instagramAccount.findMany({
      where: { userId: userId },
      orderBy: { createdAt: 'desc' },
      select: SAFE_INSTAGRAM_ACCOUNT_SELECT,
    });
  }
}
