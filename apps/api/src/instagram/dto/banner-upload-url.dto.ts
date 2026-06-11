import { IsInt, IsString, MaxLength, Min } from 'class-validator';

export class BannerUploadUrlDto {
  @IsString()
  @MaxLength(180)
  name!: string;

  @IsString()
  @MaxLength(120)
  mimeType!: string;

  @IsInt()
  @Min(1)
  fileSize!: number;
}

export class ConfirmBannerUploadDto {
  @IsString()
  @MaxLength(2048)
  storagePath!: string;
}
