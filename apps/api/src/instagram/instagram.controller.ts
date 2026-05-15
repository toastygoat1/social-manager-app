import { Controller, Get, Post, Body, UseGuards, Request } from '@nestjs/common';
import { InstagramService } from './instagram.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';

@UseGuards(JwtAuthGuard)
@Controller('instagram')
export class InstagramController {
  constructor(private readonly instagramService: InstagramService) {}

  @Post('accounts')
  async addAccount(@Request() req, @Body() body) {
    return this.instagramService.addAccount(req.user.userId, body);
  }

  @Get('accounts')
  async getAccounts(@Request() req) {
    return this.instagramService.getAccounts(req.user.userId);
  }
}