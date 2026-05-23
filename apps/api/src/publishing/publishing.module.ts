import { Module } from '@nestjs/common';
import { InstagramPublisherService } from './instagram-publisher.service.js';

@Module({
  providers: [InstagramPublisherService],
  exports: [InstagramPublisherService],
})
export class PublishingModule {}
