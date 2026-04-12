import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service.js';
import type { PostSummary } from '@social-manager/types';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): PostSummary {
    return {
      id: 'post_1',
      content: 'First scheduled post',
      status: 'draft',
      scheduledAt: null,
      createdAt: new Date().toISOString(),
    };
  }
}
