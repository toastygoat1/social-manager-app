import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { WorkerAiGuard } from './guards/worker-ai.guard.js';
import { AiService } from './ai.service.js';

class InternalAnalyzeDto {
  @IsUUID('4')
  accountId!: string;

  @IsUUID('4')
  contentPostId!: string;

  @IsOptional()
  @IsUUID('4')
  sessionId?: string;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  @MaxLength(64)
  batchId?: string;
}

@UseGuards(WorkerAiGuard)
@Controller('internal/ai')
export class InternalAiController {
  constructor(private readonly aiService: AiService) {}

  @Post('analyze')
  analyze(@Body() body: InternalAnalyzeDto) {
    return this.aiService.analyzeInternal(
      body.accountId,
      body.contentPostId,
      body.sessionId,
      body.batchId,
    );
  }
}
