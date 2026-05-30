import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class AnalyzeDto {
  @IsString()
  @IsNotEmpty()
  accountId!: string;

  @IsString()
  @IsNotEmpty()
  contentPostId!: string;

  @IsString()
  @IsNotEmpty()
  sessionId!: string;

  @IsString()
  @IsOptional()
  userMessage?: string;
}
