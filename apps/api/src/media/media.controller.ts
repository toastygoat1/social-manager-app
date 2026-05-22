import { Body, Controller, Post, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import type { AuthedRequest } from '../auth/auth.types.js';
import { MediaService } from './media.service.js';
import { CreateMediaUploadUrlsDto } from './dto/create-media-upload-urls.dto.js';
import { CompleteMediaUploadsDto } from './dto/complete-media-uploads.dto.js';

@UseGuards(JwtAuthGuard)
@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('upload-urls')
  createUploadUrls(
    @Request() req: AuthedRequest,
    @Body() body: CreateMediaUploadUrlsDto,
  ) {
    return this.mediaService.createUploadUrls(req.user, body.files);
  }

  @Post('assets')
  completeUploads(
    @Request() req: AuthedRequest,
    @Body() body: CompleteMediaUploadsDto,
  ) {
    return this.mediaService.completeUploads(req.user, body.files);
  }
}
