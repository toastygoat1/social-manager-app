import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Request,
  Query,
  Param,
  Headers,
  Header,
  HttpCode,
} from '@nestjs/common';
import { InstagramService } from './instagram.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { AddInstagramAccountDto } from './dto/add-instagram-account.dto.js';
import { SendDmMessageDto } from './dto/send-dm-message.dto.js';
import type { AuthedRequest } from '../auth/auth.types.js';
import type { InstagramWebhookPayload } from './instagram-webhook.types.js';

interface InstagramWebhookRequest {
  rawBody?: Buffer;
}

@Controller('instagram')
export class InstagramController {
  constructor(private readonly instagramService: InstagramService) {}

  @Get('webhooks')
  @Header('Content-Type', 'text/plain')
  verifyWebhook(@Query() query: Record<string, string | undefined>) {
    return this.instagramService.verifyWebhookSubscription(query);
  }

  @Post('webhooks')
  @HttpCode(200)
  async receiveWebhook(
    @Request() req: InstagramWebhookRequest,
    @Headers('x-hub-signature-256') signature: string | undefined,
    @Body() body: InstagramWebhookPayload,
  ) {
    return this.instagramService.receiveWebhook(body, req.rawBody, signature);
  }

  @UseGuards(JwtAuthGuard)
  @Post('accounts')
  async addAccount(
    @Request() req: AuthedRequest,
    @Body() body: AddInstagramAccountDto,
  ) {
    return this.instagramService.addAccount(req.user.userId, body);
  }

  @UseGuards(JwtAuthGuard)
  @Get('accounts')
  async getAccounts(@Request() req: AuthedRequest) {
    return this.instagramService.getAccounts(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('dm/conversations')
  async getDmConversations(
    @Request() req: AuthedRequest,
    @Query('accountId') accountId?: string,
  ) {
    return this.instagramService.getDmConversations(req.user.userId, accountId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('dm/conversations/:conversationId')
  async getDmConversation(
    @Request() req: AuthedRequest,
    @Param('conversationId') conversationId: string,
  ) {
    return this.instagramService.getDmConversation(
      req.user.userId,
      conversationId,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('dm/conversations/:conversationId/messages')
  async sendDmMessage(
    @Request() req: AuthedRequest,
    @Param('conversationId') conversationId: string,
    @Body() body: SendDmMessageDto,
  ) {
    return this.instagramService.sendDmMessage(
      req.user.userId,
      conversationId,
      body,
    );
  }
}
