import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class InstagramService {
  constructor(private prisma: PrismaService) {}

  async addAccount(userId: string, data: any) {
    const existingAccount = await this.prisma.instagramAccount.findUnique({
      where: { igUserId: data.igUserId },
    });

    if (existingAccount && existingAccount.userId !== userId) {
      throw new ForbiddenException('Akun Instagram ini sudah ditautkan oleh pengguna lain.');
    }

    return this.prisma.instagramAccount.upsert({
      where: { 
        igUserId: data.igUserId 
      },
      update: {
        username: data.username,
        accessTokenEncrypted: data.accessToken,
        accountType: data.accountType,
        pageId: data.pageId,
        tokenExpiresAt: data.tokenExpiresAt ? new Date(data.tokenExpiresAt) : null,
        isActive: true,
      },
      create: {
        userId: userId,
        igUserId: data.igUserId,
        username: data.username,
        accessTokenEncrypted: data.accessToken,
        accountType: data.accountType,
        pageId: data.pageId,
        tokenExpiresAt: data.tokenExpiresAt ? new Date(data.tokenExpiresAt) : null,
      },
    });
  }

  async getAccounts(userId: string) {
    return this.prisma.instagramAccount.findMany({
      where: { userId: userId },
      orderBy: { createdAt: 'desc' },
    });
  }
}