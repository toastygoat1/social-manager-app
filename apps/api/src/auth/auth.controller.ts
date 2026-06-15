import {
  Body,
  Controller,
  Get,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { AuthService } from './auth.service.js';
import type { AuthUser, AuthedRequest } from './auth.types.js';
import { TrackAuthSessionDto } from './dto/track-auth-session.dto.js';

interface HeaderRequest extends AuthedRequest {
  headers?: Record<string, string | string[] | undefined>;
}

function getHeader(req: HeaderRequest, name: string) {
  const raw = req.headers?.[name.toLowerCase()] ?? req.headers?.[name];
  return Array.isArray(raw) ? raw[0] : raw;
}

@Controller('auth')
@Throttle({
  short: { limit: 3, ttl: 1_000 },
  medium: { limit: 10, ttl: 10_000 },
  long: { limit: 20, ttl: 60_000 },
})
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getProfile(@Request() req: AuthedRequest): AuthUser {
    return req.user;
  }

  @UseGuards(JwtAuthGuard)
  @Post('sync')
  async syncUser(@Request() req: AuthedRequest) {
    return this.authService.syncUser(req.user.userId, req.user.email);
  }

  @UseGuards(JwtAuthGuard)
  @Post('sessions/current')
  async trackCurrentSession(
    @Request() req: HeaderRequest,
    @Body() body: TrackAuthSessionDto,
  ) {
    return this.authService.trackCurrentSession(req.user, {
      userAgent: body.userAgent ?? getHeader(req, 'user-agent'),
      ipAddress: body.ipAddress,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get('sessions')
  async listSessions(@Request() req: AuthedRequest) {
    return this.authService.listSessions(req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Post('sessions/current/sign-out')
  async markCurrentSessionSignedOut(@Request() req: AuthedRequest) {
    return this.authService.markCurrentSessionSignedOut(req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Post('sessions/sign-out')
  async markAllSessionsSignedOut(@Request() req: AuthedRequest) {
    return this.authService.markAllSessionsSignedOut(req.user);
  }
}
