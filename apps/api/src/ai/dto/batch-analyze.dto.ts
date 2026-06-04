import { IsIn, IsNotEmpty, IsString } from 'class-validator';
import type { BatchRange } from '@social-manager/types';

export class BatchAnalyzeDto {
  @IsString()
  @IsNotEmpty()
  accountId!: string;

  @IsIn(['week', 'month', 'year'])
  range!: BatchRange;
}
