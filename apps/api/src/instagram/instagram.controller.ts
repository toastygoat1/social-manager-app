import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { InstagramService } from './instagram.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { AddInstagramAccountDto } from './dto/add-instagram-account.dto.js';
import { CompleteInstagramOAuthDto } from './dto/complete-instagram-oauth.dto.js';
import type { AuthedRequest } from '../auth/auth.types.js';

@UseGuards(JwtAuthGuard)
@Controller('instagram')
export class InstagramController {
  constructor(private readonly instagramService: InstagramService) {}

  @Post('accounts')
  async addAccount(
    @Request() req: AuthedRequest,
    @Body() body: AddInstagramAccountDto,
  ) {
    return this.instagramService.addAccount(req.user, body);
  }

  @Get('accounts')
  async getAccounts(@Request() req: AuthedRequest) {
    return this.instagramService.getAccounts(req.user.userId);
  }

  @Delete('accounts/:accountId')
  @HttpCode(204)
  async removeAccount(
    @Request() req: AuthedRequest,
    @Param('accountId') accountId: string,
  ) {
    await this.instagramService.removeAccount(req.user.userId, accountId);
  }

  @Get('analytics/summary')
  getAnalyticsSummary(@Request() req: AuthedRequest) {
    return this.instagramService.getAnalyticsSummary(req.user.userId);
  }

  @Get('oauth/url')
  getOAuthUrl(@Request() req: AuthedRequest) {
    return this.instagramService.createOAuthUrl(req.user.userId);
  }

  @Post('oauth/callback')
  completeOAuth(
    @Request() req: AuthedRequest,
    @Body() body: CompleteInstagramOAuthDto,
  ) {
    return this.instagramService.completeOAuth(req.user, body);
  }
}
