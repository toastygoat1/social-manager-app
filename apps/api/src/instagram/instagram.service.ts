import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class InstagramService {
  constructor(private prisma: PrismaService) {}

  async addAccount(userId: string, data: any) {
    try {
      return await this.prisma.instagramAccount.create({
        data: {
          userId: userId,
          igUserId: data.igUserId,
          username: data.username,
          accessTokenEncrypted: data.accessToken,
          accountType: data.accountType,
          pageId: data.pageId,
          tokenExpiresAt: data.tokenExpiresAt ? new Date(data.tokenExpiresAt) : null,
        },
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        
        const updateResult = await this.prisma.instagramAccount.updateMany({
          where: { 
            igUserId: data.igUserId,
            userId: userId,
          },
          data: {
            username: data.username,
            accessTokenEncrypted: data.accessToken,
            accountType: data.accountType,
            pageId: data.pageId,
            tokenExpiresAt: data.tokenExpiresAt ? new Date(data.tokenExpiresAt) : null,
            isActive: true,
          },
        });

        if (updateResult.count === 0) {
          throw new ForbiddenException('Akun Instagram ini sudah ditautkan oleh pengguna lain.');
        }

        return this.prisma.instagramAccount.findUnique({
          where: { igUserId: data.igUserId }
        });
      }
      
      throw error;
    }
  }

  async getAccounts(userId: string) {
    return this.prisma.instagramAccount.findMany({
      where: { userId: userId },
      orderBy: { createdAt: 'desc' },
    });
  }
}