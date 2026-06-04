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
import { SchedulerService } from './scheduler.service.js';
import { ListEventsQueryDto } from './dto/list-events-query.dto.js';
import { CreateEventDto } from './dto/create-event.dto.js';
import { UpdateDraftDto } from './dto/update-draft.dto.js';
import { UpdateScheduledPostDto } from './dto/update-scheduled-post.dto.js';
import { SaveMetadataFieldsDto } from './dto/save-metadata-fields.dto.js';

@UseGuards(JwtAuthGuard)
@Controller('scheduler')
export class SchedulerController {
  constructor(private readonly schedulerService: SchedulerService) {}

  @Get('events')
  async listEvents(
    @Request() req: AuthedRequest,
    @Query() query: ListEventsQueryDto,
  ) {
    return this.schedulerService.listEvents(
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
    return this.schedulerService.createScheduledEvent(req.user.userId, body);
  }

  @Get('work-items')
  listWorkItems(@Request() req: AuthedRequest) {
    return this.schedulerService.listWorkItems(req.user.userId);
  }

  @Get('failed-posts')
  listFailedPosts(@Request() req: AuthedRequest) {
    return this.schedulerService.listFailedPosts(req.user.userId);
  }

  @Get('metadata-fields')
  listMetadataFields(@Request() req: AuthedRequest) {
    return this.schedulerService.listMetadataFields(req.user.userId);
  }

  @Patch('metadata-fields')
  saveMetadataFields(
    @Request() req: AuthedRequest,
    @Body() body: SaveMetadataFieldsDto,
  ) {
    return this.schedulerService.saveMetadataFields(
      req.user.userId,
      body.fields,
    );
  }

  @Get('posts/:contentPostId')
  getPost(
    @Request() req: AuthedRequest,
    @Param('contentPostId', new ParseUUIDPipe()) contentPostId: string,
  ) {
    return this.schedulerService.getPostDetail(req.user.userId, contentPostId);
  }

  @Patch('posts/:contentPostId/draft')
  updateDraft(
    @Request() req: AuthedRequest,
    @Param('contentPostId', new ParseUUIDPipe()) contentPostId: string,
    @Body() body: UpdateDraftDto,
  ) {
    return this.schedulerService.updateDraft(
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
    return this.schedulerService.approvePost(req.user.userId, contentPostId);
  }

  @Patch('posts/:contentPostId/scheduled')
  updateScheduledPost(
    @Request() req: AuthedRequest,
    @Param('contentPostId', new ParseUUIDPipe()) contentPostId: string,
    @Body() body: UpdateScheduledPostDto,
  ) {
    return this.schedulerService.updateScheduledPost(
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
    return this.schedulerService.retryFailedPost(
      req.user.userId,
      contentPostId,
    );
  }

  @Delete('posts/:contentPostId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deletePost(
    @Request() req: AuthedRequest,
    @Param('contentPostId', new ParseUUIDPipe()) contentPostId: string,
  ) {
    await this.schedulerService.deletePost(req.user.userId, contentPostId);
  }
}
