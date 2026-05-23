import {
  Controller,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { InstagramPublisherService } from './instagram-publisher.service.js';
import { WorkerPublishGuard } from './worker-publish.guard.js';

@UseGuards(WorkerPublishGuard)
@Controller('internal/publishing')
export class PublishingController {
  constructor(private readonly publisher: InstagramPublisherService) {}

  @Post('scheduled/:contentPostId')
  async publishScheduled(
    @Param('contentPostId', new ParseUUIDPipe()) contentPostId: string,
    @Headers('x-job-reference') jobReference?: string,
  ) {
    const post = await this.publisher.publishScheduled(
      contentPostId,
      jobReference?.slice(0, 255),
    );

    return {
      id: post.id,
      status: post.status,
      publishedAt: post.publishedAt,
      igPermalink: post.igPermalink,
    };
  }
}
