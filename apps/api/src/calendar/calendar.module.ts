import { Module } from '@nestjs/common';
import { CalendarController } from './calendar.controller.js';
import { CalendarService } from './calendar.service.js';
import { GoogleModule } from '../integrations/google/google.module.js';

@Module({
  imports: [GoogleModule],
  controllers: [CalendarController],
  providers: [CalendarService],
})
export class CalendarModule {}
