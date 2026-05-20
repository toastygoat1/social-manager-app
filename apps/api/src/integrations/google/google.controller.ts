import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Query,
  Request,
  Response,
  UseGuards,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { ConfigService } from '@nestjs/config';
import { GoogleService } from './google.service.js';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import type { AuthedRequest } from '../../auth/auth.types.js';

@Controller('integrations/google')
export class GoogleController {
  constructor(
    private readonly googleService: GoogleService,
    private readonly config: ConfigService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get('auth')
  getAuthUrl(@Request() req: AuthedRequest) {
    const url = this.googleService.getAuthUrl(req.user.userId);
    return { authUrl: url };
  }

  @Get('callback')
  async handleCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Response({ passthrough: false }) reply: FastifyReply,
  ) {
    const siteUrl =
      this.config.get<string>('NEXT_PUBLIC_SITE_URL') ??
      'http://localhost:3000';

    if (error) {
      return reply.redirect(
        `${siteUrl}/dashboard?google=error&reason=${encodeURIComponent(error)}`,
      );
    }
    if (!code || !state) {
      throw new BadRequestException('Missing code or state');
    }
    await this.googleService.handleCallback(code, state);
    return reply.redirect(`${siteUrl}/dashboard?google=connected`);
  }

  @UseGuards(JwtAuthGuard)
  @Get('status')
  async status(@Request() req: AuthedRequest) {
    const connected = await this.googleService.isConnected(req.user.userId);
    return { connected };
  }

  @UseGuards(JwtAuthGuard)
  @Delete()
  async disconnect(@Request() req: AuthedRequest) {
    await this.googleService.disconnect(req.user.userId);
    return { ok: true };
  }
}
