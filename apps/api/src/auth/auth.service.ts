import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService) {}

  async syncUser(userId: string, email: string) {
    let user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          id: userId,
          email: email,
        },
      });
    }

    return {
      message: 'User berhasil disinkronisasi ke database internal',
      user: user,
    };
  }
}