import {
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

const BANNER_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
export const WORKPLACE_ICONS = [
  'workplace',
  'briefcase',
  'clipboard',
  'calendar',
  'camera',
  'megaphone',
  'users',
  'archive',
  'palette',
  'file',
  'anchor',
  'at-sign',
  'badge-dollar',
  'bell',
  'bike',
  'book',
  'bot',
  'box',
  'brush',
  'chart',
  'cloud',
  'coffee',
  'command',
  'compass',
  'crown',
  'database',
  'gem',
  'gift',
  'globe',
  'handshake',
  'heart',
  'home',
  'inbox',
  'laptop',
  'lightbulb',
  'map-pin',
  'message',
  'music',
  'notebook',
  'package',
  'receipt',
  'rocket',
  'send',
  'shapes',
  'shield',
  'shopping-bag',
  'sparkles',
  'star',
  'store',
  'target',
  'trophy',
  'video',
  'wallet',
  'zap',
] as const;

export class CreateWorkspaceFolderDto {
  @IsString()
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @IsIn(WORKPLACE_ICONS)
  icon?: (typeof WORKPLACE_ICONS)[number] | null;

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

  @IsOptional()
  @IsString()
  @MaxLength(500)
  bannerImagePath?: string | null;
}

export class UpdateWorkspaceFolderDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsIn(WORKPLACE_ICONS)
  icon?: (typeof WORKPLACE_ICONS)[number] | null;

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

  @IsOptional()
  @IsString()
  @MaxLength(500)
  bannerImagePath?: string | null;
}
