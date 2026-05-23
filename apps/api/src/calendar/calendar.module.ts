import { Module } from '@nestjs/common';
import { CalendarController } from './calendar.controller.js';
import { CalendarService } from './calendar.service.js';
import { GoogleModule } from '../integrations/google/google.module.js';
import { PublishingModule } from '../publishing/publishing.module.js';

@Module({
  imports: [GoogleModule, PublishingModule],
  controllers: [CalendarController],
  providers: [CalendarService],
})
export class CalendarModule {}
