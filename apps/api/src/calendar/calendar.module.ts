import { Module } from '@nestjs/common';
import { CalendarController } from './calendar.controller.js';
import { CalendarService } from './calendar.service.js';
import { GoogleModule } from '../integrations/google/google.module.js';
import { PublishingModule } from '../publishing/publishing.module.js';
import { PublishQueueModule } from '../queue/publish-queue.module.js';
import { MediaModule } from '../media/media.module.js';

@Module({
  imports: [GoogleModule, PublishingModule, PublishQueueModule, MediaModule],
  controllers: [CalendarController],
  providers: [CalendarService],
})
export class CalendarModule {}
