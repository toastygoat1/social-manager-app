import {
  ArrayMaxSize,
  IsIn,
  IsInt,
  IsArray,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const ANALYTICS_NOTE_COLORS = [
  'yellow',
  'blue',
  'pink',
  'green',
  'lavender',
  'white',
] as const;

export class UpdateAnalyticsNoteDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  body?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  accountId?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  accountIds?: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2400)
  boardX?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2400)
  boardY?: number;

  @IsOptional()
  @IsInt()
  @Min(180)
  @Max(520)
  boardWidth?: number;

  @IsOptional()
  @IsInt()
  @Min(160)
  @Max(520)
  boardHeight?: number;

  @IsOptional()
  @IsIn(ANALYTICS_NOTE_COLORS)
  color?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10000)
  zIndex?: number;
}
