import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class PostMetadataDto {
  @IsOptional()
  @IsUUID()
  fieldId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  label?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  value?: string;
}
