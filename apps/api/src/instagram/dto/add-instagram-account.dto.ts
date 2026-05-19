import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { InstagramAccountType } from '@social-manager/database';

export class AddInstagramAccountDto {
  @IsString()
  @MaxLength(64)
  igUserId!: string;

  @IsString()
  @MaxLength(128)
  username!: string;

  @IsString()
  accessToken!: string;

  @IsEnum(InstagramAccountType)
  accountType!: InstagramAccountType;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  pageId?: string;

  @IsOptional()
  @IsDateString()
  tokenExpiresAt?: string;
}
