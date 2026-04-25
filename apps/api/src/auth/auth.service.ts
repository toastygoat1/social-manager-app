import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService) {}

  async syncUser(userId: string, email: string) {
    const user = await this.prisma.user.upsert({
      where: { id: userId },
      update: { 
        email: email,
      },
      create: {
        id: userId,
        email: email,
      },
    });

    return {
      message: 'User berhasil disinkronisasi ke database internal',
      user: user,
    };
  }
}