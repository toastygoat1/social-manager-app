import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import type { AuthedRequest } from '../auth/auth.types.js';
import { AnalyticsService } from './analytics.service.js';

@UseGuards(JwtAuthGuard)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('overview')
  getOverview(
    @Request() req: AuthedRequest,
    @Query('accountId') accountId?: string,
    @Query('range') range?: string,
  ) {
    return this.analyticsService.getOverview(req.user.userId, {
      accountId,
      range,
    });
  }
}
