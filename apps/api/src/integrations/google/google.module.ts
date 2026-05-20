import { Module } from '@nestjs/common';
import { GoogleController } from './google.controller.js';
import { GoogleService } from './google.service.js';

@Module({
  controllers: [GoogleController],
  providers: [GoogleService],
  exports: [GoogleService],
})
export class GoogleModule {}
