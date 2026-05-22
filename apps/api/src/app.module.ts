import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './auth/auth.module.js';
import { InstagramModule } from './instagram/instagram.module.js';
import { DashboardModule } from './dashboard/dashboard.module.js';
import { GoogleModule } from './integrations/google/google.module.js';
import { CalendarModule } from './calendar/calendar.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../../.env',
    }),
    ThrottlerModule.forRoot({
      throttlers: [
        { name: 'short', ttl: 1_000, limit: 5 },
        { name: 'medium', ttl: 10_000, limit: 30 },
        { name: 'long', ttl: 60_000, limit: 100 },
      ],
    }),

    PrismaModule,
    AuthModule,
    InstagramModule,
    DashboardModule,
    GoogleModule,
    CalendarModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
