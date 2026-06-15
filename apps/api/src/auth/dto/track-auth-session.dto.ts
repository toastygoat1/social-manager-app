import { IsOptional, IsString, MaxLength } from 'class-validator';

export class TrackAuthSessionDto {
  @IsOptional()
  @IsString()
  @MaxLength(600)
  userAgent?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  ipAddress?: string;
}
