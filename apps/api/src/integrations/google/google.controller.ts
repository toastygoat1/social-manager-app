import {
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Post,
  Query,
  Redirect,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleService } from './google.service.js';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import type { AuthedRequest } from '../../auth/auth.types.js';
import { LinkGoogleDto } from './dto/link-google.dto.js';
import { CalendarQueryDto } from './dto/calendar-query.dto.js';
import { EventsQueryDto } from './dto/events-query.dto.js';

@Controller('integrations/google')
export class GoogleController {
  private readonly logger = new Logger(GoogleController.name);

  constructor(
    private readonly googleService: GoogleService,
    private readonly config: ConfigService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get('auth')
  getAuthUrl(@Request() req: AuthedRequest) {
    const url = this.googleService.getAuthUrl(req.user.userId, req.user.email);
    return { authUrl: url };
  }

  @Get('callback')
  @Redirect()
  async handleCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
  ) {
    const webOrigin = this.config
      .get<string>('WEB_ORIGIN')
      ?.split(',')[0]
      ?.trim();
    const siteUrl =
      this.config.get<string>('NEXT_PUBLIC_SITE_URL') ??
      webOrigin ??
      'http://localhost:3000';

    if (error) {
      return {
        url: `${siteUrl}/dashboard?google=error&reason=${encodeURIComponent(error)}`,
      };
    }
    if (!code || !state) {
      return { url: `${siteUrl}/dashboard?google=error&reason=missing_params` };
    }
    try {
      await this.googleService.handleCallback(code, state);
      return { url: `${siteUrl}/dashboard?google=connected` };
    } catch (err) {
      this.logger.error('Google OAuth callback failed', err as Error);
      return {
        url: `${siteUrl}/dashboard?google=error&reason=callback_failed`,
      };
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('link')
  async link(@Request() req: AuthedRequest, @Body() body: LinkGoogleDto) {
    await this.googleService.linkWithRefreshToken(
      req.user.userId,
      req.user.email,
      body.refreshToken,
    );
    return { ok: true };
  }

  @UseGuards(JwtAuthGuard)
  @Get('calendar')
  async calendar(
    @Request() req: AuthedRequest,
    @Query() query: CalendarQueryDto,
  ) {
    return this.googleService.getEventDays(
      req.user.userId,
      query.year,
      query.month,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('calendar/events')
  async calendarEvents(
    @Request() req: AuthedRequest,
    @Query() query: EventsQueryDto,
  ) {
    const events = await this.googleService.getCalendarEvents(
      req.user.userId,
      new Date(query.start),
      new Date(query.end),
    );
    return { events };
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
