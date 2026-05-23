import { IsString, MaxLength } from 'class-validator';

export class UpdateAnalyticsNoteDto {
  @IsString()
  @MaxLength(500)
  body!: string;
}
