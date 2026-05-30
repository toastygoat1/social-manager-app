import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
  Put,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import type { AuthedRequest } from '../auth/auth.types.js';
import { AiService } from './ai.service.js';
import { AiQueueService } from './ai-queue.service.js';
import { AnalyzeDto } from './dto/analyze.dto.js';
import { ChatDto } from './dto/chat.dto.js';
import { CreateSessionDto } from './dto/create-session.dto.js';
import { UpsertSettingsDto } from './dto/upsert-settings.dto.js';
import { ResolveOutcomeDto } from './dto/resolve-outcome.dto.js';
import { QueueAnalysisDto } from './dto/queue-analysis.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';

@UseGuards(JwtAuthGuard)
@Controller('ai')
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly aiQueue: AiQueueService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('analyze')
  async analyze(@Request() req: AuthedRequest, @Body() dto: AnalyzeDto) {
    const userId = req.user.userId;

    const account = await this.prisma.instagramAccount.findUnique({
      where: { id: dto.accountId },
      select: { userId: true },
    });
    if (!account || account.userId !== userId) {
      throw new ForbiddenException('Account not found or access denied');
    }

    const session = await this.prisma.chatbotSession.findUnique({
      where: { id: dto.sessionId },
      select: { userId: true },
    });
    if (!session || session.userId !== userId) {
      throw new ForbiddenException('Session not found or access denied');
    }

    return this.aiService.analyze(userId, dto);
  }

  @Post('chat')
  async chat(@Request() req: AuthedRequest, @Body() dto: ChatDto) {
    const userId = req.user.userId;

    const account = await this.prisma.instagramAccount.findUnique({
      where: { id: dto.accountId },
      select: { userId: true },
    });
    if (!account || account.userId !== userId) {
      throw new ForbiddenException('Account not found or access denied');
    }

    const session = await this.prisma.chatbotSession.findUnique({
      where: { id: dto.sessionId },
      select: { userId: true },
    });
    if (!session || session.userId !== userId) {
      throw new ForbiddenException('Session not found or access denied');
    }

    return this.aiService.chat(userId, dto);
  }

  @Get('sessions/:accountId')
  async getSessions(
    @Request() req: AuthedRequest,
    @Param('accountId') accountId: string,
  ) {
    const userId = req.user.userId;

    const account = await this.prisma.instagramAccount.findUnique({
      where: { id: accountId },
      select: { userId: true },
    });
    if (!account || account.userId !== userId) {
      throw new ForbiddenException('Account not found or access denied');
    }

    return this.aiService.getSessions(userId, accountId);
  }

  @Get('sessions/:sessionId/messages')
  async getSessionMessages(
    @Request() req: AuthedRequest,
    @Param('sessionId') sessionId: string,
  ) {
    const userId = req.user.userId;

    const session = await this.prisma.chatbotSession.findUnique({
      where: { id: sessionId },
      select: { userId: true },
    });
    if (!session || session.userId !== userId) {
      throw new ForbiddenException('Session not found or access denied');
    }

    return this.aiService.getSessionMessages(sessionId);
  }

  @Post('sessions')
  async createSession(
    @Request() req: AuthedRequest,
    @Body() dto: CreateSessionDto,
  ) {
    const userId = req.user.userId;

    const account = await this.prisma.instagramAccount.findUnique({
      where: { id: dto.accountId },
      select: { userId: true },
    });
    if (!account || account.userId !== userId) {
      throw new ForbiddenException('Account not found or access denied');
    }

    return this.aiService.createSession(userId, dto);
  }

  @Delete('memory/:accountId/working')
  async clearWorkingMemory(
    @Request() req: AuthedRequest,
    @Param('accountId') accountId: string,
  ) {
    const userId = req.user.userId;

    const account = await this.prisma.instagramAccount.findUnique({
      where: { id: accountId },
      select: { userId: true },
    });
    if (!account || account.userId !== userId) {
      throw new ForbiddenException('Account not found or access denied');
    }

    return this.aiService.clearWorkingMemory(accountId, userId);
  }

  @Get('settings')
  getSettings(@Request() req: AuthedRequest) {
    return this.aiService.getSettings(req.user.userId);
  }

  @Put('settings')
  upsertSettings(
    @Request() req: AuthedRequest,
    @Body() dto: UpsertSettingsDto,
  ) {
    return this.aiService.upsertSettings(req.user.userId, dto);
  }

  @Post('procedures/:procedureId/resolve')
  async resolveOutcome(
    @Request() req: AuthedRequest,
    @Param('procedureId') procedureId: string,
    @Body() dto: ResolveOutcomeDto,
  ) {
    await this.aiService.resolveOutcome(
      req.user.userId,
      procedureId,
      dto.outcome,
      dto.engagementDelta,
      dto.savesDelta,
    );
    return { resolved: true };
  }

  @Post('analyze/queue')
  async queueAnalysis(
    @Request() req: AuthedRequest,
    @Body() dto: QueueAnalysisDto,
  ) {
    const userId = req.user.userId;

    const account = await this.prisma.instagramAccount.findUnique({
      where: { id: dto.accountId },
      select: { userId: true },
    });
    if (!account || account.userId !== userId) {
      throw new ForbiddenException('Account not found or access denied');
    }

    await this.aiQueue.enqueueAnalysis(
      dto.accountId,
      dto.contentPostId,
      dto.sessionId,
    );
    return { queued: true };
  }
}
