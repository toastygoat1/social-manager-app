import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

const BANNER_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

export class CreateWorkspaceFolderDto {
  @IsString()
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  bannerTitle?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  bannerDescription?: string | null;

  @IsOptional()
  @Matches(BANNER_COLOR_PATTERN)
  bannerColor?: string | null;
}

export class UpdateWorkspaceFolderDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  bannerTitle?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  bannerDescription?: string | null;

  @IsOptional()
  @Matches(BANNER_COLOR_PATTERN)
  bannerColor?: string | null;
}
