import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateScheduledPostDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2200)
  caption?: string;

  @IsOptional()
  @IsDateString()
  scheduledFor?: string;
}
