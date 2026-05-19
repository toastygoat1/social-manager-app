import { Module } from '@nestjs/common';
import { InstagramController } from './instagram.controller.js';
import { InstagramService } from './instagram.service.js';

@Module({
  controllers: [InstagramController],
  providers: [InstagramService],
})
export class InstagramModule {}
