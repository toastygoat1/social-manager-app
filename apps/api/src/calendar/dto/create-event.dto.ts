import {
  IsBoolean,
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  ArrayMaxSize,
  MaxLength,
} from 'class-validator';
import { PostType } from '@social-manager/database';

export class CreateEventDto {
  @IsUUID()
  instagramAccountId!: string;

  @IsEnum(PostType)
  postType!: PostType;

  @IsDateString()
  scheduledFor!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2200)
  caption?: string;

  @IsOptional()
  @IsBoolean()
  requiresApproval?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsUUID('4', { each: true })
  mediaAssetIds?: string[];
}
