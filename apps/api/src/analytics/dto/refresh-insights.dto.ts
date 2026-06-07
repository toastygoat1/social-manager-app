import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class RefreshInsightsDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  accountId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  range?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
