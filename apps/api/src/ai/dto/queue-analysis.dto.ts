import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class QueueAnalysisDto {
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
