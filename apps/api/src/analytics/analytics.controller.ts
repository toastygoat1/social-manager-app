import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import type { AuthedRequest } from '../auth/auth.types.js';
import { AnalyticsService } from './analytics.service.js';
import { CreateAnalyticsNoteDto } from './dto/create-analytics-note.dto.js';
import { RefreshInsightsDto } from './dto/refresh-insights.dto.js';
import { UpdateAnalyticsNoteDto } from './dto/update-analytics-note.dto.js';

@UseGuards(JwtAuthGuard)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('overview')
  getOverview(
    @Request() req: AuthedRequest,
    @Query('accountId') accountId?: string | string[],
    @Query('range') range?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.analyticsService.getOverview(req.user.userId, {
      accountIds: normalizeAccountIds(accountId),
      range,
      startDate,
      endDate,
    });
  }

  @Post('insights/refresh')
  refreshInsights(
    @Request() req: AuthedRequest,
    @Body() body: RefreshInsightsDto,
  ) {
    return this.analyticsService.refreshInsights(req.user.userId, {
      accountId: body?.accountId,
      accountIds: body?.accountIds,
      range: body?.range,
      startDate: body?.startDate,
      endDate: body?.endDate,
    });
  }

  @Post('notes')
  createNote(
    @Request() req: AuthedRequest,
    @Body() body: CreateAnalyticsNoteDto,
  ) {
    return this.analyticsService.createNote(req.user.userId, body);
  }

  @Patch('notes/:noteId')
  updateNote(
    @Request() req: AuthedRequest,
    @Param('noteId') noteId: string,
    @Body() body: UpdateAnalyticsNoteDto,
  ) {
    return this.analyticsService.updateNote(req.user.userId, noteId, body);
  }

  @Delete('notes/:noteId')
  deleteNote(@Request() req: AuthedRequest, @Param('noteId') noteId: string) {
    return this.analyticsService.deleteNote(req.user.userId, noteId);
  }
}

function normalizeAccountIds(value: string | string[] | undefined) {
  const values = Array.isArray(value) ? value : value ? [value] : [];

  return [...new Set(values.map((item) => item.trim()).filter(Boolean))];
}
