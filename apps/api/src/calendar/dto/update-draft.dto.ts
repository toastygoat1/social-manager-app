import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export const UPDATE_DRAFT_ACTIONS = ['DRAFT', 'SCHEDULE'] as const;
export type UpdateDraftAction = (typeof UPDATE_DRAFT_ACTIONS)[number];

export class UpdateDraftDto {
  @IsOptional()
  @IsIn(UPDATE_DRAFT_ACTIONS)
  action?: UpdateDraftAction;

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

  @IsOptional()
  @IsBoolean()
  requiresApproval?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsUUID('4', { each: true })
  mediaAssetIds?: string[];
}
