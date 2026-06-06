import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateAnalyticsNoteDto {
  @IsString()
  @MaxLength(500)
  body!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  accountId?: string;
}
