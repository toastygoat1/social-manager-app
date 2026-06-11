import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module.js';
import { MediaModule } from '../media/media.module.js';
import { InstagramController } from './instagram.controller.js';
import { InstagramService } from './instagram.service.js';

@Module({
  imports: [AiModule, MediaModule],
  controllers: [InstagramController],
  providers: [InstagramService],
})
export class InstagramModule {}
