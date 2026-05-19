import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { InstagramService } from './instagram.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { AddInstagramAccountDto } from './dto/add-instagram-account.dto.js';
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
    return this.instagramService.addAccount(req.user.userId, body);
  }

  @Get('accounts')
  async getAccounts(@Request() req: AuthedRequest) {
    return this.instagramService.getAccounts(req.user.userId);
  }
}
