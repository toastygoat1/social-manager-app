import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import type { AuthedRequest } from '../auth/auth.types.js';
import { CalendarService } from './calendar.service.js';
import { ListEventsQueryDto } from './dto/list-events-query.dto.js';
import { CreateEventDto } from './dto/create-event.dto.js';
import { UpdateDraftDto } from './dto/update-draft.dto.js';
import { UpdateScheduledPostDto } from './dto/update-scheduled-post.dto.js';

@UseGuards(JwtAuthGuard)
@Controller('calendar')
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  @Get('events')
  async listEvents(
    @Request() req: AuthedRequest,
    @Query() query: ListEventsQueryDto,
  ) {
    return this.calendarService.listEvents(
      req.user.userId,
      new Date(query.from),
      new Date(query.to),
    );
  }

  @Post('events')
  async createEvent(
    @Request() req: AuthedRequest,
    @Body() body: CreateEventDto,
  ) {
    return this.calendarService.createScheduledEvent(req.user.userId, body);
  }

  @Get('work-items')
  listWorkItems(@Request() req: AuthedRequest) {
    return this.calendarService.listWorkItems(req.user.userId);
  }

  @Get('failed-posts')
  listFailedPosts(@Request() req: AuthedRequest) {
    return this.calendarService.listFailedPosts(req.user.userId);
  }

  @Get('metadata-fields')
  listMetadataFields(@Request() req: AuthedRequest) {
    return this.calendarService.listMetadataFields(req.user.userId);
  }

  @Get('posts/:contentPostId')
  getPost(
    @Request() req: AuthedRequest,
    @Param('contentPostId', new ParseUUIDPipe()) contentPostId: string,
  ) {
    return this.calendarService.getPostDetail(req.user.userId, contentPostId);
  }

  @Patch('posts/:contentPostId/draft')
  updateDraft(
    @Request() req: AuthedRequest,
    @Param('contentPostId', new ParseUUIDPipe()) contentPostId: string,
    @Body() body: UpdateDraftDto,
  ) {
    return this.calendarService.updateDraft(
      req.user.userId,
      contentPostId,
      body,
    );
  }

  @Post('posts/:contentPostId/approve')
  approvePost(
    @Request() req: AuthedRequest,
    @Param('contentPostId', new ParseUUIDPipe()) contentPostId: string,
  ) {
    return this.calendarService.approvePost(req.user.userId, contentPostId);
  }

  @Patch('posts/:contentPostId/scheduled')
  updateScheduledPost(
    @Request() req: AuthedRequest,
    @Param('contentPostId', new ParseUUIDPipe()) contentPostId: string,
    @Body() body: UpdateScheduledPostDto,
  ) {
    return this.calendarService.updateScheduledPost(
      req.user.userId,
      contentPostId,
      body,
    );
  }

  @Post('posts/:contentPostId/retry')
  retryPost(
    @Request() req: AuthedRequest,
    @Param('contentPostId', new ParseUUIDPipe()) contentPostId: string,
  ) {
    return this.calendarService.retryFailedPost(req.user.userId, contentPostId);
  }

  @Delete('posts/:contentPostId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deletePost(
    @Request() req: AuthedRequest,
    @Param('contentPostId', new ParseUUIDPipe()) contentPostId: string,
  ) {
    await this.calendarService.deletePost(req.user.userId, contentPostId);
  }
}
