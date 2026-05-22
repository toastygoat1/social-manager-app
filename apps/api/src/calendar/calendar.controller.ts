import {
  Body,
  Controller,
  Get,
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
}
