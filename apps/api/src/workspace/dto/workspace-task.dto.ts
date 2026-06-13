import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';

export const WORKSPACE_TASK_URGENCIES = ['High', 'Medium', 'Low'] as const;
export const WORKSPACE_TASK_STATUSES = [
  'Not started',
  'In progress',
  'Review',
  'Done',
] as const;

const DEADLINE_LOCAL_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

export class CreateWorkspaceTaskDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  taskName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  assignee?: string;

  @IsOptional()
  @IsIn(WORKSPACE_TASK_URGENCIES)
  urgency?: (typeof WORKSPACE_TASK_URGENCIES)[number];

  @IsOptional()
  @IsUUID()
  accountId?: string | null;

  @IsOptional()
  @IsIn(WORKSPACE_TASK_STATUSES)
  status?: (typeof WORKSPACE_TASK_STATUSES)[number];

  @IsOptional()
  @Matches(DEADLINE_LOCAL_PATTERN)
  deadline?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1200)
  briefExecution?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1200)
  notes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  inputFrom?: string;
}

export class UpdateWorkspaceTaskDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  taskName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  assignee?: string;

  @IsOptional()
  @IsIn(WORKSPACE_TASK_URGENCIES)
  urgency?: (typeof WORKSPACE_TASK_URGENCIES)[number];

  @IsOptional()
  @IsUUID()
  accountId?: string | null;

  @IsOptional()
  @IsIn(WORKSPACE_TASK_STATUSES)
  status?: (typeof WORKSPACE_TASK_STATUSES)[number];

  @IsOptional()
  @Matches(DEADLINE_LOCAL_PATTERN)
  deadline?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1200)
  briefExecution?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1200)
  notes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  inputFrom?: string;
}
