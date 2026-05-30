import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { WorkerAiGuard } from './guards/worker-ai.guard.js';
import { AiService } from './ai.service.js';

class InternalAnalyzeDto {
  @IsString()
  @IsNotEmpty()
  accountId!: string;

  @IsString()
  @IsNotEmpty()
  contentPostId!: string;

  @IsString()
  @IsOptional()
  sessionId?: string;
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
    );
  }
}
