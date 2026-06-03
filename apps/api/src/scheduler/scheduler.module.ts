import { Module } from '@nestjs/common';
import { SchedulerController } from './scheduler.controller.js';
import { SchedulerService } from './scheduler.service.js';
import { PublishingModule } from '../publishing/publishing.module.js';
import { PublishQueueModule } from '../queue/publish-queue.module.js';
import { MediaModule } from '../media/media.module.js';

@Module({
  imports: [PublishingModule, PublishQueueModule, MediaModule],
  controllers: [SchedulerController],
  providers: [SchedulerService],
})
export class SchedulerModule {}
