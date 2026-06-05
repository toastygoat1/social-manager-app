import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module.js';
import { InstagramController } from './instagram.controller.js';
import { InstagramService } from './instagram.service.js';

@Module({
  imports: [AiModule],
  controllers: [InstagramController],
  providers: [InstagramService],
})
export class InstagramModule {}
