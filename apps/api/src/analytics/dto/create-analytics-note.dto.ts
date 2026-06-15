import {
  ArrayMaxSize,
  IsIn,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

const ANALYTICS_NOTE_COLORS = [
  'cream',
  'sprout',
  'mint',
  'sky',
  'periwinkle',
  'violet',
  'rose',
  'peach',
  'yellow',
  'blue',
  'pink',
  'green',
  'lavender',
  'white',
] as const;

export class CreateAnalyticsNoteDto {
  @IsString()
  @MaxLength(500)
  body!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  accountId?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  accountIds?: string[];

  @IsOptional()
  @IsIn(ANALYTICS_NOTE_COLORS)
  color?: string;
}
