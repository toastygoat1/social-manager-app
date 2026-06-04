import { IsNotEmpty, IsString } from 'class-validator';

export class AnalyzeStoryDto {
  @IsString()
  @IsNotEmpty()
  accountId!: string;

  @IsString()
  @IsNotEmpty()
  storyId!: string;

  @IsString()
  @IsNotEmpty()
  sessionId!: string;
}
