import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@social-manager/database';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService) {}

  async syncUser(userId: string, email: string) {
    try {
      const user = await this.prisma.user.upsert({
        where: { id: userId },
        update: { email },
        create: { id: userId, email },
      });

      return { user };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Email already linked to another account');
      }
      throw error;
    }
  }
}
