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
  IsIn,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PostType } from '@social-manager/database';
import { PostMetadataDto } from './post-metadata.dto.js';

export const CREATE_EVENT_ACTIONS = ['SCHEDULE', 'POST_NOW', 'DRAFT'] as const;
export type CreateEventAction = (typeof CREATE_EVENT_ACTIONS)[number];

export class CreateEventDto {
  @IsUUID()
  instagramAccountId!: string;

  @IsEnum(PostType)
  postType!: PostType;

  @IsOptional()
  @IsIn(CREATE_EVENT_ACTIONS)
  action?: CreateEventAction;

  @IsOptional()
  @IsDateString()
  scheduledFor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2200)
  caption?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => PostMetadataDto)
  metadata?: PostMetadataDto[];

  @IsOptional()
  @IsBoolean()
  requiresApproval?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsUUID('4', { each: true })
  mediaAssetIds?: string[];
}
