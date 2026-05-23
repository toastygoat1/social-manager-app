import { Module } from '@nestjs/common';
import { InstagramPublisherService } from './instagram-publisher.service.js';
import { PublishingController } from './publishing.controller.js';
import { WorkerPublishGuard } from './worker-publish.guard.js';

@Module({
  controllers: [PublishingController],
  providers: [InstagramPublisherService, WorkerPublishGuard],
  exports: [InstagramPublisherService],
})
export class PublishingModule {}
