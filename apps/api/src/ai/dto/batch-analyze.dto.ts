import { IsIn, IsUUID } from 'class-validator';
import type { BatchRange } from '@social-manager/types';

export class BatchAnalyzeDto {
  @IsUUID('4')
  accountId!: string;

  @IsIn(['week', 'month', 'year'])
  range!: BatchRange;
}
