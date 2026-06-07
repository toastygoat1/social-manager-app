import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class QueueAnalysisDto {
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
