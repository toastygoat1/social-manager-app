import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class InstagramService {
  constructor(private prisma: PrismaService) {}

  async addAccount(userId: string, data: any) {
    return this.prisma.instagramAccount.upsert({
      where: { 
        igUserId: data.igUserId
      },
      update: {
        username: data.username,
        accessTokenEncrypted: data.accessToken, // TODO: Tambahkan enkripsi sungguhan
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
      where: { 
        userId: userId 
      },
      orderBy: { 
        createdAt: 'desc'
      },
    });
  }
}