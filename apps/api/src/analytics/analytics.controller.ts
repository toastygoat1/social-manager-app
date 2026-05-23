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
import { UpdateAnalyticsNoteDto } from './dto/update-analytics-note.dto.js';

type RefreshInsightsBody = {
  accountId?: string;
  range?: string;
};

@UseGuards(JwtAuthGuard)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('overview')
  getOverview(
    @Request() req: AuthedRequest,
    @Query('accountId') accountId?: string,
    @Query('range') range?: string,
  ) {
    return this.analyticsService.getOverview(req.user.userId, {
      accountId,
      range,
    });
  }

  @Post('insights/refresh')
  refreshInsights(
    @Request() req: AuthedRequest,
    @Body() body: RefreshInsightsBody,
  ) {
    return this.analyticsService.refreshInsights(req.user.userId, {
      accountId: body?.accountId,
      range: body?.range,
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
