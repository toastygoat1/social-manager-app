import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller.js';
import { DashboardService } from './dashboard.service.js';
import { GoogleModule } from '../integrations/google/google.module.js';

@Module({
  imports: [GoogleModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
