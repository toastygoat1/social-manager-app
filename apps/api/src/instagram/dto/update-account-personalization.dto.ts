import { IsHexColor, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class UpdateAccountPersonalizationDto {
  @IsOptional()
  @IsString()
  @IsUrl({ require_protocol: true })
  @MaxLength(2048)
  bannerUrl?: string | null;

  @IsOptional()
  @IsHexColor()
  accentColor?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  nickname?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  note?: string | null;
}
