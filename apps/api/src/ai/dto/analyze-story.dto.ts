import { IsUUID } from 'class-validator';

export class AnalyzeStoryDto {
  @IsUUID('4')
  accountId!: string;

  @IsUUID('4')
  storyId!: string;

  @IsUUID('4')
  sessionId!: string;
}
