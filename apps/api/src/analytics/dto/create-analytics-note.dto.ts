import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateAnalyticsNoteDto {
  @IsString()
  @MaxLength(500)
  body!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  accountId?: string;
}
