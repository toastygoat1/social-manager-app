import { Controller, Get, Post, UseGuards, Request } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { AuthService } from './auth.service.js';
import type { AuthUser, AuthedRequest } from './auth.types.js';

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
}
