import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class AnalyzeDto {
  @IsUUID('4')
  accountId!: string;

  @IsUUID('4')
  contentPostId!: string;

  @IsUUID('4')
  sessionId!: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  userMessage?: string;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  @MaxLength(64)
  batchId?: string;
}
