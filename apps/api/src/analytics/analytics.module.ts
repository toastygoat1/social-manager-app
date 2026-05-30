import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module.js';
import { AiModule } from '../ai/ai.module.js';
import { AnalyticsController } from './analytics.controller.js';
import { AnalyticsService } from './analytics.service.js';

@Module({
  imports: [MediaModule, AiModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
})
export class AnalyticsModule {}
