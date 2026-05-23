import { Module } from '@nestjs/common';
import { PublishQueueService } from './publish-queue.service.js';

@Module({
  providers: [PublishQueueService],
  exports: [PublishQueueService],
})
export class PublishQueueModule {}
