import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpsertSettingsDto {
  @IsString()
  @IsOptional()
  preferredTone?: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  customInstructions?: string;

  @IsString()
  @IsOptional()
  preferredLanguage?: string;
}
